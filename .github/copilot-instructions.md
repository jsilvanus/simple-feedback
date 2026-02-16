# Simple Feedback App - AI Coding Agent Instructions

## Project Overview
Configurable feedback collection system for tablet kiosks and mobile browsers. Users access location-specific questionnaires via `/:locationSlug`, submit multi-dimensional feedback (scales, text, word clouds, radar charts), and admins manage content via JWT-protected dashboard.

## Architecture

### Monorepo Structure
- **Root**: Orchestration scripts manage Docker DB + concurrent backend/frontend dev servers
- **Backend**: Node.js/Express + PostgreSQL with CommonJS modules (`require()`), runs on port 3000
- **Frontend**: React 19 + Vite with ES modules (`import`), runs on port 5173
- **Database**: PostgreSQL 16 in Docker (port 5432), schema at `backend/src/db/schema.sql`

### Key Dependencies
- Backend: `express@5`, `pg`, `jsonwebtoken`, `bcryptjs`, `multer` (image uploads), `express-rate-limit`
- Frontend: `react@19`, `react-router-dom@7`, `i18next` (defaults to Finnish), `vite@7`
- Testing: `jest` + `supertest` for backend integration tests

## Developer Workflows

### Essential Commands (Run from Root)
```bash
npm run dev:setup    # First-time: Start DB + run schema migration
npm run dev          # Daily: Start DB + backend + frontend concurrently
npm run dev:db       # Start only PostgreSQL container
npm run db:migrate   # Re-run schema after schema.sql changes
```

### Database Migrations
- **Schema updates**: Edit `backend/src/db/schema.sql` (idempotent with `IF NOT EXISTS`)
- **Migration files**: `backend/src/db/migrations/*.sql` for backward-compatible changes
- **Apply**: `npm run db:migrate` or `docker compose exec db psql ...`

### Testing
```bash
cd backend && npm test        # Run all tests
npm test -- location-groups   # Run specific test file
```

## Core Data Model

### Critical Relationships
```
location_groups → locations → schedules → questionnaires → questions
                     ↓              ↓
              feedback_sessions ← questionnaire_questions → answer_scales
                     ↓                                   → word_cloud_options
              feedback_answers
```

### Schedule Priority Logic
When fetching active questionnaire for a location:
1. **Location-specific schedules** take precedence
2. **Group-level schedules** serve as fallback (if location is in a group)
3. Implemented in `backend/src/routes/locations.js` GET `/:slug/questionnaire`

### Question Types & Storage
- **scale**: Button values (1-5) stored in `feedback_answers.value`
- **text**: Free text in `feedback_answers.text_value`
- **wordcloud**: JSON array in `text_value` (e.g., `["word1", "word2"]`)
- **continuous_scale**: Radar chart JSON object in `text_value` (e.g., `{"1": 8.5, "2": 7.2}`)

## Backend Patterns

### Route Structure
```
/api/locations       # Public: location info, questionnaire retrieval, password auth
/api/feedback        # Public: submit feedback (rate-limited)
/api/admin           # Protected: CRUD for all entities + analytics
/api/admin/images    # Protected: multer-based image uploads
```

### Authentication
- **Admin**: JWT tokens via `POST /api/admin/login`, verified by `middleware/auth.js`
- **Location passwords**: Optional bcrypt-hashed passwords, returns location-scoped token
- **Public endpoints**: No auth needed for questionnaire retrieval and feedback submission

### Transaction Pattern
All feedback submissions use PostgreSQL transactions (see `routes/feedback.js`):
```javascript
await client.query('BEGIN');
// Create session → Insert answers
await client.query('COMMIT');
// ROLLBACK on error
```

### Database Access
- **Module**: `backend/src/db/index.js` exports `{ query, pool }`
- **Connection pooling**: 20 max connections, configured via env vars (`DB_HOST`, `DB_PORT`, etc.)
- **Error handling**: Pool errors trigger `process.exit(-1)`

## Frontend Patterns

### Routing
```jsx
/                     # HomePage (landing)
/admin               # AdminPage (requires JWT)
/:locationSlug       # FeedbackPage (public, loads questionnaire)
```

