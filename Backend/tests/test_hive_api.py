from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.utils import timezone
from rest_framework.test import APIClient

from events.models import Comment, CustomFieldValue, Document, Event, EventImage, Participation, Reaction, RSVPStatus
from invitations.models import Invitation
from polls.models import Vote, VoteSubmission

User = get_user_model()


def _iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


@pytest.mark.django_db
def test_event_create_validation_and_owner_only_update():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@example.com")
    other = User.objects.create_user(username="other", password="password123", email="other@example.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    starts_at = timezone.now() + timedelta(days=1)
    create_response = client.post(
        "/api/events",
        {
            "title": "Hive Meetup",
            "location": "Berlin",
            "starts_at": _iso(starts_at),
        },
        format="json",
    )
    assert create_response.status_code == 201
    event_id = create_response.data["id"]

    missing_fields_response = client.post("/api/events", {"title": "Missing"}, format="json")
    assert missing_fields_response.status_code == 400

    update_owner_response = client.patch(
        f"/api/events/{event_id}",
        {"location": "Hamburg"},
        format="json",
    )
    assert update_owner_response.status_code == 200
    assert update_owner_response.data["location"] == "Hamburg"

    client.force_authenticate(user=other)
    update_other_response = client.patch(
        f"/api/events/{event_id}",
        {"location": "Munich"},
        format="json",
    )
    assert update_other_response.status_code == 403


@pytest.mark.django_db
def test_invite_token_accept_decline_and_expiry():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@example.com")
    invitee = User.objects.create_user(
        username="invitee",
        password="password123",
        email="invitee@example.com",
    )

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)

    event = Event.objects.create(
        owner=owner,
        location="Event Hall",
        starts_at=timezone.now() + timedelta(days=2),
    )
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    invite_response = owner_client.post(
        f"/api/events/{event.id}/invites",
        {"emails": [invitee.email]},
        format="json",
    )
    assert invite_response.status_code == 201
    token = invite_response.data["results"][0]["token"]

    invitee_client = APIClient()
    invitee_client.force_authenticate(user=invitee)
    accept_response = invitee_client.post(
        f"/api/invites/{token}/respond",
        {"status": "accepted"},
        format="json",
    )
    assert accept_response.status_code == 200
    assert accept_response.data["invitation"]["status"] == "accepted"
    assert accept_response.data["participation"]["rsvp_status"] == "accepted"

    # Token responses are idempotent in this MVP.
    accept_again_response = invitee_client.post(
        f"/api/invites/{token}/respond",
        {"status": "accepted"},
        format="json",
    )
    assert accept_again_response.status_code == 200

    decline_response = invitee_client.post(
        f"/api/invites/{token}/respond",
        {"status": "declined"},
        format="json",
    )
    assert decline_response.status_code == 200
    assert decline_response.data["invitation"]["status"] == "declined"
    assert decline_response.data["participation"]["rsvp_status"] == "declined"

    invitation = Invitation.objects.get(event=event, invitee_email=invitee.email.lower())
    invitation.expires_at = timezone.now() - timedelta(minutes=1)
    invitation.save(update_fields=["expires_at", "updated_at"])
    expired_response = invitee_client.post(
        f"/api/invites/{token}/respond",
        {"status": "declined"},
        format="json",
    )
    assert expired_response.status_code == 400


