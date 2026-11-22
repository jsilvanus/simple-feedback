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
│   │   ├── config/
│   │   │   └── auth.js       # Auth and OIDC configuration & group role mapping
│   │   ├── db/
│   │   │   ├── index.js      # pg connection pool (20 max, 30s idle, 2s connect timeout)
│   │   │   ├── schema.sql    # Full PostgreSQL schema (source of truth)
│   │   │   ├── migrate.js    # Migration runner (tracks via schema_migrations table)
│   │   │   └── migrations/   # Versioned migration files (008–017 currently)
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT & session authentication middleware, role enforcement
│   │   │   ├── csrf.js       # CSRF protection (double-submit cookie)
│   │   │   └── rateLimiter.js # Rate limiting: apiLimiter 100/15min, loginLimiter 5/15min, feedbackLimiter 10/min
│   │   └── routes/
│   │       ├── auth.js       # OIDC and authentication routes (/login, /callback, /logout, /backchannel)
│   │       ├── admin.js      # Admin CRUD endpoints (requires auth & CSRF)
│   │       ├── feedback.js   # Public feedback submission
│   │       ├── locations.js  # Public questionnaire delivery
│   │       └── images.js     # Image upload handling (multer, 5MB, JPEG/PNG/GIF/WebP)
│   ├── tests/
│   │   ├── app.test.js               # Health check & 404 tests
│   │   ├── auth.test.js              # Password login & cookie CSRF tests
│   │   ├── oidc.test.js              # OIDC flow, role mapping, PKCE, backchannel logout tests
│   │   ├── continuous_scale.test.js  # Radar chart / continuous scale feature tests
│   │   └── location-groups.test.js   # Location grouping feature tests
│   ├── uploads/              # Uploaded image storage directory
│   └── .env.example          # Environment variable template
├── frontend/             # React 19 + Vite SPA
│   ├── src/
│   │   ├── App.jsx           # Main router (4 routes: /, /admin, /admin/map, /:locationSlug)
│   │   ├── main.jsx          # React DOM entry point (StrictMode)
│   │   ├── api/index.js      # API client (dynamic base URL, supports VITE_API_BASE override)
│   │   ├── pages/
│   │   │   ├── HomePage.jsx      # Landing page with slug input and admin link
│   │   │   ├── FeedbackPage.jsx  # Public feedback UI (multi-page, auth, settings)
│   │   │   ├── AdminPage.jsx     # Admin dashboard with tab navigation
│   │   │   └── AdminMapPage.jsx  # Map view for locations
│   │   ├── components/
│   │   │   ├── AnswerButtons.jsx          # Button rendering for scale questions
│   │   │   ├── MultiScaleQuestion.jsx     # Matrix/stacked multi-scale (buttons, slider, stars, thumbs, labeled-line)
│   │   │   ├── RadarChart.jsx             # Canvas-based radar chart (1-axis line, 2-axis V, 3+ polygon)
│   │   │   ├── AdminAnswerScales.jsx      # CRUD for answer scales (mode, step, labels)
│   │   │   ├── AdminAnswerViews.jsx       # CRUD for composite radar views
│   │   │   ├── AdminLocations.jsx         # CRUD for locations
│   │   │   ├── AdminLocationGroups.jsx    # CRUD for location groups
│   │   │   ├── AdminQuestions.jsx         # CRUD for questions
│   │   │   ├── AdminQuestionnaires.jsx    # CRUD for questionnaires
│   │   │   ├── AdminSchedules.jsx         # CRUD for schedules (date_based, recurring_weekday)
│   │   │   ├── AdminWordSets.jsx          # CRUD for word sets (formerly word cloud)
│   │   │   ├── AdminResults.jsx           # Analytics dashboard (distributions, histograms, radar)
│   │   │   ├── WordSetInput.jsx           # Word selection UI component
│   │   │   ├── FeedbackHeader.jsx         # Header with language selector
│   │   │   ├── LanguageSelector.jsx       # i18n language switcher
│   │   │   ├── SettingsButton.jsx         # UI size & contrast mode toggle
│   │   │   └── SettingsModal.jsx          # Settings panel (size 50–200%, contrast, location name)
│   │   └── i18n/             # i18next config + locale files (en, fi, sv); Finnish is default fallback
│   └── vite.config.js        # Dev server proxies /api → localhost:3000 (or VITE_API_TARGET)
├── docs/
│   ├── api-spec.yaml             # OpenAPI 3.0 specification
│   ├── SETUP.md                  # Installation & configuration guide
│   ├── TESTING.md                # Manual testing scenarios with curl examples
│   ├── CONTINUOUS_SCALE.md       # Radar chart / continuous_scale feature documentation
│   ├── LOCATION_GROUPS.md        # Location grouping feature guide
│   └── IMPLEMENTATION_SUMMARY.md # Feature implementation details
├── scripts/
│   └── deploy.sh             # Self-updating deployment script
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot guidance (mirrors CLAUDE.md intent)
├── docker-compose.yml        # PostgreSQL 16 container + optional backend service
├── package.json              # Root workspace scripts (uses concurrently)
├── PLAN.md                   # Architecture & product overview
├── TODO.md                   # Known issues, planned features, security checklist
├── plan_refactor.md          # Detailed refactoring plan (5 phases)
├── plan_scales.md            # Multi-scale question feature plan
├── todo_refactor.md          # Implementation checklist (7 phases)
└── README.md
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Node.js + Express | v18+, ^5.2.1 |
| Frontend | React | ^19.2.4 |
| Build tool | Vite | ^7.3.1 |
| Routing | React Router | ^7.13.0 |
| Styling | Emotion + Material UI | ^11.14, ^7.3.8 |
| Database | PostgreSQL | 16 |
| Auth | JWT (jsonwebtoken) + OIDC (openid-client, jose) | ^9.0.3, ^6.9.1, ^6.0.0 |
| Password hashing | bcryptjs | ^3.0.3 |
| File uploads | multer | ^2.0.2 |
| i18n | i18next + react-i18next | ^25.8.9 |
| Testing | Jest + Supertest | ^30.2.0 |
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
npm run db:up               # Start PostgreSQL container only
npm run dev:backend         # Backend only (nodemon, port 3000)
npm run dev:frontend        # Frontend only (Vite, port 5173)
cd backend && npm run dev   # Backend directly
cd frontend && npm run dev  # Frontend directly
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
9. **Location-then-Group Schedule Priority** — The questionnaire endpoint first checks location-specific schedules, then falls back to group-level schedules.

