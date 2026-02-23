from __future__ import annotations

from django.db import IntegrityError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from events.services import get_or_create_participation_for_user
from polls.models import Poll, PollOption, Vote, VoteSubmission


def ensure_poll_is_open(poll: Poll) -> None:
    now = timezone.now()
    if poll.opens_at and now < poll.opens_at:
        raise ValidationError({"poll": "Voting has not opened yet."})
    if poll.closes_at and now > poll.closes_at:
        raise ValidationError({"poll": "Voting has already closed."})


@transaction.atomic
def create_poll_with_options(*, event, created_by, poll_data: dict, options_data: list[dict]) -> Poll:
    if len(options_data) < 2:
        raise ValidationError({"options": "Provide at least two options."})

    poll = Poll.objects.create(
        event=event,
        created_by=created_by,
        question=poll_data["question"],
        allows_multiple=poll_data.get("allows_multiple", False),
        opens_at=poll_data.get("opens_at"),
        closes_at=poll_data.get("closes_at"),
    )
    options = [
        PollOption(
            poll=poll,
            label=option["label"],
            position=option.get("position", index),
        )
        for index, option in enumerate(options_data)
    ]
    PollOption.objects.bulk_create(options)
    return poll


@transaction.atomic
def cast_vote(*, poll: Poll, user, option_ids: list[int]) -> list[Vote]:
    ensure_poll_is_open(poll)
    if not option_ids:
        raise ValidationError({"option_ids": "Select at least one option."})

    if len(option_ids) != len(set(option_ids)):
        raise ValidationError({"option_ids": "Duplicate options are not allowed."})

    normalized_option_ids = sorted(set(option_ids))
    if not poll.allows_multiple and len(normalized_option_ids) != 1:
        raise ValidationError({"option_ids": "This poll allows only one selected option."})

    options = list(PollOption.objects.filter(poll=poll, id__in=normalized_option_ids))
    if len(options) != len(normalized_option_ids):
        raise ValidationError({"option_ids": "One or more options are invalid for this poll."})

    participation = get_or_create_participation_for_user(poll.event, user)
    if participation.event_id != poll.event_id:
        raise ValidationError({"vote": "Participation does not match poll event."})
    if participation.user_id != user.id:
        raise ValidationError({"vote": "Participation does not match authenticated user."})

    try:
        VoteSubmission.objects.create(
            poll=poll,
            participation=participation,
            user=user,
        )
    except IntegrityError:
        raise ValidationError({"vote": ["already voted"]})

    votes = [
        Vote(
            poll=poll,
            option=option,
            participation=participation,
            user=user,
        )
        for option in options
    ]
    created_votes = Vote.objects.bulk_create(votes)
    return created_votes


def get_poll_results(poll: Poll) -> dict:
    options = poll.options.annotate(vote_count=Count("votes")).order_by("position", "id")
    total_votes = Vote.objects.filter(poll=poll).count()
    unique_voters = Vote.objects.filter(poll=poll).values("user").distinct().count()
    return {
        "poll_id": poll.id,
        "question": poll.question,
        "allows_multiple": poll.allows_multiple,
        "total_votes": total_votes,
        "unique_voters": unique_voters,
        "options": [
            {"id": option.id, "label": option.label, "vote_count": option.vote_count}
            for option in options
        ],
    }