@pytest.mark.django_db
def test_participant_self_update_including_contributions_and_custom_answers():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@example.com")
    guest = User.objects.create_user(username="guest", password="password123", email="guest@example.com")

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    event = Event.objects.create(
        owner=owner,
        location="Backyard",
        starts_at=timezone.now() + timedelta(days=5),
    )
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)
    invite = owner_client.post(
        f"/api/events/{event.id}/invites",
        {"user_ids": [guest.id]},
        format="json",
    )
    token = invite.data["results"][0]["token"]

    guest_client = APIClient()
    guest_client.force_authenticate(user=guest)
    guest_client.post(f"/api/invites/{token}/respond", {"status": "accepted"}, format="json")

    field_response = owner_client.post(
        f"/api/events/{event.id}/custom-fields",
        {
            "key": "drink_preference",
            "label": "Drink preference",
            "field_type": "enum",
            "required": True,
            "options": ["water", "juice"],
        },
        format="json",
    )
    assert field_response.status_code == 201

    me_response = guest_client.patch(
        f"/api/events/{event.id}/me",
        {
            "rsvp_status": "accepted",
            "plus_one_count": 1,
            "allergies": "Peanuts",
            "contributions": [{"item_name": "Chips", "quantity": 2, "notes": "Salted"}],
            "custom_field_answers": {"drink_preference": "juice"},
        },
        format="json",
    )
    assert me_response.status_code == 200
    assert me_response.data["plus_one_count"] == 1
    assert me_response.data["allergies"] == "Peanuts"
    assert len(me_response.data["contributions"]) == 1

    participation = Participation.objects.get(event=event, user=guest)
    value = CustomFieldValue.objects.get(event=event, participation=participation)
    assert value.definition.key == "drink_preference"
    assert value.value == "juice"


@pytest.mark.django_db
def test_poll_voting_constraints_single_vs_multiple_choice():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@example.com")
    voter = User.objects.create_user(username="voter", password="password123", email="voter@example.com")

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    voter_client = APIClient()
    voter_client.force_authenticate(user=voter)

    event = Event.objects.create(
        owner=owner,
        location="Loft",
        starts_at=timezone.now() + timedelta(days=3),
    )
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    invite_response = owner_client.post(
        f"/api/events/{event.id}/invites",
        {"user_ids": [voter.id]},
        format="json",
    )
    token = invite_response.data["results"][0]["token"]
    voter_client.post(f"/api/invites/{token}/respond", {"status": "accepted"}, format="json")

    single_poll_response = owner_client.post(
        f"/api/events/{event.id}/polls",
        {
            "question": "Pizza choice",
            "allows_multiple": False,
            "options": [{"label": "Margherita"}, {"label": "Pepperoni"}],
        },
        format="json",
    )
    assert single_poll_response.status_code == 201
    single_poll_id = single_poll_response.data["id"]
    option_ids = [option["id"] for option in single_poll_response.data["options"]]

    single_vote_ok = voter_client.post(
        f"/api/polls/{single_poll_id}/vote",
        {"option_ids": [option_ids[0]]},
        format="json",
    )
    assert single_vote_ok.status_code == 200

    single_vote_invalid = voter_client.post(
        f"/api/polls/{single_poll_id}/vote",
        {"option_ids": option_ids},
        format="json",
    )
    assert single_vote_invalid.status_code == 400

    single_vote_replace = voter_client.post(
        f"/api/polls/{single_poll_id}/vote",
        {"option_ids": [option_ids[1]]},
        format="json",
    )
    assert single_vote_replace.status_code == 400
    assert single_vote_replace.data["error"]["detail"]["vote"][0] == "already voted"
    assert Vote.objects.filter(poll_id=single_poll_id, user=voter).count() == 1

    multi_poll_response = owner_client.post(
        f"/api/events/{event.id}/polls",
        {
            "question": "Bring games",
            "allows_multiple": True,
            "options": [{"label": "Cards"}, {"label": "Chess"}, {"label": "Catan"}],
        },
        format="json",
    )
    assert multi_poll_response.status_code == 201
    multi_poll_id = multi_poll_response.data["id"]
    multi_option_ids = [option["id"] for option in multi_poll_response.data["options"]]

    multi_vote_response = voter_client.post(
        f"/api/polls/{multi_poll_id}/vote",
        {"option_ids": multi_option_ids[:2]},
        format="json",
    )
    assert multi_vote_response.status_code == 200
    assert Vote.objects.filter(poll_id=multi_poll_id, user=voter).count() == 2

    multi_vote_again = voter_client.post(
        f"/api/polls/{multi_poll_id}/vote",
        {"option_ids": [multi_option_ids[2]]},
        format="json",
    )
    assert multi_vote_again.status_code == 400
    assert multi_vote_again.data["error"]["detail"]["vote"][0] == "already voted"
    assert Vote.objects.filter(poll_id=multi_poll_id, user=voter).count() == 2


