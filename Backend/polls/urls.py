from django.urls import path

from polls.views import EventPollListCreateView, PollResultsView, PollVoteView

urlpatterns = [
    path("events/<int:pk>/polls", EventPollListCreateView.as_view(), name="event-polls"),
    path("polls/<int:pk>/vote", PollVoteView.as_view(), name="poll-vote"),
    path("polls/<int:pk>/results", PollResultsView.as_view(), name="poll-results"),
]
