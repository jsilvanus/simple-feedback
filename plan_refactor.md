# Refactoring Plan: Scales, Word Sets & Answer Views

## Overview

This refactoring addresses five major changes:

1. **Enhanced scales** — support normal (0/1 to N) and bipolar (-N to N) modes, configurable step (0.01–1), and named endpoints ("slow" / "fast")
2. **Rename "word cloud" to "word set"** throughout the system
3. **Kiosk/feedback mode filtering** — only scales, word sets, and text boxes are shown to respondents
4. **New "answer views" category** — admin-only composite visualizations (e.g., radar views joining multiple scale questions)
5. **Consolidate migration SQL into schema.sql** — keep `db:migrate` mechanism for future use, but fold current 7 migrations into the canonical schema

---

## 1. Enhanced Scales

### 1.1 Database Changes

**Table: `answer_scales`** — add columns:

| Column | Type | Default | Description |
|---|---|---|---|
| `scale_mode` | `VARCHAR(20)` | `'normal'` | `'normal'` (0/1..N) or `'bipolar'` (-N..N) |
| `step` | `NUMERIC(4,2)` | `1` | Step increment, constrained 0.01–1 |
| `min_label` | `JSONB` | `NULL` | i18n label for low end, e.g. `{"fi":"Hidas","en":"Slow","sv":"Långsam"}` |
| `max_label` | `JSONB` | `NULL` | i18n label for high end, e.g. `{"fi":"Nopea","en":"Fast","sv":"Snabb"}` |
| `min_value` | `NUMERIC` | `NULL` | Explicit minimum value (overrides button inference). For bipolar: `-N` |
| `max_value` | `NUMERIC` | `NULL` | Explicit maximum value. For normal: `N` |

Add constraint: `CHECK (step >= 0.01 AND step <= 1)`
Add constraint: `CHECK (scale_mode IN ('normal', 'bipolar'))`

The existing `buttons` JSONB stays for backward compatibility — it continues to define discrete button labels/colors for the `scale` question type. The new fields enable continuous slider rendering.

**Table: `feedback_answers`** — change `value` from `INTEGER` to `NUMERIC` to support fractional step values (e.g., 3.5).

### 1.2 Backend Changes

**File: `backend/src/routes/admin.js`**

- Update answer-scale CRUD endpoints to accept/validate new fields: `scaleMode`, `step`, `minLabel`, `maxLabel`, `minValue`, `maxValue`
- Validate `step` is between 0.01 and 1
- Validate `scaleMode` is `'normal'` or `'bipolar'`
- Return new fields in GET responses

**File: `backend/src/routes/locations.js`**

- Include new scale fields in questionnaire delivery response

**File: `backend/src/routes/feedback.js`**

- Accept numeric (non-integer) values for feedback answers

### 1.3 Frontend Changes

**File: `frontend/src/components/AdminAnswerScales.jsx`**

- Add scale mode selector (Normal / Bipolar) to `AnswerScaleForm`
- Add step input (number, min 0.01, max 1, step 0.01)
- Add min/max label inputs (with i18n: fi, en, sv)
- Add min/max value inputs
- For bipolar mode: UI hint showing range will be -N to N
- Preview: show scale bar with endpoint labels

**File: `frontend/src/pages/FeedbackPage.jsx`**

- For `scale` type with step < 1 or when configured as slider: render a slider/range input instead of discrete buttons
- Show `minLabel` and `maxLabel` at scale endpoints
- For bipolar: center the scale at 0, label endpoints
- For normal with integer step=1: keep existing button rendering (backward compatible)

**File: `frontend/src/components/RadarChart.jsx`**

- Update to read `minValue`/`maxValue` from scale config instead of inferring from buttons
- Support fractional values based on `step`
- Display endpoint labels on axes

**File: `frontend/src/components/AdminResults.jsx`**

- Update distribution histogram to handle fractional values (bucket by step)
- Show endpoint labels in results
- Handle bipolar scale display (center on 0)

---