@pytest.mark.django_db
def test_vote_submission_unique_constraint_blocks_duplicate_submission_rows():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@example.com")
    event = Event.objects.create(
        owner=owner,
        location="Loft",
        starts_at=timezone.now() + timedelta(days=3),
    )
    participation = Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)
    poll = event.polls.create(question="One-time vote", created_by=owner)

    VoteSubmission.objects.create(poll=poll, participation=participation, user=owner)
    with pytest.raises(IntegrityError):
        VoteSubmission.objects.create(poll=poll, participation=participation, user=owner)


# ---------------------------------------------------------------------------
# Auth & Registration Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_register_and_login():
    client = APIClient()

    reg = client.post(
        "/api/auth/register",
        {"username": "newuser", "email": "new@example.com", "password": "securepass123"},
        format="json",
    )
    assert reg.status_code == 201
    assert reg.data["username"] == "newuser"
    assert "password" not in reg.data

    login = client.post(
        "/api/auth/token",
        {"username": "newuser", "password": "securepass123"},
        format="json",
    )
    assert login.status_code == 200
    assert "access" in login.data
    assert "refresh" in login.data

    refresh = client.post(
        "/api/auth/token/refresh",
        {"refresh": login.data["refresh"]},
        format="json",
    )
    assert refresh.status_code == 200
    assert "access" in refresh.data


@pytest.mark.django_db
def test_register_duplicate_username():
    client = APIClient()
    User.objects.create_user(username="taken", password="password123")
    reg = client.post(
        "/api/auth/register",
        {"username": "taken", "email": "x@example.com", "password": "securepass123"},
        format="json",
    )
    assert reg.status_code == 400


@pytest.mark.django_db
def test_unauthenticated_access_denied():
    client = APIClient()
    response = client.get("/api/events")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Event Visibility Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_event_visible_only_to_owner_and_participants():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@x.com")
    stranger = User.objects.create_user(username="stranger", password="password123", email="stranger@x.com")

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    stranger_client = APIClient()
    stranger_client.force_authenticate(user=stranger)

    starts_at = timezone.now() + timedelta(days=1)
    ev = owner_client.post(
        "/api/events",
        {"title": "Private Party", "location": "Home", "starts_at": _iso(starts_at)},
        format="json",
    )
    assert ev.status_code == 201
    event_id = ev.data["id"]

    # Owner can see the event
    assert owner_client.get(f"/api/events/{event_id}").status_code == 200

    # Stranger cannot see the event
    assert stranger_client.get(f"/api/events/{event_id}").status_code == 403

    # Stranger's event list should not include it
    stranger_list = stranger_client.get("/api/events")
    assert stranger_list.status_code == 200
    assert all(e["id"] != event_id for e in stranger_list.data["results"])


