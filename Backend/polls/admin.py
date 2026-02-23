from django.contrib import admin

from polls.models import Poll, PollOption, Vote


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ("id", "event", "question", "allows_multiple", "opens_at", "closes_at", "created_at")
    raw_id_fields = ("event", "created_by")


@admin.register(PollOption)
class PollOptionAdmin(admin.ModelAdmin):
    list_display = ("id", "poll", "label", "position")
    raw_id_fields = ("poll",)


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = ("id", "poll", "option", "user", "created_at")
    raw_id_fields = ("poll", "option", "participation", "user")