## 2. Rename "Word Cloud" to "Word Set"

This is a terminology change across the full stack. The database table stays as-is for data compatibility, but all user-facing strings, API field names, component names, and variables are updated.

### 2.1 Database

- **Table `word_cloud_options` remains as-is** (no rename needed — avoids migration risk)
- Column `questions.word_cloud_options_id` remains as-is

### 2.2 Backend

- API routes: add aliased endpoints
  - `GET/POST /api/admin/word-sets` alongside existing `/api/admin/word-cloud-options`
  - Deprecate old endpoints (keep working for backward compat)
- Response field names: return `wordSetOptions` alongside `wordCloudOptions`

### 2.3 Frontend

- Rename component files:
  - `AdminWordCloudOptions.jsx` → `AdminWordSets.jsx`
  - `WordCloudInput.jsx` → `WordSetInput.jsx`
- Update all UI text: "Word Cloud" → "Word Set" in labels, headers, empty states
- Update i18n keys: `admin.wordCloudOptions` → `admin.wordSets`, etc.
- Update `AdminQuestions.jsx`: dropdown label, type icon, type badge
- Update `AdminResults.jsx`: result display label
- Update `FeedbackPage.jsx`: component import and usage

---

## 3. Kiosk/Feedback Mode Filtering

Currently, all four question types (`scale`, `text`, `wordcloud`, `continuous_scale`) are rendered in kiosk mode. The new rule is:

> In feedback/kiosk mode, only `scale`, `wordcloud` (word set), and `text` questions are shown to respondents. The `continuous_scale` type (which becomes part of "answer views") is **not** rendered in kiosk mode.

### 3.1 Backend

**File: `backend/src/routes/locations.js`**

- When building the questionnaire response for kiosk, filter out questions whose type is not in the respondent-visible set: `['scale', 'text', 'wordcloud']`
- This ensures answer views (radar/continuous_scale) never appear in kiosk mode

### 3.2 Frontend

**File: `frontend/src/pages/FeedbackPage.jsx`**

