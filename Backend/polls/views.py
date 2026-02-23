from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from events.models import Event
from events.services import ensure_event_access, ensure_event_owner
from polls.models import Poll
from polls.serializers import PollResultsSerializer, PollSerializer, VoteInputSerializer, VoteResponseSerializer
from polls.services import cast_vote, create_poll_with_options, get_poll_results


class EventPollListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PollSerializer
    queryset = Poll.objects.none()

    def get_event(self):
        return get_object_or_404(Event, pk=self.kwargs["pk"])

    def get_queryset(self):
        event_id = self.kwargs.get("pk")
        if event_id is None:
            return Poll.objects.none()
        event = self.get_event()
        ensure_event_access(event, self.request.user)
        return Poll.objects.filter(event=event).prefetch_related("options").order_by("id")

    def create(self, request, *args, **kwargs):
        event = self.get_event()
        ensure_event_owner(event, request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        poll_data = serializer.validated_data.copy()
        options_data = poll_data.pop("options", [])
        poll = create_poll_with_options(
            event=event,
            created_by=request.user,
            poll_data=poll_data,
            options_data=options_data,
        )
        output = self.get_serializer(poll)
        return Response(output.data, status=status.HTTP_201_CREATED)


class PollVoteView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VoteInputSerializer

    @extend_schema(
        request=VoteInputSerializer,
        responses={200: VoteResponseSerializer},
    )
    def post(self, request, pk):
        poll = get_object_or_404(Poll.objects.select_related("event"), pk=pk)
        ensure_event_access(poll.event, request.user)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        votes = cast_vote(
            poll=poll,
            user=request.user,
            option_ids=serializer.validated_data["option_ids"],
        )
        payload = {
            "poll_id": poll.id,
            "selected_option_ids": [vote.option_id for vote in votes],
        }
        output = VoteResponseSerializer(payload)
        return Response(output.data, status=status.HTTP_200_OK)


class PollResultsView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PollResultsSerializer

    @extend_schema(responses={200: PollResultsSerializer})
    def get(self, request, pk):
        poll = get_object_or_404(Poll.objects.select_related("event"), pk=pk)
        ensure_event_access(poll.event, request.user)
        payload = get_poll_results(poll)
        output = self.get_serializer(payload)
        return Response(output.data, status=status.HTTP_200_OK)
