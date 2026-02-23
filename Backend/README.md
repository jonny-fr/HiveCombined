# Hive Backend (Django + DRF Monolith)

MVP backend for Hive event planning. This repository contains a single Django deployable with DRF APIs for:

- events
- invitations + RSVP
- participant self-management (+1, allergies, notes)
- contribution tracking ("who brings what")
- event-defined custom fields + participant answers
- polls + voting + results

Frontend/UI is intentionally minimal priority; this API is designed for a React client.

## Stack

- Django 6
- Django REST Framework
- JWT auth via `djangorestframework-simplejwt`
- OpenAPI schema via `drf-spectacular`
- Filtering/pagination via DRF + `django-filter`

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver
```

Default settings module: `hive.settings.dev`.

## Security + Auth

- Secrets are read from environment variables (`.env` in local dev).
- JWT is used for SPA compatibility.
- Recommended React token handling:
  - keep access token in memory (not localStorage if possible)
  - rotate refresh token with secure/httpOnly cookie in production edge layer
- Object-level access is enforced in service/endpoint checks:
  - only event owner can edit event/invites/custom-fields/polls
  - only members/invitees can view event resources
  - invite token response requires authenticated user matching invite target
- Invite tokens are stored hashed (SHA-256) and never persisted in plaintext.

## Data Model Notes

Implemented entities:

- `Event`
- `Invitation`
- `Participation`
- `ContributionItem`
- `CustomFieldDefinition`
- `CustomFieldValue`
- `Poll`
- `PollOption`
- `Vote`

Custom fields approach:

- Event owners define schema with `CustomFieldDefinition`.
- Values are stored per `(event, participant, definition)` in `CustomFieldValue`.
- `value` is JSON and validated against field type (`text/number/bool/enum`) at write time.

## API Routes

All routes are under `/api`.

- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/token`
  - `POST /api/auth/token/refresh`
- Events:
  - `POST /api/events`
  - `GET /api/events`
  - `GET /api/events/{id}`
  - `PATCH /api/events/{id}`
  - `GET /api/events/{id}/participants`
- Invitations:
  - `POST /api/events/{id}/invites`
  - `POST /api/invites/{token}/respond`
- Participation:
  - `PATCH /api/events/{id}/me`
- Contributions:
  - `GET /api/events/{id}/contributions`
  - `POST /api/events/{id}/contributions`
- Custom fields:
  - `GET /api/events/{id}/custom-fields`
  - `POST /api/events/{id}/custom-fields`
- Polls:
  - `GET /api/events/{id}/polls`
  - `POST /api/events/{id}/polls`
  - `POST /api/polls/{id}/vote`
  - `GET /api/polls/{id}/results`
- OpenAPI:
  - `GET /api/schema`
  - `GET /api/docs`

## Sample cURL Flow

1. Register + get token:

```bash
curl -X POST http://127.0.0.1:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"email\":\"alice@example.com\",\"password\":\"password123\"}"

curl -X POST http://127.0.0.1:8000/api/auth/token \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alice\",\"password\":\"password123\"}"
```

2. Create event:

```bash
curl -X POST http://127.0.0.1:8000/api/events \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"BBQ\",\"location\":\"Park\",\"starts_at\":\"2026-02-15T18:00:00Z\"}"
```

3. Invite users:

```bash
curl -X POST http://127.0.0.1:8000/api/events/1/invites \
  -H "Authorization: Bearer <owner_token>" \
  -H "Content-Type: application/json" \
  -d "{\"emails\":[\"guest@example.com\"]}"
```

4. Respond to invite token:

```bash
curl -X POST http://127.0.0.1:8000/api/invites/<token>/respond \
  -H "Authorization: Bearer <guest_token>" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"accepted\"}"
```

## Testing and Checks

```bash
python -m pytest
python manage.py check
python manage.py check --deploy
```

## MVP Non-goals / Placeholders

Not implemented in MVP:

- reactions/comments/doc/image sharing
- native mobile specifics
- WhatsApp/Telegram integration
- payments/booking

These can be added as separate apps or bounded API modules later.
