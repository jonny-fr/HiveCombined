from __future__ import annotations

from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from events.models import (
    ContributionItem,
    CustomFieldDefinition,
    CustomFieldType,
    CustomFieldValue,
    Event,
    Participation,
    RSVPStatus,
)
from invitations.models import Invitation, InvitationStatus


def events_visible_to_user(user):
    if not user or not user.is_authenticated:
        return Event.objects.none()

    now = timezone.now()
    email = (user.email or "").strip()
    invitation_filter = Q(invitations__invitee_user=user)
    if email:
        invitation_filter |= Q(invitations__invitee_email__iexact=email)
    invitation_filter &= Q(
        Q(invitations__status=InvitationStatus.ACCEPTED)
        | Q(invitations__status=InvitationStatus.PENDING, invitations__expires_at__gte=now)
    )

    return (
        Event.objects.filter(Q(owner=user) | Q(participations__user=user) | invitation_filter)
        .select_related("owner")
        .distinct()
    )


def can_user_access_event(event: Event, user) -> bool:
    if not user or not user.is_authenticated:
        return False

    if event.owner_id == user.id:
        return True
    if Participation.objects.filter(event=event, user=user).exists():
        return True
    email = (user.email or "").strip()
    invitation_filter = Q(event=event, invitee_user=user)
    if email:
        invitation_filter |= Q(event=event, invitee_email__iexact=email)
    invitation_filter &= Q(
        Q(status=InvitationStatus.ACCEPTED)
        | Q(status=InvitationStatus.PENDING, expires_at__gte=timezone.now())
    )
    return Invitation.objects.filter(invitation_filter).exists()


def can_user_manage_event(event: Event, user) -> bool:
    return event.owner_id == user.id


def ensure_event_access(event: Event, user) -> None:
    if not can_user_access_event(event, user):
        raise PermissionDenied("You do not have access to this event.")


def ensure_event_owner(event: Event, user) -> None:
    if not can_user_manage_event(event, user):
        raise PermissionDenied("Only the event owner can perform this action.")


@transaction.atomic
def create_event(owner, **validated_data) -> Event:
    event = Event.objects.create(owner=owner, **validated_data)
    Participation.objects.create(
        event=event,
        user=owner,
        rsvp_status=RSVPStatus.ACCEPTED,
    )
    return event


def get_or_create_participation_for_user(event: Event, user) -> Participation:
    if event.owner_id == user.id:
        participation, _ = Participation.objects.get_or_create(
            event=event,
            user=user,
            defaults={"rsvp_status": RSVPStatus.ACCEPTED},
        )
        if participation.rsvp_status != RSVPStatus.ACCEPTED:
            participation.rsvp_status = RSVPStatus.ACCEPTED
            participation.save(update_fields=["rsvp_status", "updated_at"])
        return participation

    participation = Participation.objects.filter(event=event, user=user).first()
    if participation:
        return participation

    email = (user.email or "").strip()
    invitation_filter = Q(event=event, invitee_user=user)
    if email:
        invitation_filter |= Q(event=event, invitee_email__iexact=email)
    invitation_filter &= Q(
        Q(status=InvitationStatus.ACCEPTED)
        | Q(status=InvitationStatus.PENDING, expires_at__gte=timezone.now())
    )
    if not Invitation.objects.filter(invitation_filter).exists():
        raise PermissionDenied("You are not invited to this event.")
    return Participation.objects.create(event=event, user=user, rsvp_status=RSVPStatus.PENDING)


@transaction.atomic
def replace_contributions(event: Event, participation: Participation, contributions: list[dict[str, Any]]) -> None:
    ContributionItem.objects.filter(event=event, participation=participation).delete()
    items = [
        ContributionItem(
            event=event,
            participation=participation,
            item_name=item["item_name"],
            quantity=item.get("quantity", 1),
            notes=item.get("notes", ""),
        )
        for item in contributions
    ]
    if items:
        ContributionItem.objects.bulk_create(items)


def _validate_field_value(definition: CustomFieldDefinition, value: Any) -> Any:
    if value is None:
        if definition.required:
            raise ValidationError({definition.key: "This field is required."})
        return None

    if definition.field_type == CustomFieldType.TEXT:
        if not isinstance(value, str):
            raise ValidationError({definition.key: "Expected a string value."})
        if definition.required and value.strip() == "":
            raise ValidationError({definition.key: "This field is required."})
        return value

    if definition.field_type == CustomFieldType.NUMBER:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValidationError({definition.key: "Expected a numeric value."})
        return value

    if definition.field_type == CustomFieldType.BOOL:
        if not isinstance(value, bool):
            raise ValidationError({definition.key: "Expected a boolean value."})
        return value

    if definition.field_type == CustomFieldType.ENUM:
        if not isinstance(value, str):
            raise ValidationError({definition.key: "Expected a string option value."})
        if value not in definition.options:
            raise ValidationError({definition.key: "Value is not in allowed options."})
        return value

    raise ValidationError({definition.key: "Unsupported custom field type."})


@transaction.atomic
def save_custom_field_answers(
    event: Event,
    participation: Participation,
    answers: dict[str, Any],
) -> None:
    definitions = {
        definition.key: definition
        for definition in CustomFieldDefinition.objects.filter(event=event)
    }

    for key in answers:
        if key not in definitions:
            raise ValidationError({key: "Unknown custom field key."})

    for key, raw_value in answers.items():
        definition = definitions[key]
        normalized = _validate_field_value(definition, raw_value)
        CustomFieldValue.objects.update_or_create(
            event=event,
            participation=participation,
            definition=definition,
            defaults={"value": normalized},
        )
