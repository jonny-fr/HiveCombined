from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q


class Event(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_events",
    )
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True, help_text="Detailed event description (Markdown allowed).")
    location = models.CharField(max_length=255)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(blank=True, null=True)
    dresscode = models.CharField(max_length=255, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("starts_at", "-created_at")
        constraints = [
            models.CheckConstraint(
                name="event_end_after_start",
                condition=Q(ends_at__isnull=True) | Q(ends_at__gte=F("starts_at")),
            )
        ]
        indexes = [
            models.Index(fields=("owner",)),
            models.Index(fields=("starts_at",)),
        ]

    def __str__(self):
        return self.title or f"Event @ {self.location} ({self.starts_at.isoformat()})"


class RSVPStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"


class Participation(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="participations")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="participations",
    )
    rsvp_status = models.CharField(
        max_length=16,
        choices=RSVPStatus.choices,
        default=RSVPStatus.PENDING,
    )
    plus_one_count = models.PositiveSmallIntegerField(default=0)
    allergies = models.CharField(max_length=500, blank=True)
    notes = models.TextField(blank=True)
    dresscode_visible = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("event_id", "user_id")
        constraints = [
            models.UniqueConstraint(fields=("event", "user"), name="uniq_participation_event_user")
        ]
        indexes = [
            models.Index(fields=("event", "rsvp_status")),
            models.Index(fields=("user",)),
        ]

    def __str__(self):
        return f"{self.user_id}:{self.event_id}:{self.rsvp_status}"


class ContributionItem(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="contributions")
    participation = models.ForeignKey(
        Participation,
        on_delete=models.CASCADE,
        related_name="contributions",
    )
    item_name = models.CharField(max_length=255)
    quantity = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("event_id", "item_name")
        indexes = [models.Index(fields=("event", "participation"))]
        constraints = [
            models.CheckConstraint(name="contribution_positive_quantity", condition=Q(quantity__gt=0))
        ]

    def clean(self):
        if self.participation_id and self.event_id and self.participation.event_id != self.event_id:
            raise ValidationError("Contribution participation must belong to the same event.")

    def __str__(self):
        return f"{self.item_name} x {self.quantity}"


class CustomFieldType(models.TextChoices):
    TEXT = "text", "Text"
    NUMBER = "number", "Number"
    BOOL = "bool", "Boolean"
    ENUM = "enum", "Enum"


class CustomFieldDefinition(models.Model):
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="custom_field_definitions",
    )
    key = models.SlugField(max_length=64)
    label = models.CharField(max_length=120)
    field_type = models.CharField(max_length=16, choices=CustomFieldType.choices)
    required = models.BooleanField(default=False)
    options = models.JSONField(default=list, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("position", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("event", "key"),
                name="uniq_custom_field_key_per_event",
            )
        ]
        indexes = [models.Index(fields=("event",))]

    def clean(self):
        if self.field_type == CustomFieldType.ENUM:
            if not isinstance(self.options, list) or not self.options:
                raise ValidationError("Enum fields require a non-empty options list.")
            if not all(isinstance(item, str) and item.strip() for item in self.options):
                raise ValidationError("Enum options must be non-empty strings.")
        elif self.options:
            raise ValidationError("Only enum fields can define options.")

    def __str__(self):
        return f"{self.event_id}:{self.key}"


class CustomFieldValue(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="custom_field_values")
    participation = models.ForeignKey(
        Participation,
        on_delete=models.CASCADE,
        related_name="custom_field_values",
    )
    definition = models.ForeignKey(
        CustomFieldDefinition,
        on_delete=models.CASCADE,
        related_name="values",
    )
    value = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("definition", "participation"),
                name="uniq_custom_field_answer_per_participant",
            ),
        ]
        indexes = [
            models.Index(fields=("event",)),
            models.Index(fields=("event", "participation")),
        ]

    def clean(self):
        if self.participation_id and self.event_id and self.participation.event_id != self.event_id:
            raise ValidationError("Custom field value participation must belong to the same event.")
        if self.definition_id and self.event_id and self.definition.event_id != self.event_id:
            raise ValidationError("Custom field value definition must belong to the same event.")

    def is_empty(self) -> bool:
        return self.value in ("", None)

    def __str__(self):
        return f"{self.definition.key}={self.value!r}"


# ---------------------------------------------------------------------------
# Priority 3 models — Comments, Reactions, Documents, Gallery
# These are feature-flagged via settings.FEATURE_*_ENABLED and can be
# toggled off without removing code.
# ---------------------------------------------------------------------------


class Comment(models.Model):
    """Threaded comments on an event. Supports single-level nesting via parent."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_comments",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="replies",
    )
    text = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        indexes = [
            models.Index(fields=("event",)),
            models.Index(fields=("event", "parent")),
        ]

    def clean(self):
        if self.parent_id and self.parent.event_id != self.event_id:
            raise ValidationError("Reply must belong to the same event as the parent comment.")

    def __str__(self):
        return f"Comment({self.id}, event={self.event_id}, user={self.user_id})"


class Reaction(models.Model):
    """Emoji reaction on a comment. One reaction type per user per comment."""

    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name="reactions")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="event_reactions",
    )
    emoji = models.CharField(max_length=32, help_text="Emoji shortcode, e.g. 👍 or :thumbsup:")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("comment", "user", "emoji"), name="uniq_reaction_per_user_emoji"),
        ]
        indexes = [models.Index(fields=("comment",))]

    def __str__(self):
        return f"Reaction({self.emoji}, comment={self.comment_id}, user={self.user_id})"


def _document_upload_path(instance, filename):
    return f"events/{instance.event_id}/documents/{filename}"


class Document(models.Model):
    """
    File attachment on an event (checklists, PDFs, etc.).
    DEV_ONLY: Files stored under MEDIA_ROOT/events/<id>/documents/
    DOCKER_TARGET: storage (MinIO / S3 bucket)
    """

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="documents")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_documents",
    )
    title = models.CharField(max_length=255, blank=True)
    file = models.FileField(upload_to=_document_upload_path)  # DEV_ONLY: local; DOCKER_TARGET: S3/MinIO
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("event",))]

    def __str__(self):
        return self.title or self.file.name


def _gallery_upload_path(instance, filename):
    return f"events/{instance.event_id}/gallery/{filename}"


class EventImage(models.Model):
    """
    Shared image in event gallery.
    DEV_ONLY: Files stored under MEDIA_ROOT/events/<id>/gallery/
    DOCKER_TARGET: storage (MinIO / S3 bucket)
    """

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="images")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_images",
    )
    image = models.ImageField(upload_to=_gallery_upload_path)  # DEV_ONLY: local; DOCKER_TARGET: S3/MinIO
    caption = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("event",))]

    def __str__(self):
        return self.caption or self.image.name