- Add a guard: skip rendering questions with `type === 'continuous_scale'` (defense in depth, in case backend doesn't filter)
- This is a simple `if` check in the question map

---

## 4. Answer Views (New Category)

Answer views are admin-only composite visualizations. They are not shown to respondents.

### 4.1 Concept

An **answer view** is a configuration that:
- References multiple questions (specifically scale questions)
- Combines their answers into a single visualization (radar chart, comparison bar chart, etc.)
- Is visible only in the admin results dashboard
- Is associated with a questionnaire (since it combines questions within that questionnaire)

The first answer view type is **radar** — multiple scale questions plotted as axes on a radar chart.

### 4.2 Database

**New table: `answer_views`**

```sql
CREATE TABLE IF NOT EXISTS answer_views (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    view_type VARCHAR(50) NOT NULL CHECK (view_type IN ('radar')),
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**New junction table: `answer_view_questions`**

```sql
CREATE TABLE IF NOT EXISTS answer_view_questions (
    answer_view_id INTEGER NOT NULL REFERENCES answer_views(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    axis_label VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (answer_view_id, question_id)
);
```

The `config` JSONB can hold per-view settings like custom colors, min/max overrides, etc.

### 4.3 Backend

**File: `backend/src/routes/admin.js`**

New endpoints:
- `GET /api/admin/answer-views` — list all answer views (optionally filter by questionnaire)
- `GET /api/admin/answer-views/:id` — get single answer view with questions
- `POST /api/admin/answer-views` — create answer view (name, type, questionnaire_id, question IDs with labels)
- `PUT /api/admin/answer-views/:id` — update answer view
- `DELETE /api/admin/answer-views/:id` — delete answer view

**File: `backend/src/routes/admin.js` (results)**

- When generating results, also compute answer view aggregates:
  - For radar view: calculate average value per question (axis), return as combined data set

### 4.4 Frontend

**New component: `frontend/src/components/AdminAnswerViews.jsx`**

- CRUD interface for managing answer views
- Form: select questionnaire, then select scale questions from that questionnaire to include as radar axes
- Set axis labels (defaults to question text, but can be overridden with short labels)
- Preview the radar shape

**Updated component: `frontend/src/components/AdminResults.jsx`**

- After per-question analytics, render each answer view as a composite visualization
- Radar view: reuse the existing `RadarChart` component in read-only mode
  - Map each included question's average score to a radar axis
  - Display below the individual question analytics, in a separate "Answer Views" section

**Updated component: `frontend/src/components/AdminQuestions.jsx`**

- The `continuous_scale` question type dropdown option is removed (or renamed/hidden)
- The existing continuous_scale functionality is superseded by answer views
- Questions of type `continuous_scale` that already exist remain functional for backward compatibility

### 4.5 Relationship to continuous_scale

The existing `continuous_scale` question type was an earlier attempt at radar charts attached to individual questions. With answer views, the radar visualization is decoupled from the question level — it becomes a composition of multiple regular scale questions.

- Keep `continuous_scale` in the type constraint for backward compatibility
- Do not expose it in the question type dropdown going forward
- Existing `continuous_scale` questions continue to work in admin results
- New radar visualizations should use answer views

---

## 5. Consolidate Migrations into Schema

### 5.1 Current State

- `schema.sql` — canonical schema, already contains most migration changes inline (via `ADD COLUMN IF NOT EXISTS`, `DO $$ ... END $$` blocks)
- `migrations/` — 7 numbered migration files + 1 `add_word_cloud_support.sql`
- `db:init` script runs `schema.sql` directly

### 5.2 Approach

1. **Rewrite `schema.sql`** to be a clean, standalone, idempotent schema definition:
   - Remove all `ADD COLUMN IF NOT EXISTS` migration-style patches
   - Remove all `DO $$ ... END $$` conditional blocks
   - Define tables with their final column set directly in `CREATE TABLE` statements
   - Include new tables (`answer_views`, `answer_view_questions`)
   - Include new columns on `answer_scales` (scale_mode, step, labels, min/max values)
   - Include `NUMERIC` type for `feedback_answers.value`
   - Keep `CREATE INDEX IF NOT EXISTS` statements (these are safe to keep idempotent)

2. **Clear the migrations directory** — remove all 001–007 + add_word_cloud_support migration files

3. **Add a `db:migrate` npm script** for future use:
   - The script reads migration files from `migrations/` and runs them in order
   - Track applied migrations in a `schema_migrations` table
   - This stays empty now but is ready for future schema changes
   - Add `008_refactor_scales_wordsets_views.sql` as the migration for existing databases to upgrade to the new schema

4. **Keep `db:init`** as-is — it runs `schema.sql` for fresh installations

### 5.3 Migration for Existing Databases

**File: `migrations/008_refactor_scales_wordsets_views.sql`**

```sql
-- Add enhanced scale columns
ALTER TABLE answer_scales
ADD COLUMN IF NOT EXISTS scale_mode VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS step NUMERIC(4,2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS min_label JSONB,
ADD COLUMN IF NOT EXISTS max_label JSONB,
ADD COLUMN IF NOT EXISTS min_value NUMERIC,
ADD COLUMN IF NOT EXISTS max_value NUMERIC;

-- Change feedback_answers.value to NUMERIC
ALTER TABLE feedback_answers
ALTER COLUMN value TYPE NUMERIC USING value::NUMERIC;

-- Add answer_views table
CREATE TABLE IF NOT EXISTS answer_views ( ... );
CREATE TABLE IF NOT EXISTS answer_view_questions ( ... );

-- Add constraints
ALTER TABLE answer_scales ADD CONSTRAINT ... CHECK (step >= 0.01 AND step <= 1);
ALTER TABLE answer_scales ADD CONSTRAINT ... CHECK (scale_mode IN ('normal', 'bipolar'));

-- Schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. File Change Summary

### Backend Files

| File | Changes |
|---|---|
| `backend/src/db/schema.sql` | Rewrite as clean schema; add answer_views tables, scale columns, schema_migrations |
| `backend/src/db/migrations/001–007_*.sql` | Delete |
| `backend/src/db/migrations/add_word_cloud_support.sql` | Delete |
| `backend/src/db/migrations/008_refactor_scales_wordsets_views.sql` | New — upgrade migration for existing DBs |
| `backend/package.json` | Add `db:migrate` script |
| `backend/src/db/migrate.js` | New — migration runner (reads migrations dir, tracks in schema_migrations) |
| `backend/src/routes/admin.js` | Update scale CRUD; add answer-view CRUD; add word-set route aliases; update results |
| `backend/src/routes/locations.js` | Filter out non-respondent question types; include new scale fields |
| `backend/src/routes/feedback.js` | Accept NUMERIC values |

### Frontend Files

| File | Changes |
|---|---|
| `frontend/src/components/AdminAnswerScales.jsx` | Add scale_mode, step, labels, min/max value fields |
| `frontend/src/components/AdminWordCloudOptions.jsx` → `AdminWordSets.jsx` | Rename + update labels |
| `frontend/src/components/WordCloudInput.jsx` → `WordSetInput.jsx` | Rename |
| `frontend/src/components/AdminQuestions.jsx` | Update type dropdown; hide continuous_scale; word cloud → word set |
| `frontend/src/components/AdminResults.jsx` | Add answer views section; update labels; handle fractional values |
| `frontend/src/components/AdminAnswerViews.jsx` | New — CRUD for answer views |
| `frontend/src/components/RadarChart.jsx` | Update to use scale min/max/step/labels; used for answer view rendering |
| `frontend/src/pages/FeedbackPage.jsx` | Guard against continuous_scale; update word cloud refs; slider for fractional scales |
| `frontend/src/pages/AdminPage.jsx` | Add Answer Views tab; update navigation labels |
| `frontend/src/i18n/index.js` | Add new translation keys; rename word cloud keys |

---

## 7. Implementation Order

The work should be done in this sequence to maintain a working system at each step:

### Phase 1: Schema Consolidation
1. Rewrite `schema.sql` as clean schema (including all new structures)
2. Write migration `008` for existing databases
3. Create `db/migrate.js` runner + `db:migrate` npm script
4. Delete old migration files
5. Add `schema_migrations` tracking table

### Phase 2: Enhanced Scales (Backend)
6. Add new columns to answer_scales CRUD
7. Update feedback answer handling for NUMERIC values
8. Update locations route to include new scale fields

### Phase 3: Enhanced Scales (Frontend)
9. Update `AdminAnswerScales.jsx` form with new fields
10. Update `FeedbackPage.jsx` — slider rendering, endpoint labels, bipolar support
11. Update `RadarChart.jsx` for new scale config
12. Update `AdminResults.jsx` for fractional/bipolar analytics

### Phase 4: Word Cloud → Word Set Rename
13. Rename frontend components
14. Update all UI labels and i18n keys
15. Add backend route aliases

### Phase 5: Kiosk Mode Filtering
16. Filter non-respondent types in locations.js
17. Add frontend guard in FeedbackPage.jsx

### Phase 6: Answer Views
18. Create answer_views backend CRUD
19. Create `AdminAnswerViews.jsx` component
20. Update `AdminResults.jsx` with answer view rendering
21. Update `AdminPage.jsx` navigation
22. Hide `continuous_scale` from question type dropdown

---

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Existing `continuous_scale` questions break | Keep type in DB constraint; keep rendering code; just hide from new question creation |
| `feedback_answers.value` INTEGER→NUMERIC migration | Use `USING value::NUMERIC` in ALTER — lossless for existing integer data |
| Word cloud rename breaks API consumers | Keep old endpoints working alongside new aliases |
| Schema.sql rewrite misses something | Compare against current running schema dump before deploying |
| Fractional step values cause floating-point display issues | Round display values to step precision |
