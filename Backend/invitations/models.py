from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


class InvitationStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"


class Invitation(models.Model):
    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    invitee_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_invitations",
    )
    invitee_email = models.EmailField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=InvitationStatus.choices,
        default=InvitationStatus.PENDING,
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField()
    responded_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_invitations",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=("event", "status")), models.Index(fields=("expires_at",))]
        constraints = [
            models.CheckConstraint(
                name="invitation_target_present",
                condition=Q(invitee_user__isnull=False) | ~Q(invitee_email=""),
            ),
            models.UniqueConstraint(
                fields=("event", "invitee_user"),
                condition=Q(invitee_user__isnull=False),
                name="uniq_invite_user_per_event",
            ),
            models.UniqueConstraint(
                Lower("invitee_email"),
                "event",
                condition=~Q(invitee_email=""),
                name="uniq_invite_email_per_event",
            ),
        ]

    def is_expired(self) -> bool:
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Invitation({self.event_id}, {self.invitee_user_id or self.invitee_email}, {self.status})"
