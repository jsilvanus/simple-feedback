# Feedback App – Architecture & Development Plan

## 1. Product Overview

The system is a configurable feedback application designed for:

- Standalone tablets running in kiosk mode
- Mobile browsers via shared links

Each tablet or link is tied to a location (`/:locationSlug`).

The system supports:

- Multiple locations
- Configurable questionnaires
- Configurable question types and answer scales
- Scheduled questionnaires per location
- Admin reporting and exports

## 2. Core Concepts

### Location

Represents a physical or logical place (e.g. "Lobby", "Church Hall", "Event Booth").

### Question

A single feedback prompt.

**Types:**

- Scale (buttons)
- Free text
- Word cloud selection

### Questionnaire

A grouped set of questions shown together to the user.

**Contains:**

- One or more questions
- Page structure (1+ pages)
- Optional text input questions
- Optional word cloud questions

### Schedule

Defines:

- Which questionnaire is active
- At which location
- During which time window

## 3. User Interfaces

### 3.1 Feedback UI (Public)

**Route:**

```
/:locationSlug
```

**Features:**

- Loads active questionnaire for location
- Displays:
  - 1–4 buttons by default (configurable)
  - red → green color scale (configurable)
  - text input if configured
  - word cloud selection if configured
- Supports:
  - multi-page questionnaires
  - auto-reset after submission
- Touch-optimized
- No login required

### 3.2 Admin UI

**Routes:**

```
/admin
/admin/locations
/admin/questions
/admin/questionnaires
/admin/schedules
/admin/results
```

**Admin capabilities:**

- Create/edit locations
- Create/edit questions
- Group questions into questionnaires
- Define:
  - pages
  - answer scales
- Schedule questionnaires to locations
- View results
- Filter results
- Export data

## 4. Backend Architecture

### Stack

- Node.js + Express/Fastify
- PostgreSQL
- REST API with OpenAPI specification
- JWT authentication for admin

### Responsibilities

- Provide questionnaire data for locations
- Accept feedback submissions
- Store feedback sessions and answers
- Provide analytics and exports
- Manage admin authentication

## 5. Database Model (Logical)

### `locations`
- `id`
- `slug`
- `name`
- `active`

### `questions`
- `id`
- `text`
- `type` (scale | text | wordcloud)

### `answer_scales`
- `id`
- `name`
- `buttons` (json: label, value, color)

### `questionnaires`
- `id`
- `name`
- `description`

### `questionnaire_questions`
- `questionnaire_id`
- `question_id`
- `page_number`
- `answer_scale_id` (nullable)

### `schedules`
- `id`
- `location_id`
- `questionnaire_id`
- `start_time`
- `end_time`

### `feedback_sessions`
- `id`
- `location_id`
- `questionnaire_id`
- `timestamp`

### `feedback_answers`
- `session_id`
- `question_id`
- `value`
- `text_value` (nullable)

## 6. API Design (OpenAPI First)

**Core endpoints:**

```
GET    /api/locations/{slug}/questionnaire
POST   /api/feedback

POST   /api/admin/login
GET    /api/admin/locations
POST   /api/admin/questionnaires
POST   /api/admin/schedules
GET    /api/admin/results
GET    /api/admin/export
```

**Development rule:**

- OpenAPI spec written before frontend
- Frontend generated or validated against spec
- Mock server used early

## 7. Testing Strategy

### 7.1 Pre-Code Tests

- User stories
- Acceptance tests per feature

**Example:**

- When questionnaire has 2 pages, user must see next page button
- When scale has 3 buttons, exactly 3 buttons are shown

### 7.2 Backend Tests

**Unit tests:**

- schedule resolution
- answer validation

**Integration tests:**

- submit feedback
- fetch results

### 7.3 Frontend Tests

- UI rendering tests
- Flow tests:
  - multi-page submission
  - auto-reset
- Kiosk behavior tests

## 8. Documentation Strategy

**Docs maintained in `/docs`:**

- Architecture diagram
- Database schema
- API reference
- Deployment guide
- Tablet kiosk setup
- Admin user manual

**OpenAPI provides:**

- API documentation
- Contract between frontend and backend

## 9. Development Milestones

### Milestone 1 – Foundations

**Define:**

- data model
- questionnaires
- schedules

**Tasks:**

- Write OpenAPI spec
- Write acceptance tests
- Setup repository and CI
- Create backend skeleton

**Deliverables:**

- OpenAPI spec
- Empty frontend apps
- Test framework ready

### Milestone 2 – Feedback UI

**Tasks:**

- Location routing
- Load questionnaire from API
- Render:
  - button scales
  - pages
- Submit feedback
- Reset behavior

**Deliverable:**

- Working kiosk feedback UI

### Milestone 3 – Admin Core

**Tasks:**

- Authentication
- CRUD:
  - locations
  - questions
  - answer scales
  - questionnaires
- Questionnaire builder UI
- Scheduling UI

**Deliverable:**

- Fully configurable questionnaires

### Milestone 4 – Results & Analytics

**Tasks:**

- Result aggregation
- Charts per question
- Filters:
  - location
  - date
  - questionnaire
- Export CSV/Excel

**Deliverable:**

- Usable admin dashboard

### Milestone 5 – Advanced Inputs

**Tasks:**

- Text answers
- Word cloud answers
- Word cloud visualization

**Deliverable:**

- Rich input support

### Milestone 6 – Production Hardening

**Tasks:**

- Error handling
- Security
- Rate limiting
- Backups
- Offline cache
- Kiosk watchdog reload

**Deliverable:**

- Production-ready system

## 10. Design Principles

- Location defines context
- Questionnaire defines structure
- Schedule defines timing
- Feedback UI is stateless
- Admin UI isolated from public UI
- API-first development

## 11. Optional Future Features

- QR code generator per location
- Live dashboard
- Multi-language support
- Theme per location
- Alerts (Slack/email)
- Role-based admin access
