from django.contrib import admin

from events.models import (
    Comment,
    ContributionItem,
    CustomFieldDefinition,
    CustomFieldValue,
    Document,
    Event,
    EventImage,
    Participation,
    Reaction,
)


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "owner", "location", "starts_at", "created_at")
    list_filter = ("starts_at",)
    search_fields = ("title", "location", "owner__username")
    raw_id_fields = ("owner",)


@admin.register(Participation)
class ParticipationAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "user", "rsvp_status", "plus_one_count", "created_at")
    list_filter = ("rsvp_status",)
    raw_id_fields = ("event", "user")


@admin.register(ContributionItem)
class ContributionItemAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "participation", "item_name", "quantity")
    raw_id_fields = ("event", "participation")


@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "key", "label", "field_type", "required", "position")
    list_filter = ("field_type", "required")
    raw_id_fields = ("event",)


@admin.register(CustomFieldValue)
class CustomFieldValueAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "participation", "definition", "value")
    raw_id_fields = ("event", "participation", "definition")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "user", "parent", "created_at")
    raw_id_fields = ("event", "user", "parent")


@admin.register(Reaction)
class ReactionAdmin(admin.ModelAdmin):
    list_display = ("id", "comment", "user", "emoji", "created_at")
    raw_id_fields = ("comment", "user")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "uploaded_by", "title", "created_at")
    raw_id_fields = ("event", "uploaded_by")


@admin.register(EventImage)
class EventImageAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "uploaded_by", "caption", "created_at")
    raw_id_fields = ("event", "uploaded_by")
