# CLAUDE.md — Simple Feedback App

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

Simple Feedback is a **kiosk-style feedback collection application** with a Node.js/Express backend, React frontend, and PostgreSQL database. It allows organizations to gather structured feedback at physical or logical locations using scheduled questionnaires with multiple question types.

---

## Repository Structure

```
simple-feedback/
├── backend/              # Node.js/Express API server
│   ├── src/
│   │   ├── app.js        # Express app config, middleware, route registration
│   │   ├── server.js     # HTTP server entry point with graceful shutdown
│   │   ├── db/
│   │   │   ├── index.js      # pg connection pool
│   │   │   ├── schema.sql    # Full PostgreSQL schema (source of truth)
│   │   │   ├── migrate.js    # Migration runner
│   │   │   └── migrations/   # Versioned migration files
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT authentication middleware
│   │   │   └── rateLimiter.js # Rate limiting (feedback: 10/min, login: 5/15min)
│   │   └── routes/
│   │       ├── admin.js      # Admin CRUD endpoints (requires JWT)
│   │       ├── feedback.js   # Public feedback submission
│   │       ├── locations.js  # Public questionnaire delivery
│   │       └── images.js     # Image upload handling
│   ├── tests/
│   │   ├── app.test.js
│   │   ├── continuous_scale.test.js
│   │   └── location-groups.test.js
│   └── .env.example      # Environment variable template
├── frontend/             # React 19 + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # Main router
│   │   ├── main.jsx          # React DOM entry point
│   │   ├── api/index.js      # API client (dynamic base URL)
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── FeedbackPage.jsx  # Public feedback UI
│   │   │   ├── AdminPage.jsx     # Admin dashboard
│   │   │   └── AdminMapPage.jsx
│   │   ├── components/       # Reusable UI components
│   │   └── i18n/             # i18next config + locale files (en, fi, sv)
│   └── vite.config.js        # Dev server proxies /api → localhost:3000
├── docs/
│   ├── api-spec.yaml         # OpenAPI 3.0 specification
│   ├── SETUP.md              # Installation & configuration guide
│   └── TESTING.md            # Manual testing scenarios with curl examples
├── docker-compose.yml        # PostgreSQL 16 container
├── package.json              # Root workspace scripts (uses concurrently)
├── PLAN.md                   # Architecture & design decisions
└── README.md
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Node.js + Express | v18+, ^5.2.1 |
| Frontend | React | 19.2.4 |
| Build tool | Vite | 7.3.1 |
| Routing | React Router | 7.13.0 |
| Styling | Emotion + Material UI | ^11.14, ^7.3.8 |
| Database | PostgreSQL | 16 |
| Auth | JWT (jsonwebtoken) | 9.0.3 |
| i18n | i18next + react-i18next | 25.8.9 |
| Testing | Jest + Supertest | 30.2.0 |
| API spec | OpenAPI | 3.0 |

---

## Development Workflows

### Prerequisites

- Node.js v18+
- Docker + Docker Compose (for PostgreSQL)

### Initial Setup

```bash
# Install all dependencies
npm run install:all

# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with DB credentials, JWT secret, admin password

# Start database and run migrations
npm run dev:setup
```

### Running the Application

```bash
# Full stack (DB + backend + frontend) in development mode
npm run dev

# Individual services
npm run db:up          # Start PostgreSQL container only
cd backend && npm run dev   # Backend on port 3000 (nodemon)
cd frontend && npm run dev  # Frontend on port 5173 (Vite)
```

### Database Operations

```bash
npm run db:up         # Start PostgreSQL container
npm run db:down       # Stop PostgreSQL container
npm run db:migrate    # Run pending migrations
cd backend && npm run db:init  # Initialize schema from scratch
```

### Testing

```bash
cd backend && npm test           # Run all backend tests
cd backend && npm run test:watch # Watch mode
```

### Frontend Build

```bash
cd frontend && npm run build    # Production build → dist/
cd frontend && npm run preview  # Preview production build
```

---

## Key Architecture Decisions

1. **API-First** — The OpenAPI spec (`docs/api-spec.yaml`) is the contract. Backend implements it; frontend consumes it.
2. **Location-Centric** — All feedback flows through a location slug (`/api/locations/:slug/questionnaire`).
3. **Schedule-Based Activation** — Questionnaires are activated by time windows, not manual toggles. A location always serves its currently active schedule.
4. **Parameterized SQL** — All database queries use parameterized statements; never use string interpolation with user data.
5. **Immutable Results** — Submitted feedback is never edited or deleted via API.
6. **Composable Questions** — Questions exist independently and are linked to questionnaires with page ordering.
7. **Canvas-Based Charts** — Radar charts render on HTML5 canvas (`RadarChart.jsx`) for performance.
8. **i18n at the Data Layer** — Scale labels and question text support JSONB fields keyed by language code (e.g. `{"en": "...", "fi": "..."}` ).

---

## API Overview

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/locations/:slug/questionnaire` | Get active questionnaire for location |
| POST | `/api/locations/:slug/login` | Authenticate with location password |
| POST | `/api/feedback` | Submit feedback (rate-limited: 10/min) |

