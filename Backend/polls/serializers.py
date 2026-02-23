from rest_framework import serializers

from polls.models import Poll, PollOption, Vote


class PollOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PollOption
        fields = ("id", "label", "position", "created_at")
        read_only_fields = ("id", "created_at")


class PollSerializer(serializers.ModelSerializer):
    options = PollOptionSerializer(many=True)

    class Meta:
        model = Poll
        fields = (
            "id",
            "event",
            "question",
            "allows_multiple",
            "opens_at",
            "closes_at",
            "options",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "event", "created_at", "updated_at")

    def validate(self, attrs):
        opens_at = attrs.get("opens_at")
        closes_at = attrs.get("closes_at")
        if opens_at and closes_at and closes_at < opens_at:
            raise serializers.ValidationError({"closes_at": "Close time must not be before open time."})
        return attrs


class VoteInputSerializer(serializers.Serializer):
    option_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )


class VoteResponseSerializer(serializers.Serializer):
    poll_id = serializers.IntegerField(min_value=1)
    selected_option_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )


class PollResultOptionSerializer(serializers.Serializer):
    id = serializers.IntegerField(min_value=1)
    label = serializers.CharField()
    vote_count = serializers.IntegerField(min_value=0)


class PollResultsSerializer(serializers.Serializer):
    poll_id = serializers.IntegerField(min_value=1)
    question = serializers.CharField()
    allows_multiple = serializers.BooleanField()
    total_votes = serializers.IntegerField(min_value=0)
    unique_voters = serializers.IntegerField(min_value=0)
    options = PollResultOptionSerializer(many=True)


class VoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vote
        fields = ("id", "poll", "option", "participation", "user", "created_at")
        read_only_fields = fields
