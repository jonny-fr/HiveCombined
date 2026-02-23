from rest_framework.permissions import BasePermission

from events.models import Event
from events.services import can_user_access_event, can_user_manage_event


class IsEventOwner(BasePermission):
    message = "Only the event owner can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Event):
            return can_user_manage_event(obj, request.user)
        return False


class IsEventMemberOrOwner(BasePermission):
    message = "You do not have access to this event."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, Event):
            return can_user_access_event(obj, request.user)
        return False