### Admin Endpoints (JWT required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Admin auth (rate-limited: 5/15min) |
| GET/POST | `/api/admin/locations` | Location CRUD |
| GET/POST/PUT/DELETE | `/api/admin/questions` | Question CRUD |
| GET/POST | `/api/admin/questionnaires` | Questionnaire CRUD |
| GET/POST | `/api/admin/schedules` | Schedule CRUD |
| GET/POST | `/api/admin/answer-scales` | Answer scale CRUD |
| GET/POST | `/api/admin/word-sets` | Word set CRUD |
| GET/POST | `/api/admin/answer-views` | Composite view CRUD |
| GET | `/api/admin/results` | Analytics data |
| GET | `/api/admin/export` | CSV export |
| POST | `/api/admin/images` | Image upload (multer) |

---

## Database Schema

The authoritative schema lives in `backend/src/db/schema.sql`. Key tables:

- **locations** — Physical/logical feedback points, each with a unique `slug`
- **location_groups** — Optional grouping of locations
- **questions** — Feedback prompts; `type` is one of: `scale`, `text`, `wordcloud`, `continuous_scale`
- **answer_scales** — Scale definitions: buttons, `mode` (normal/bipolar), `steps`, endpoint labels
- **question_scale_items** — Multi-scale rows within a single question (matrix layout)
- **word_cloud_options** — Word sets for wordcloud questions
- **questionnaires** — Named collections of questions
- **questionnaire_questions** — Ordered links between questionnaires and questions (with `page_number`)
- **schedules** — Time windows that activate a questionnaire at a location
- **schedule_questionnaires** / **schedule_locations** — Many-to-many joins for schedules
- **feedback_sessions** — One row per submission event
- **feedback_answers** — Individual answers (`numeric_value` or `text_value`)
- **images** — Uploaded image metadata

Migrations in `backend/src/db/migrations/` are numbered and run in order by `migrate.js`.

---

## Question Types

| Type | Description | Answer stored as |
|------|-------------|-----------------|
| `scale` | Discrete buttons (1–N) or slider | `numeric_value` |
| `continuous_scale` | Multi-row matrix (radar chart source) | `numeric_value` per scale item |
| `text` | Free-text input | `text_value` |
| `wordcloud` | Word selection from a set | `text_value` (comma-separated words) |

---

## Frontend Conventions

- **Routing**: `App.jsx` defines top-level routes. Public feedback is at `/:slug`, admin at `/admin`.
- **API calls**: All calls go through `frontend/src/api/index.js`. This module resolves the base URL dynamically (supports both dev proxy and production absolute URLs).
- **i18n**: Use the `useTranslation` hook. Translation keys follow `namespace.key` pattern (`admin.title`, `feedback.submit`, `common.cancel`). Locale files are in `frontend/src/i18n/locales/`.
- **Styling**: Use MUI components as the primary UI layer. Use Emotion (`@emotion/styled`) for custom styles. Avoid inline style objects for anything reused.
- **State**: Local component state with `useState`/`useEffect`. No global state management library.

---

## Backend Conventions

- **Route files**: Grouped by domain (`admin.js`, `feedback.js`, `locations.js`). Routes are registered in `app.js`.
- **Database queries**: Write raw SQL with `pool.query(sql, params)`. No ORM. Always parameterize.
- **Authentication**: The `authenticateToken` middleware in `middleware/auth.js` must be applied to all admin routes.
- **Error responses**: Use consistent shape `{ error: "message" }` with appropriate HTTP status codes.
- **Environment variables**: Loaded via `dotenv` in `server.js`. Required vars: `DATABASE_URL` (or individual `DB_*` vars), `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`.

---

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

```
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=feedback_db
DB_USER=feedback_user
DB_PASSWORD=<password>
JWT_SECRET=<strong-random-secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>
```

---

## Security Notes

- Never use string concatenation in SQL queries; always use parameterized statements.
- The `JWT_SECRET` and `ADMIN_PASSWORD` must be strong random values in production.
- Rate limiting is applied to feedback submission and login endpoints. Admin CRUD routes currently have rate limiting disabled (development mode — review before production).
- `helmet` is applied globally for security headers.
- CORS is configured; review allowed origins before production deployment.

---

## Running Tests

Backend tests use Jest + Supertest and test against a real database (configured via env):

```bash
cd backend
npm test
```

Test files:
- `tests/app.test.js` — Core API endpoint tests
- `tests/continuous_scale.test.js` — Radar chart / continuous scale feature
- `tests/location-groups.test.js` — Location grouping feature

Manual test scenarios with curl examples are documented in `docs/TESTING.md`.

---

## Active Development Areas (as of Feb 2026)

The following areas are under active development (see `plan_refactor.md`, `plan_scales.md`, `todo_refactor.md`):

- **Enhanced answer scales** — Normal/bipolar modes, configurable step counts, endpoint labels stored in DB
- **Multi-scale questions** — Matrix layout with per-row scale overrides (`question_scale_items`)
- **Answer Views** — Composite radar chart visualizations aggregating multiple questions
- **Word Set refinements** — Terminology transition from "word cloud" to "word set" throughout
- **Kiosk mode filtering** — Excluding `continuous_scale` questions from public feedback UI

When modifying these areas, check the corresponding plan files for context before making changes.
