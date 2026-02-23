from django.contrib import admin

from invitations.models import Invitation


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "invitee_user", "invitee_email", "status", "expires_at", "created_at")
    list_filter = ("status",)
    search_fields = ("invitee_email", "invitee_user__username")
    raw_id_fields = ("event", "invitee_user", "created_by")
