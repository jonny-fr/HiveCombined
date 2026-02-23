from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from events.models import (
    Comment,
    ContributionItem,
    CustomFieldDefinition,
    CustomFieldType,
    CustomFieldValue,
    Document,
    Event,
    EventImage,
    Participation,
    Reaction,
)
from events.services import create_event, replace_contributions, save_custom_field_answers

User = get_user_model()


class EventOwnerSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")


class EventSerializer(serializers.ModelSerializer):
    owner = EventOwnerSerializer(read_only=True)

    class Meta:
        model = Event
        fields = (
            "id",
            "owner",
            "title",
            "description",
            "location",
            "starts_at",
            "ends_at",
            "dresscode",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner", "created_at", "updated_at")

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at is None:
            raise serializers.ValidationError({"starts_at": "This field is required."})
        if ends_at and ends_at < starts_at:
            raise serializers.ValidationError({"ends_at": "End time must not be before start time."})
        return attrs

    def create(self, validated_data):
        owner = self.context["request"].user
        return create_event(owner=owner, **validated_data)


class ParticipationUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")


class ContributionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionItem
        fields = ("id", "event", "participation", "item_name", "quantity", "notes", "created_at", "updated_at")
        read_only_fields = ("id", "event", "created_at", "updated_at")
        extra_kwargs = {
            "participation": {"required": False},
        }


class ContributionItemInputSerializer(serializers.Serializer):
    item_name = serializers.CharField(max_length=255)
    quantity = serializers.IntegerField(min_value=1, default=1)
    notes = serializers.CharField(allow_blank=True, required=False, default="")


class CustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDefinition
        fields = (
            "id",
            "event",
            "key",
            "label",
            "field_type",
            "required",
            "options",
            "position",
            "created_at",
        )
        read_only_fields = ("id", "event", "created_at")

    def validate(self, attrs):
        field_type = attrs.get("field_type", getattr(self.instance, "field_type", None))
        options = attrs.get("options", getattr(self.instance, "options", []))

        if field_type == CustomFieldType.ENUM:
            if not isinstance(options, list) or not options:
                raise serializers.ValidationError({"options": "Enum fields require non-empty options."})
            if not all(isinstance(value, str) and value.strip() for value in options):
                raise serializers.ValidationError({"options": "Each option must be a non-empty string."})
        elif options:
            raise serializers.ValidationError({"options": "Only enum fields may define options."})
        return attrs


class CustomFieldValueSerializer(serializers.ModelSerializer):
    definition_key = serializers.CharField(source="definition.key", read_only=True)

    class Meta:
        model = CustomFieldValue
        fields = ("id", "definition", "definition_key", "value")
        read_only_fields = ("id", "definition_key")


class ParticipationSerializer(serializers.ModelSerializer):
    user = ParticipationUserSerializer(read_only=True)
    contributions = ContributionItemSerializer(many=True, read_only=True)
    custom_field_values = CustomFieldValueSerializer(many=True, read_only=True)

    class Meta:
        model = Participation
        fields = (
            "id",
            "event",
            "user",
            "rsvp_status",
            "plus_one_count",
            "allergies",
            "notes",
            "dresscode_visible",
            "contributions",
            "custom_field_values",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "event",
            "user",
            "created_at",
            "updated_at",
            "contributions",
            "custom_field_values",
        )


class ParticipationSelfUpdateSerializer(serializers.ModelSerializer):
    contributions = ContributionItemInputSerializer(many=True, required=False)
    custom_field_answers = serializers.DictField(required=False)

    class Meta:
        model = Participation
        fields = (
            "rsvp_status",
            "plus_one_count",
            "allergies",
            "notes",
            "dresscode_visible",
            "contributions",
            "custom_field_answers",
        )
        extra_kwargs = {
            "rsvp_status": {"required": False},
            "plus_one_count": {"required": False},
            "allergies": {"required": False},
            "notes": {"required": False},
            "dresscode_visible": {"required": False},
        }

    def update(self, instance, validated_data):
        contributions = validated_data.pop("contributions", None)
        custom_field_answers = validated_data.pop("custom_field_answers", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if contributions is not None:
            replace_contributions(instance.event, instance, contributions)
        if custom_field_answers is not None:
            save_custom_field_answers(instance.event, instance, custom_field_answers)

        return instance


# ---------------------------------------------------------------------------
# Priority 3 serializers — Comments, Reactions, Documents, Gallery
# ---------------------------------------------------------------------------


class CommentUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username")


class ReactionSerializer(serializers.ModelSerializer):
    user = CommentUserSerializer(read_only=True)

    class Meta:
        model = Reaction
        fields = ("id", "comment", "user", "emoji", "created_at")
        read_only_fields = ("id", "comment", "user", "created_at")


class CommentSerializer(serializers.ModelSerializer):
    user = CommentUserSerializer(read_only=True)
    reactions = ReactionSerializer(many=True, read_only=True)
    reply_count = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = (
            "id",
            "event",
            "user",
            "parent",
            "text",
            "reactions",
            "reply_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "event", "user", "created_at", "updated_at")
        extra_kwargs = {"parent": {"required": False}}

    def get_reply_count(self, obj) -> int:
        return getattr(obj, "_reply_count", obj.replies.count())

    def validate_parent(self, value):
        if value and value.parent_id is not None:
            raise serializers.ValidationError("Nested replies beyond one level are not supported.")
        return value


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ("text", "parent")
        extra_kwargs = {"parent": {"required": False}}

    def validate_parent(self, value):
        if value and value.parent_id is not None:
            raise serializers.ValidationError("Nested replies beyond one level are not supported.")
        return value


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by = CommentUserSerializer(read_only=True)

    class Meta:
        model = Document
        fields = ("id", "event", "uploaded_by", "title", "file", "created_at")
        read_only_fields = ("id", "event", "uploaded_by", "created_at")


class EventImageSerializer(serializers.ModelSerializer):
    uploaded_by = CommentUserSerializer(read_only=True)

    class Meta:
        model = EventImage
        fields = ("id", "event", "uploaded_by", "image", "caption", "created_at")
        read_only_fields = ("id", "event", "uploaded_by", "created_at")