---

## API Overview

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/locations/:slug/questionnaire` | Get active questionnaire for location |
| POST | `/api/locations/:slug/login` | Authenticate with location password |
| POST | `/api/feedback` | Submit feedback (rate-limited: 10/min) |

### Authentication & OIDC Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/config` | Expose auth mode and login provider availability |
| GET | `/api/auth/login` | Initiate OIDC Authorization Code Flow with PKCE |
| GET | `/api/auth/callback` | Exchange authorization code for tokens & set session cookie |
| GET/POST | `/api/auth/logout` | Clear session cookie and redirect to OIDC end session endpoint |
| POST | `/api/auth/backchannel` | OIDC backchannel logout notification (invalidates sessions) |

### Admin Endpoints (Auth required)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Admin auth (rate-limited: 5/15min) |
| GET/POST | `/api/admin/locations` | Location list / create |
| PUT/DELETE | `/api/admin/locations/:id` | Update / soft-delete location |
| GET/POST | `/api/admin/location-groups` | Location group list / create |
| PUT/DELETE | `/api/admin/location-groups/:id` | Update / delete location group |
| GET/POST/PUT/DELETE | `/api/admin/questions` | Question CRUD |
| GET/POST | `/api/admin/questionnaires` | Questionnaire list / create |
| PUT/DELETE | `/api/admin/questionnaires/:id` | Update / delete questionnaire |
| GET/POST | `/api/admin/schedules` | Schedule list / create |
| PUT/DELETE | `/api/admin/schedules/:id` | Update / delete schedule |
| GET/POST/PUT/DELETE | `/api/admin/answer-scales` | Answer scale CRUD |
| GET/POST/PUT/DELETE | `/api/admin/word-sets` | Word set CRUD |
| GET/POST/PUT/DELETE | `/api/admin/answer-views` | Composite view CRUD |
| GET | `/api/admin/results` | Analytics data |
| GET | `/api/admin/export` | CSV export |
| POST | `/api/admin/images` | Image upload (multer) |

---

## Database Schema

The authoritative schema lives in `backend/src/db/schema.sql`. Key tables:

