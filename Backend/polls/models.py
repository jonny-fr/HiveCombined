from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class Poll(models.Model):
    event = models.ForeignKey("events.Event", on_delete=models.CASCADE, related_name="polls")
    question = models.CharField(max_length=500)
    allows_multiple = models.BooleanField(default=False)
    opens_at = models.DateTimeField(blank=True, null=True)
    closes_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_polls",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("id",)
        constraints = [
            models.CheckConstraint(
                name="poll_close_after_open",
                condition=Q(closes_at__isnull=True)
                | Q(opens_at__isnull=True)
                | Q(closes_at__gte=F("opens_at")),
            )
        ]
        indexes = [models.Index(fields=("event",))]

    def __str__(self):
        return self.question


class PollOption(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="options")
    label = models.CharField(max_length=255)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("position", "id")
        constraints = [models.UniqueConstraint(fields=("poll", "label"), name="uniq_poll_option_label")]
        indexes = [models.Index(fields=("poll",))]

    def __str__(self):
        return self.label


class Vote(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="votes")
    option = models.ForeignKey(PollOption, on_delete=models.CASCADE, related_name="votes")
    participation = models.ForeignKey(
        "events.Participation",
        on_delete=models.CASCADE,
        related_name="votes",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="votes",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("poll", "user", "option"), name="uniq_vote_per_option_user"),
        ]
        indexes = [models.Index(fields=("poll", "user"))]

    def clean(self):
        if self.option_id and self.poll_id and self.option.poll_id != self.poll_id:
            raise ValidationError("Vote option must belong to the same poll.")
        if self.participation_id and self.poll_id and self.participation.event_id != self.poll.event_id:
            raise ValidationError("Vote participation must belong to poll event.")
        if self.participation_id and self.user_id and self.participation.user_id != self.user_id:
            raise ValidationError("Vote user and participation user must match.")

    def __str__(self):
        return f"Vote(poll={self.poll_id}, user={self.user_id}, option={self.option_id})"


class VoteSubmission(models.Model):
    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name="submissions")
    participation = models.ForeignKey(
        "events.Participation",
        on_delete=models.CASCADE,
        related_name="vote_submissions",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vote_submissions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("poll", "user"), name="uniq_vote_submission_per_user"),
        ]
        indexes = [models.Index(fields=("poll", "user"))]

    def clean(self):
        if self.participation_id and self.poll_id and self.participation.event_id != self.poll.event_id:
            raise ValidationError("Vote submission participation must belong to poll event.")
        if self.participation_id and self.user_id and self.participation.user_id != self.user_id:
            raise ValidationError("Vote submission user and participation user must match.")

    def __str__(self):
        return f"VoteSubmission(poll={self.poll_id}, user={self.user_id})"
