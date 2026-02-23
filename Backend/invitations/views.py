from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response

from events.models import Event
from events.serializers import ParticipationSerializer
from events.services import ensure_event_owner
from invitations.serializers import InviteBatchCreateSerializer, InviteRespondSerializer, InvitationSerializer
from invitations.services import create_invitations, respond_to_invitation


class EventInviteCreateView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InviteBatchCreateSerializer

    def post(self, request, pk):
        event = get_object_or_404(Event, pk=pk)
        ensure_event_owner(event, request.user)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created = create_invitations(
            event=event,
            created_by=request.user,
            emails=serializer.validated_data.get("emails"),
            user_ids=serializer.validated_data.get("user_ids"),
            expires_in_hours=serializer.validated_data.get("expires_in_hours"),
        )
        payload = [
            {
                "invitation": InvitationSerializer(entry["invitation"]).data,
                "token": entry["token"],
            }
            for entry in created
        ]
        return Response({"results": payload}, status=status.HTTP_201_CREATED)


class InviteRespondView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = InviteRespondSerializer

    def post(self, request, token):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitation, participation = respond_to_invitation(
            token=token,
            user=request.user,
            status=serializer.validated_data["status"],
        )
        return Response(
            {
                "invitation": InvitationSerializer(invitation).data,
                "participation": ParticipationSerializer(participation).data,
            },
            status=status.HTTP_200_OK,
        )
