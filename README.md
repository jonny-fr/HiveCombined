# Hive 🐝

A full-stack event management platform that lets users create events, manage invitations, track RSVPs, and run polls — all in one place.

## Tech Stack

| Layer     | Technology                                      |
|-----------|-------------------------------------------------|
| Frontend  | React 19, TypeScript, Vite, Tailwind CSS        |
| Backend   | Django 6, Django REST Framework, SimpleJWT      |
| Database  | PostgreSQL 16                                   |
| Proxy     | Nginx (HTTPS reverse proxy, TLS termination)    |
| Container | Docker & Docker Compose                         |

## Features

- **User Accounts** – Register, log in, and manage your profile with JWT-based authentication.
- **Events** – Create and manage events with title, description (Markdown supported), location, dress code, start/end times, and custom metadata.
- **Invitations** – Invite users by account or email address; invitees can accept or decline.
- **RSVP / Participation** – Track attendance with pending / accepted / declined statuses.
- **Polls** – Attach polls to events with single or multiple-choice options and optional open/close windows.
- **Media Uploads** – Attach images and documents to events.
- **Comments** – Leave comments on events.
- **OpenAPI Docs** – Auto-generated API schema via drf-spectacular.

## Project Structure

```
HiveCombined/
├── Backend/        # Django REST API
├── Frontend/       # React + Vite SPA
├── proxy/          # Nginx reverse proxy config
├── certs/          # Self-signed TLS certificate generation
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/)

### 1. Clone the repository

```bash
git clone <https://github.com/jonny-fr/HiveCombined.git>
cd HiveCombined
```

### 2. Configure environment variables

Copy the example env file and adjust values as needed:

```bash
cp .env.example .env
```

Key variables:

| Variable                    | Default       | Description                        |
|-----------------------------|---------------|------------------------------------|
| `POSTGRES_DB`               | `hive`        | Database name                      |
| `POSTGRES_USER`             | `hive`        | Database user                      |
| `POSTGRES_PASSWORD`         | `hive`        | Database password                  |
| `DJANGO_SETTINGS_MODULE`    | `hive.settings.dev` | Django settings module       |
| `HTTPS_PORT`                | `443`         | Host port mapped to Nginx HTTPS    |
| `HTTP_PORT`                 | `80`          | Host port mapped to Nginx HTTP     |

### 3. Start all services

```bash
docker compose up --build
```

This will:
1. Generate a self-signed TLS certificate (via `cert-init`)
2. Start PostgreSQL
3. Run Django migrations and launch the backend (Gunicorn)
4. Start the Vite dev server for the frontend
5. Start Nginx as an HTTPS reverse proxy

The app will be available at **https://localhost**.

> **Note:** Because the certificate is self-signed, your browser will show a security warning. You can safely proceed for local development.

### 4. Stopping the services

```bash
docker compose down
```

To also remove volumes (database data, media files):

```bash
docker compose down -v
```

## API Documentation

Once the backend is running, the auto-generated OpenAPI docs are available at:

- **Swagger UI:** `https://localhost/api/schema/swagger-ui/`
- **ReDoc:** `https://localhost/api/schema/redoc/`
- **Schema (YAML):** `https://localhost/api/schema/`

## Running Tests

```bash
cd Backend
pytest
```

## License

This project is for personal/educational use.