### API Client (`frontend/src/api/index.js`)
- **Base URL logic**: `VITE_API_BASE` → `VITE_API_TARGET` → `http://localhost:3000/api` (dev default)
- **Auth**: Stores JWT in localStorage, passes via `Authorization: Bearer <token>`
- **Methods**: `getQuestionnaire(slug)`, `submitFeedback()`, `adminLogin()`, plus CRUD helpers

### Internationalization
- **Default language**: Finnish (`fi`)
- **Available**: `en`, `fi`, `sv` in `frontend/src/i18n/locales/`
- **Storage**: User preference saved to localStorage
- **Usage**: `useTranslation()` hook from `react-i18next`

### Component Conventions
- **CSS**: Co-located files (e.g., `AdminPage.css` alongside `AdminPage.jsx`), vanilla CSS
- **Admin CRUD**: Each entity has dedicated component (e.g., `AdminQuestions.jsx`, `AdminSchedules.jsx`)
- **Feedback UI**: Touch-optimized, auto-resets after submission (kiosk mode)

## Special Features

### RadarChart Component (`frontend/src/components/RadarChart.jsx`)
- Canvas-based interactive visualization for `continuous_scale` questions
- **Modes**: 1-axis (gradient line), 2-axis (V-shape), 3+ axes (spider chart)
- **Interaction**: Click/touch to set values on axes
- **Configuration**: Uses `answer_scales.buttons` JSON with `{value, label, min, max}` structure

### Schedule Types
- **date_based**: Traditional start/end timestamps
- **recurring_weekday**: Weekly patterns via `weekday_pattern` JSONB (e.g., `{"monday": true}`)
- **show_only_one**: Display single random questionnaire instead of all active ones

### Location Groups
- Group locations logically (e.g., by region, building)
- Create group-level schedules to publish to all locations in group
- See `docs/LOCATION_GROUPS.md` for detailed usage patterns

## Environment Configuration

### Backend `.env` (Required)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=simple_feedback
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-change-in-production
PORT=3000
```

### Frontend `.env` (Optional)
```env
VITE_API_BASE=/api              # Relative path for production builds
VITE_API_TARGET=http://localhost:3000  # Full URL for dev proxy
```

## Common Tasks

### Adding a New Question Type
1. Update `backend/src/db/schema.sql` CHECK constraint for `questions.type`
2. Create migration in `backend/src/db/migrations/`
3. Add rendering logic in `frontend/src/pages/FeedbackPage.jsx`
4. Update answer submission format in `FeedbackPage.jsx` and display in `AdminResults.jsx`
5. Add type option in `frontend/src/components/AdminQuestions.jsx` dropdown

### Adding a New Admin Entity
1. Create table in `schema.sql` with `created_at`, `updated_at` timestamps
2. Add CRUD routes in `backend/src/routes/admin.js` (or new route file)
3. Protect with `authenticate` middleware
4. Create admin component (e.g., `AdminEntityName.jsx`) following `AdminQuestions.jsx` pattern
5. Add tab to `AdminPage.jsx`

### Modifying Database Schema
1. Edit `backend/src/db/schema.sql` (use `ALTER TABLE IF NOT EXISTS` for compatibility)
2. Create migration file in `backend/src/db/migrations/` if breaking change
3. Run `npm run db:migrate` from root
4. Update affected routes and components

## Documentation References
- **[PLAN.md](../PLAN.md)**: Original architecture and design decisions
- **[SETUP.md](../docs/SETUP.md)**: Detailed installation and environment setup
- **[CONTINUOUS_SCALE.md](../docs/CONTINUOUS_SCALE.md)**: Radar chart feature implementation guide
- **[LOCATION_GROUPS.md](../docs/LOCATION_GROUPS.md)**: Location grouping patterns and API reference
- **[api-spec.yaml](../docs/api-spec.yaml)**: OpenAPI 3.0 specification for all endpoints

## Code Quality Notes
- Backend uses synchronous `require()` (CommonJS), frontend uses `import` (ES modules)
- Database pooling handles errors globally—avoid silent failures
- All admin endpoints require JWT; public endpoints are rate-limited
- Feedback submissions are transactional to prevent partial data
- Finnish is the primary language; translation keys use English identifiers