# ---------------------------------------------------------------------------
# Event Description Field Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_event_description_field():
    owner = User.objects.create_user(username="owner", password="password123", email="owner@x.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    starts_at = timezone.now() + timedelta(days=1)
    ev = client.post(
        "/api/events",
        {
            "title": "Described Event",
            "description": "A long description of the event.",
            "location": "Berlin",
            "starts_at": _iso(starts_at),
        },
        format="json",
    )
    assert ev.status_code == 201
    assert ev.data["description"] == "A long description of the event."

    patch = client.patch(
        f"/api/events/{ev.data['id']}",
        {"description": "Updated description."},
        format="json",
    )
    assert patch.status_code == 200
    assert patch.data["description"] == "Updated description."


# ---------------------------------------------------------------------------
# Invitation Permission Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_non_owner_cannot_create_invites():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    other = User.objects.create_user(username="other", password="password123", email="other@x.com")

    event = Event.objects.create(owner=owner, location="Somewhere", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    # Invite other first so they can access the event
    other_client = APIClient()
    other_client.force_authenticate(user=other)
    resp = other_client.post(
        f"/api/events/{event.id}/invites",
        {"emails": ["random@x.com"]},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_wrong_user_cannot_respond_to_targeted_invite():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    intended = User.objects.create_user(username="intended", password="password123", email="intended@x.com")
    intruder = User.objects.create_user(username="intruder", password="password123", email="intruder@x.com")

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)

    event = Event.objects.create(owner=owner, location="Hall", starts_at=timezone.now() + timedelta(days=2))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    invite = owner_client.post(
        f"/api/events/{event.id}/invites",
        {"user_ids": [intended.id]},
        format="json",
    )
    token = invite.data["results"][0]["token"]

    intruder_client = APIClient()
    intruder_client.force_authenticate(user=intruder)
    resp = intruder_client.post(
        f"/api/invites/{token}/respond",
        {"status": "accepted"},
        format="json",
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Comment Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_comment_crud_and_replies():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    guest = User.objects.create_user(username="guest", password="password123", email="g@x.com")

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    guest_client = APIClient()
    guest_client.force_authenticate(user=guest)

    event = Event.objects.create(owner=owner, location="Café", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    # Invite guest
    invite = owner_client.post(f"/api/events/{event.id}/invites", {"user_ids": [guest.id]}, format="json")
    token = invite.data["results"][0]["token"]
    guest_client.post(f"/api/invites/{token}/respond", {"status": "accepted"}, format="json")

    # Owner posts a comment
    comment_resp = owner_client.post(
        f"/api/events/{event.id}/comments",
        {"text": "Welcome everyone!"},
        format="json",
    )
    assert comment_resp.status_code == 201
    comment_id = comment_resp.data["id"]
    assert comment_resp.data["text"] == "Welcome everyone!"
    assert comment_resp.data["user"]["username"] == "owner"

    # Guest replies
    reply_resp = guest_client.post(
        f"/api/events/{event.id}/comments",
        {"text": "Thanks!", "parent": comment_id},
        format="json",
    )
    assert reply_resp.status_code == 201
    assert reply_resp.data["parent"] == comment_id

    # List comments (only top-level)
    list_resp = owner_client.get(f"/api/events/{event.id}/comments")
    assert list_resp.status_code == 200
    assert list_resp.data["count"] >= 1

    # Stranger cannot see comments
    stranger = User.objects.create_user(username="stranger", password="password123", email="s@x.com")
    stranger_client = APIClient()
    stranger_client.force_authenticate(user=stranger)
    assert stranger_client.get(f"/api/events/{event.id}/comments").status_code == 403


# ---------------------------------------------------------------------------
# Reaction Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_reaction_toggle():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    event = Event.objects.create(owner=owner, location="Park", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    comment = Comment.objects.create(event=event, user=owner, text="Great event!")

    # Add reaction
    add = client.post(f"/api/comments/{comment.id}/reactions", {"emoji": "👍"}, format="json")
    assert add.status_code == 201

    # Toggle same reaction off
    remove = client.post(f"/api/comments/{comment.id}/reactions", {"emoji": "👍"}, format="json")
    assert remove.status_code == 200
    assert remove.data["removed"] is True

    # Missing emoji field
    bad = client.post(f"/api/comments/{comment.id}/reactions", {}, format="json")
    assert bad.status_code == 400


# ---------------------------------------------------------------------------
# Document Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_document_list_and_upload(tmp_path):
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    event = Event.objects.create(owner=owner, location="Office", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    # List (empty)
    list_resp = client.get(f"/api/events/{event.id}/documents")
    assert list_resp.status_code == 200
    assert list_resp.data["count"] == 0

    # Upload
    from django.core.files.uploadedfile import SimpleUploadedFile

    test_file = SimpleUploadedFile("checklist.txt", b"Item 1\nItem 2\n", content_type="text/plain")
    upload_resp = client.post(
        f"/api/events/{event.id}/documents",
        {"title": "Checklist", "file": test_file},
        format="multipart",
    )
    assert upload_resp.status_code == 201
    assert upload_resp.data["title"] == "Checklist"
    assert Document.objects.filter(event=event).count() == 1


# ---------------------------------------------------------------------------
# Gallery Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_gallery_list_and_upload(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    event = Event.objects.create(owner=owner, location="Beach", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    # List (empty)
    list_resp = client.get(f"/api/events/{event.id}/gallery")
    assert list_resp.status_code == 200
    assert list_resp.data["count"] == 0

    # Upload an image (create a minimal valid PNG)
    from django.core.files.uploadedfile import SimpleUploadedFile

    # Minimal 1x1 red PNG
    import struct
    import zlib

    def _make_png():
        signature = b"\x89PNG\r\n\x1a\n"

        def chunk(chunk_type, data):
            c = chunk_type + data
            return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

        ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
        raw_data = b"\x00\xff\x00\x00"  # filter byte + 1 RGB pixel
        idat = zlib.compress(raw_data)
        return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

    png_data = _make_png()
    test_image = SimpleUploadedFile("sunset.png", png_data, content_type="image/png")
    upload_resp = client.post(
        f"/api/events/{event.id}/gallery",
        {"caption": "Sunset", "image": test_image},
        format="multipart",
    )
    assert upload_resp.status_code == 201
    assert upload_resp.data["caption"] == "Sunset"
    assert EventImage.objects.filter(event=event).count() == 1


# ---------------------------------------------------------------------------
# Custom Field Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_custom_field_enum_validation():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    event = Event.objects.create(owner=owner, location="Hall", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    # Enum field must have options
    bad = client.post(
        f"/api/events/{event.id}/custom-fields",
        {"key": "color", "label": "Color", "field_type": "enum", "required": True, "options": []},
        format="json",
    )
    assert bad.status_code == 400

    # Non-enum field must not have options
    bad2 = client.post(
        f"/api/events/{event.id}/custom-fields",
        {"key": "name", "label": "Name", "field_type": "text", "options": ["a"]},
        format="json",
    )
    assert bad2.status_code == 400


# ---------------------------------------------------------------------------
# Poll Results Test
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_poll_results():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    voter = User.objects.create_user(username="voter", password="password123", email="v@x.com")

    owner_client = APIClient()
    owner_client.force_authenticate(user=owner)
    voter_client = APIClient()
    voter_client.force_authenticate(user=voter)

    event = Event.objects.create(owner=owner, location="Loft", starts_at=timezone.now() + timedelta(days=3))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    invite = owner_client.post(f"/api/events/{event.id}/invites", {"user_ids": [voter.id]}, format="json")
    token = invite.data["results"][0]["token"]
    voter_client.post(f"/api/invites/{token}/respond", {"status": "accepted"}, format="json")

    poll = owner_client.post(
        f"/api/events/{event.id}/polls",
        {"question": "Best day?", "allows_multiple": False, "options": [{"label": "Mon"}, {"label": "Tue"}]},
        format="json",
    )
    poll_id = poll.data["id"]
    option_ids = [o["id"] for o in poll.data["options"]]

    voter_client.post(f"/api/polls/{poll_id}/vote", {"option_ids": [option_ids[0]]}, format="json")

    results = owner_client.get(f"/api/polls/{poll_id}/results")
    assert results.status_code == 200
    assert results.data["total_votes"] == 1
    assert results.data["unique_voters"] == 1
    assert results.data["options"][0]["vote_count"] == 1


# ---------------------------------------------------------------------------
# Contribution Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_contribution_list():
    owner = User.objects.create_user(username="owner", password="password123", email="o@x.com")
    client = APIClient()
    client.force_authenticate(user=owner)

    event = Event.objects.create(owner=owner, location="BBQ", starts_at=timezone.now() + timedelta(days=1))
    Participation.objects.create(event=event, user=owner, rsvp_status=RSVPStatus.ACCEPTED)

    client.post(
        f"/api/events/{event.id}/contributions",
        {"item_name": "Drinks", "quantity": 6},
        format="json",
    )
    resp = client.get(f"/api/events/{event.id}/contributions")
    assert resp.status_code == 200
    assert resp.data["count"] >= 1