- **locations** — Physical/logical feedback points, each with a unique `slug`; optional `password_hash` for protected kiosks
- **location_groups** — Optional grouping of locations for shared schedule assignment
- **questions** — Feedback prompts; `type` is one of: `scale`, `text`, `wordcloud`, `continuous_scale`
- **answer_scales** — Scale definitions with `scale_mode` (normal/bipolar), `step` (0.01–1), `min_value`/`max_value`, endpoint labels (JSONB)
- **question_scale_items** — Multi-scale rows within a single question (matrix layout); each row can override the parent scale
- **word_cloud_options** — Word sets for wordcloud questions (table name preserved for DB compatibility)
- **questionnaires** — Named collections of questions
- **questionnaire_questions** — Ordered links between questionnaires and questions (with `page_number`)
- **schedules** — Time windows that activate a questionnaire at a location; `schedule_type`: `date_based` or `recurring_weekday`
- **schedule_questionnaires** / **schedule_locations** — Many-to-many joins for schedules
- **feedback_sessions** — One row per submission event
- **feedback_answers** — Individual answers (`value` as NUMERIC, `text_value` as TEXT)
- **images** — Uploaded image metadata
- **answer_views** — Composite visualization configurations (currently radar type)
- **answer_view_questions** — Questions included in a view, with per-question axis labels (JSONB)
- **schema_migrations** — Migration tracking table

Migrations in `backend/src/db/migrations/` are numbered and run in order by `migrate.js`. Current migrations: 008–011.

---

## Question Types

| Type | Description | Answer stored as |
|------|-------------|-----------------|
| `scale` | Discrete buttons (1–N) or slider | `numeric_value` (NUMERIC) |
| `continuous_scale` | Multi-row matrix (radar chart source) | `numeric_value` per scale item |
| `text` | Free-text input | `text_value` |
| `wordcloud` | Word selection from a set | `text_value` (comma-separated words) |

> Note: The UI and admin now use the term "word set" but the DB column/table name remains `wordcloud`/`word_cloud_options` for backward compatibility.

---

## Frontend Conventions

- **Routing**: `App.jsx` defines top-level routes. Public feedback is at `/:slug`, admin at `/admin`, map at `/admin/map`.
- **API calls**: All calls go through `frontend/src/api/index.js`. Resolves base URL dynamically — detects `localhost:5173` vs. production; respects `VITE_API_BASE` and `VITE_API_TARGET` env vars.
- **i18n**: Use the `useTranslation` hook. Translation keys follow `namespace.key` pattern (`admin.title`, `feedback.submit`, `common.cancel`). Locale files are in `frontend/src/i18n/locales/`. Language preference is saved to `localStorage`. Finnish (`fi`) is the default fallback language.
- **Styling**: Use MUI components as the primary UI layer. Use Emotion (`@emotion/styled`) for custom styles. Avoid inline style objects for anything reused.
- **State**: Local component state with `useState`/`useEffect`. No global state management library.
- **Admin token**: Stored in `localStorage`; passed as `Authorization: Bearer <token>` header via `adminRequest()` in `api/index.js`.
- **Settings persistence**: UI scale (50–200%), high-contrast mode, and location name visibility are saved in `localStorage`.

---

## Backend Conventions

- **Route files**: Grouped by domain (`admin.js`, `feedback.js`, `locations.js`, `images.js`). Routes are registered in `app.js`.
- **Database queries**: Write raw SQL with `pool.query(sql, params)`. No ORM. Always parameterize.
- **Authentication**: `authenticate` middleware in `middleware/auth.js` validates JWT bearer tokens and `adminToken` httpOnly session cookies. Supports `AUTH_MODE=dev` (local admin login) and `AUTH_MODE=oidc` (Tunnus OpenID Connect with PKCE, group-to-role mapping, and backchannel logout session invalidation).
- **Role Enforcement**: `requireRole(minRole)` middleware enforces role rank: `viewer` < `manager` < `admin`.
- **Error responses**: Use consistent shape `{ error: "message" }` with appropriate HTTP status codes.
- **Environment variables**: Loaded via `dotenv` in `server.js`. Required vars: `DATABASE_URL` (or individual `DB_*` vars), `JWT_SECRET` / `SESSION_SECRET`. In dev mode, `ADMIN_USERNAME` and `ADMIN_PASSWORD` are used; in OIDC mode, `OIDC_ISSUER` and `OIDC_CLIENT_ID` are required.
- **Transactions**: Use `BEGIN`/`COMMIT`/`ROLLBACK` for multi-step writes (e.g., feedback submission creates a session and then answers atomically).

---

## Environment Variables

See `backend/.env.example` for the full list. Key variables:

```
# Backend (.env in backend/)
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=feedback_db
DB_USER=feedback_user
DB_PASSWORD=<password>
JWT_SECRET=<strong-random-secret>
SESSION_SECRET=<strong-random-secret>

# Authentication mode
AUTH_MODE=dev                              # 'dev' (local admin credentials) or 'oidc' (Tunnus OIDC)
ALLOW_LOCAL_ADMIN=false                    # whether local admin login is allowed when AUTH_MODE=oidc

# Local admin credentials (used when AUTH_MODE=dev)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>

# OIDC / Tunnus settings (required when AUTH_MODE=oidc)
OIDC_ISSUER=https://id.example.com/tunnus
OIDC_CLIENT_ID=simple-feedback
OIDC_CLIENT_SECRET=<client-secret>
OIDC_REDIRECT_URI=http://localhost:3000/api/auth/callback
OIDC_SCOPES=openid profile email groups
OIDC_BUTTON_LABEL=Kirjaudu Tunnuksella
OIDC_GROUP_ROLE_MAP={"/feedback-admins":"admin","/feedback-managers":"manager","admin":"admin"}

CORS_ORIGIN=http://localhost:5173   # comma-separated list for production

# Frontend (root .env.example)
VITE_PORT=5173
VITE_API_TARGET=http://localhost:3000  # proxy target in dev
VITE_API_BASE=                         # set in production to absolute API URL
```

---

## Security Notes

- Never use string concatenation in SQL queries; always use parameterized statements.
- The `JWT_SECRET` and `ADMIN_PASSWORD` must be strong random values in production.
- Rate limiting is applied to feedback submission and login endpoints. Admin CRUD routes currently have rate limiting via `apiLimiter` (100/15min) — review before production.
- `helmet` is applied globally for security headers.
- CORS is configured; review `CORS_ORIGIN` allowed origins before production deployment.
- Location passwords are hashed with `bcryptjs`; never store plaintext passwords.

---

## Running Tests

Backend tests use Jest + Supertest and test against a real database (configured via env):

```bash
cd backend
npm test
```

Test files:
- `tests/app.test.js` — Core API endpoint tests (health check, 404)
- `tests/continuous_scale.test.js` — Radar chart / continuous scale feature
- `tests/location-groups.test.js` — Location grouping feature

Manual test scenarios with curl examples are documented in `docs/TESTING.md`.

---

## Active Development Areas (as of September 2026)

The following features have been implemented and are reflected in the schema (migrations 008–011) and frontend components. Check corresponding plan files before modifying:

- **Enhanced answer scales** — Normal/bipolar modes (`scale_mode`), configurable step counts (`step`), endpoint labels (`min_label`/`max_label` as JSONB), min/max values. See `plan_scales.md`.
- **Multi-scale questions** — `question_scale_items` table enables matrix layout with per-row scale and display overrides (`MultiScaleQuestion.jsx`). See `plan_scales.md`.
- **Answer Views** — Composite radar chart visualizations (`answer_views`, `answer_view_questions` tables; `AdminAnswerViews.jsx`, `RadarChart.jsx`). See `plan_refactor.md`.
- **Word Set refinements** — UI and admin now use "word set" terminology; DB table remains `word_cloud_options` for compatibility. See `todo_refactor.md`.
- **Kiosk mode filtering** — `continuous_scale` questions are excluded from the public feedback UI; only shown in admin results/radar views.
- **Location Password Authentication** — Password-protected locations require client authentication via `/api/locations/:slug/login`, which issues a signed JWT token. Feedback submission validates the token server-side. See `REVIEW.md` for C4.
- **Schedule Timezone Support** — Schedules now store a timezone (migration 011). Recurring weekday matching uses the schedule's IANA timezone via `Intl.toLocaleString()` for accurate time comparison across deployments. See `REVIEW.md` for M4.
- **CSRF Protection** — Double-submit cookie CSRF middleware protects all admin state-changing routes. See `REVIEW.md` for H3.
- **Security Hardening** — Admin JWT migrated to `httpOnly; Secure; SameSite=Strict` cookies. Startup validation of critical env vars (JWT_SECRET, admin credentials, DB config). See `REVIEW.md` for security fixes (C1–C4, H2, H7, H8).
- **Pagination & Query Optimization** — Admin list views paginate (20 items/page). Query N+1 problems eliminated via `json_agg` and `GROUP BY` aggregates. See `REVIEW.md` for M1, M2, M3, L8.

When modifying these areas, check `plan_refactor.md`, `plan_scales.md`, `todo_refactor.md`, and `REVIEW.md` for full context and remaining checklist items. For deployment and rollback procedures, see `docs/ROLLBACK.md`.
