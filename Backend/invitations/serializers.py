from django.contrib.auth import get_user_model
from rest_framework import serializers

from invitations.models import Invitation, InvitationStatus

User = get_user_model()


class InvitationUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")


class InvitationSerializer(serializers.ModelSerializer):
    invitee_user = InvitationUserSerializer(read_only=True)

    class Meta:
        model = Invitation
        fields = (
            "id",
            "event",
            "invitee_user",
            "invitee_email",
            "status",
            "expires_at",
            "responded_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class InviteBatchCreateSerializer(serializers.Serializer):
    emails = serializers.ListField(
        child=serializers.EmailField(),
        required=False,
        allow_empty=False,
    )
    user_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    expires_in_hours = serializers.IntegerField(min_value=1, max_value=24 * 90, required=False)

    def validate(self, attrs):
        if not attrs.get("emails") and not attrs.get("user_ids"):
            raise serializers.ValidationError("Provide at least one email or user id.")
        return attrs


class InviteRespondSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[InvitationStatus.ACCEPTED, InvitationStatus.DECLINED],
    )
