from django.urls import path

from events.views import (
    CommentReactionCreateView,
    EventCommentListCreateView,
    EventContributionListCreateView,
    EventCustomFieldListCreateView,
    EventDetailView,
    EventDocumentListCreateView,
    EventGalleryListCreateView,
    EventListCreateView,
    EventMeView,
    EventParticipantsView,
)

urlpatterns = [
    path("events", EventListCreateView.as_view(), name="event-list-create"),
    path("events/<int:pk>", EventDetailView.as_view(), name="event-detail"),
    path("events/<int:pk>/participants", EventParticipantsView.as_view(), name="event-participants"),
    path("events/<int:pk>/me", EventMeView.as_view(), name="event-me"),
    path("events/<int:pk>/contributions", EventContributionListCreateView.as_view(), name="event-contributions"),
    path("events/<int:pk>/custom-fields", EventCustomFieldListCreateView.as_view(), name="event-custom-fields"),
    # Priority 3 endpoints
    path("events/<int:pk>/comments", EventCommentListCreateView.as_view(), name="event-comments"),
    path("comments/<int:pk>/reactions", CommentReactionCreateView.as_view(), name="comment-reactions"),
    path("events/<int:pk>/documents", EventDocumentListCreateView.as_view(), name="event-documents"),
    path("events/<int:pk>/gallery", EventGalleryListCreateView.as_view(), name="event-gallery"),
]
