# Hive Frontend

A barebone React frontend (Vite + React + TypeScript) that integrates with the Hive Backend Django + DRF API.

## Features

- **Authentication**: JWT-based authentication with login and registration
- **Event Management**: Create, view, and manage events
- **Participants**: View and manage event participants
- **Contributions**: Add and view contributions for events
- **Polls**: Create polls and vote on poll options
- **Custom Fields**: Define and manage custom fields for events
- **Invitations**: Send and respond to event invitations

## Tech Stack

- **React 19** with TypeScript
- **Vite** for fast development and building
- **React Router v6** for routing
- **Axios** for HTTP requests
- **CSS** for styling (no UI framework - kept minimal)

## Project Structure

```
src/
├── api/              # API client layer
│   ├── client.ts     # Axios instance with JWT handling
│   ├── auth.ts       # Auth API functions
│   ├── events.ts     # Event API functions
│   ├── invitations.ts
│   ├── participation.ts
│   ├── contributions.ts
│   ├── customFields.ts
│   └── polls.ts
├── context/          # React context
│   ├── AuthContext.tsx  # Auth state management
│   └── PrivateRoute.tsx # Protected route component
├── types/            # TypeScript types
│   └── index.ts      # Type definitions matching backend schemas
├── pages/            # Page components
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── EventListPage.tsx
│   ├── EventDetailPage.tsx
│   ├── CreateEventPage.tsx
│   └── InviteRespondPage.tsx
├── components/       # Reusable components
│   ├── Navbar.tsx
│   ├── ParticipantList.tsx
│   ├── ContributionList.tsx
│   ├── PollList.tsx
│   ├── PollResults.tsx
│   └── CustomFieldList.tsx
├── App.tsx           # Main app with routing
└── main.tsx          # Entry point
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Running Hive Backend API (see [jonny-fr/Hive-Backend](https://github.com/jonny-fr/Hive-Backend))

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jonny-fr/Hive-Frontend.git
cd Hive-Frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Edit `.env` and set your backend API URL (default is `http://127.0.0.1:8000`):
```
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Running the Application

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or another port if 5173 is in use).

### Building for Production

Build the application:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

## Authentication

The application uses JWT authentication:

- **Access Token**: Stored in memory (React state)
- **Refresh Token**: Stored in localStorage (for development; use httpOnly cookies in production)
- **Token Refresh**: Automatic refresh on 401 responses via Axios interceptor

## API Integration

All API calls go through the Axios client (`src/api/client.ts`) which:
- Automatically adds JWT Bearer token to requests
- Handles token refresh on 401 errors
- Redirects to login when authentication fails

## Routes

- `/` - Redirects to `/events`
- `/login` - Login page
- `/register` - Registration page
- `/events` - Event list (protected)
- `/events/new` - Create new event (protected)
- `/events/:id` - Event detail with tabs for participants, contributions, polls, custom fields (protected)
- `/invites/:token/respond` - Respond to event invitation (protected)

## Development

### Linting

Run ESLint:
```bash
npm run lint
```

### Type Checking

TypeScript type checking is done during build. To check types manually:
```bash
npx tsc --noEmit
```

## Backend Integration

This frontend is designed to work with the Hive Backend API. Make sure the backend is running and accessible at the configured `VITE_API_BASE_URL`.

Key backend endpoints used:
- `POST /api/auth/register` - User registration
- `POST /api/auth/token` - Login (returns JWT pair)
- `POST /api/auth/token/refresh` - Refresh access token
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/{id}` - Get event detail
- And more (see backend schema at `jonny-fr/Hive-Backend/blob/main/schema.yaml`)

## License

This project is part of the Hive event management system.

