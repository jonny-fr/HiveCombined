from django.conf import settings
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from events.models import (
    Comment,
    ContributionItem,
    CustomFieldDefinition,
    Document,
    Event,
    EventImage,
    Participation,
    Reaction,
)
from events.serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    ContributionItemSerializer,
    CustomFieldDefinitionSerializer,
    DocumentSerializer,
    EventImageSerializer,
    EventSerializer,
    ParticipationSerializer,
    ParticipationSelfUpdateSerializer,
    ReactionSerializer,
)
from events.services import (
    ensure_event_access,
    ensure_event_owner,
    events_visible_to_user,
    get_or_create_participation_for_user,
)


class EventListCreateView(generics.ListCreateAPIView):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Event.objects.none()
    filterset_fields = ("starts_at", "location")
    search_fields = ("title", "location")
    ordering_fields = ("starts_at", "created_at")

    def get_queryset(self):
        return events_visible_to_user(self.request.user)


class EventDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Event.objects.none()
    http_method_names = ["get", "patch"]

    def get_object(self):
        event = get_object_or_404(Event.objects.select_related("owner"), pk=self.kwargs["pk"])
        if self.request.method == "GET":
            ensure_event_access(event, self.request.user)
        else:
            ensure_event_owner(event, self.request.user)
        return event


class EventParticipantsView(generics.ListAPIView):
    serializer_class = ParticipationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ("rsvp_status",)
    queryset = Participation.objects.none()

    def get_queryset(self):
        event_id = self.kwargs.get("pk")
        if event_id is None:
            return Participation.objects.none()
        event = get_object_or_404(Event, pk=event_id)
        ensure_event_access(event, self.request.user)
        return (
            Participation.objects.filter(event=event)
            .select_related("user", "event")
            .prefetch_related("contributions", "custom_field_values__definition")
            .order_by("id")
        )


class EventMeView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ParticipationSelfUpdateSerializer

    def patch(self, request, pk):
        event = get_object_or_404(Event, pk=pk)
        ensure_event_access(event, request.user)
        participation = get_or_create_participation_for_user(event, request.user)

        serializer = self.get_serializer(participation, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        output = ParticipationSerializer(
            participation,
            context={"request": request},
        )
        return Response(output.data)


class EventContributionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ContributionItemSerializer
    queryset = ContributionItem.objects.none()

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["pk"])

    def get_queryset(self):
        event_id = self.kwargs.get("pk")
        if event_id is None:
            return ContributionItem.objects.none()
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        return (
            ContributionItem.objects.filter(event=event)
            .select_related("participation", "participation__user")
            .order_by("id")
        )

    def perform_create(self, serializer):
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        participation = self._resolve_participation(event, self.request.user, serializer.validated_data)
        serializer.save(event=event, participation=participation)

    def _resolve_participation(self, event, user, validated_data):
        requested_participation = validated_data.get("participation")
        if event.owner_id == user.id and requested_participation:
            if requested_participation.event_id != event.id:
                raise ValidationError({"participation": "Participation must belong to this event."})
            return requested_participation

        participation = get_or_create_participation_for_user(event, user)
        if requested_participation and requested_participation.id != participation.id:
            raise PermissionDenied("You can only create contributions for yourself.")
        return participation


class EventCustomFieldListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CustomFieldDefinitionSerializer
    queryset = CustomFieldDefinition.objects.none()

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["pk"])

    def get_queryset(self):
        event_id = self.kwargs.get("pk")
        if event_id is None:
            return CustomFieldDefinition.objects.none()
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        return event.custom_field_definitions.all().order_by("position", "id")

    def perform_create(self, serializer):
        event = self.get_event()
        ensure_event_owner(event, self.request.user)
        serializer.save(event=event)


# ---------------------------------------------------------------------------
# Priority 3 views — Comments, Reactions, Documents, Gallery
# All views check the corresponding feature flag before allowing access.
# ---------------------------------------------------------------------------


def _check_feature(flag_name: str, feature_label: str) -> None:
    """Raise 404 if the feature is disabled via settings."""
    if not getattr(settings, flag_name, False):
        from rest_framework.exceptions import NotFound

        raise NotFound(f"{feature_label} feature is not enabled.")


class EventCommentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Comment.objects.none()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CommentCreateSerializer
        return CommentSerializer

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["pk"])

    def get_queryset(self):
        _check_feature("FEATURE_COMMENTS_ENABLED", "Comments")
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        return (
            Comment.objects.filter(event=event, parent__isnull=True)
            .select_related("user")
            .prefetch_related("reactions__user", "replies")
            .annotate(_reply_count=Count("replies"))
            .order_by("created_at")
        )

    def perform_create(self, serializer):
        _check_feature("FEATURE_COMMENTS_ENABLED", "Comments")
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        parent = serializer.validated_data.get("parent")
        if parent and parent.event_id != event.id:
            raise ValidationError({"parent": "Parent comment must belong to this event."})
        serializer.save(event=event, user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        output = CommentSerializer(serializer.instance, context={"request": request})
        return Response(output.data, status=status.HTTP_201_CREATED)


class CommentReactionCreateView(generics.GenericAPIView):
    """POST to toggle a reaction on a comment. Same emoji = remove; new emoji = add."""

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ReactionSerializer

    def post(self, request, pk):
        _check_feature("FEATURE_REACTIONS_ENABLED", "Reactions")
        comment = get_object_or_404(Comment.objects.select_related("event"), pk=pk)
        ensure_event_access(comment.event, request.user)

        emoji = request.data.get("emoji", "").strip()
        if not emoji:
            raise ValidationError({"emoji": "This field is required."})

        existing = Reaction.objects.filter(comment=comment, user=request.user, emoji=emoji).first()
        if existing:
            existing.delete()
            return Response({"removed": True, "emoji": emoji}, status=status.HTTP_200_OK)

        reaction = Reaction.objects.create(comment=comment, user=request.user, emoji=emoji)
        return Response(ReactionSerializer(reaction).data, status=status.HTTP_201_CREATED)


class EventDocumentListCreateView(generics.ListCreateAPIView):
    """
    List and upload documents for an event.
    DEV_ONLY: Files stored under MEDIA_ROOT
    DOCKER_TARGET: storage (MinIO / S3)
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DocumentSerializer
    queryset = Document.objects.none()

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["pk"])

    def get_queryset(self):
        _check_feature("FEATURE_DOCUMENTS_ENABLED", "Documents")
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        return Document.objects.filter(event=event).select_related("uploaded_by").order_by("-created_at")

    def perform_create(self, serializer):
        _check_feature("FEATURE_DOCUMENTS_ENABLED", "Documents")
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        serializer.save(event=event, uploaded_by=self.request.user)


class EventGalleryListCreateView(generics.ListCreateAPIView):
    """
    List and upload images to the event gallery.
    DEV_ONLY: Images stored under MEDIA_ROOT
    DOCKER_TARGET: storage (MinIO / S3)
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = EventImageSerializer
    queryset = EventImage.objects.none()

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["pk"])

    def get_queryset(self):
        _check_feature("FEATURE_GALLERY_ENABLED", "Gallery")
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        return EventImage.objects.filter(event=event).select_related("uploaded_by").order_by("-created_at")

    def perform_create(self, serializer):
        _check_feature("FEATURE_GALLERY_ENABLED", "Gallery")
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        serializer.save(event=event, uploaded_by=self.request.user)
