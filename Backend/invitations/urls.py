from django.urls import path

from invitations.views import EventInviteCreateView, InviteRespondView

urlpatterns = [
    path("events/<int:pk>/invites", EventInviteCreateView.as_view(), name="event-invites"),
    path("invites/<str:token>/respond", InviteRespondView.as_view(), name="invite-respond"),
]
