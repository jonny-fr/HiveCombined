from __future__ import annotations

import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from events.models import Participation, RSVPStatus
from invitations.models import Invitation, InvitationStatus

User = get_user_model()


def hash_invitation_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(32)


def _normalized_emails(emails: list[str]) -> list[str]:
    seen = set()
    result = []
    for email in emails:
        normalized = email.strip().lower()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


@transaction.atomic
def create_invitations(
    *,
    event,
    created_by,
    emails: list[str] | None = None,
    user_ids: list[int] | None = None,
    expires_in_hours: int | None = None,
) -> list[dict]:
    emails = _normalized_emails(emails or [])
    user_ids = sorted(set(user_ids or []))
    expiry_hours = expires_in_hours or settings.INVITATION_TTL_HOURS
    expires_at = timezone.now() + timedelta(hours=expiry_hours)

    created = []
    users = User.objects.filter(id__in=user_ids)

    for user in users:
        token = generate_invitation_token()
        token_hash = hash_invitation_token(token)
        invitation, _ = Invitation.objects.update_or_create(
            event=event,
            invitee_user=user,
            defaults={
                "invitee_email": (user.email or "").strip().lower(),
                "token_hash": token_hash,
                "expires_at": expires_at,
                "status": InvitationStatus.PENDING,
                "responded_at": None,
                "created_by": created_by,
            },
        )
        created.append({"invitation": invitation, "token": token})

    for email in emails:
        token = generate_invitation_token()
        token_hash = hash_invitation_token(token)
        invitation = Invitation.objects.filter(event=event, invitee_email=email).first()
        if invitation:
            invitation.token_hash = token_hash
            invitation.expires_at = expires_at
            invitation.status = InvitationStatus.PENDING
            invitation.responded_at = None
            invitation.created_by = created_by
            invitation.save(
                update_fields=[
                    "token_hash",
                    "expires_at",
                    "status",
                    "responded_at",
                    "created_by",
                    "updated_at",
                ]
            )
        else:
            invitation = Invitation.objects.create(
                event=event,
                invitee_user=None,
                invitee_email=email,
                token_hash=token_hash,
                expires_at=expires_at,
                status=InvitationStatus.PENDING,
                responded_at=None,
                created_by=created_by,
            )
        created.append({"invitation": invitation, "token": token})

    return created


@transaction.atomic
def respond_to_invitation(*, token: str, user, status: str):
    invitation = Invitation.objects.select_related("event", "invitee_user").filter(
        token_hash=hash_invitation_token(token)
    ).first()
    if not invitation:
        raise NotFound("Invitation token is invalid.")
    if invitation.is_expired():
        raise ValidationError({"token": "Invitation token has expired."})

    if invitation.invitee_user_id and invitation.invitee_user_id != user.id:
        raise PermissionDenied("This invitation is not assigned to your account.")

    invite_email = (invitation.invitee_email or "").strip().lower()
    user_email = (user.email or "").strip().lower()
    if invite_email and invite_email != user_email:
        raise PermissionDenied("Invitation email does not match your account email.")

    invitation.status = status
    invitation.responded_at = timezone.now()
    if invitation.invitee_user_id is None:
        invitation.invitee_user = user
    invitation.save(update_fields=["status", "responded_at", "invitee_user", "updated_at"])

    participation, _ = Participation.objects.get_or_create(event=invitation.event, user=user)
    participation.rsvp_status = (
        RSVPStatus.ACCEPTED if status == InvitationStatus.ACCEPTED else RSVPStatus.DECLINED
    )
    participation.save(update_fields=["rsvp_status", "updated_at"])

    return invitation, participation
