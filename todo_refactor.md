# Refactoring TODO List: Scales, Word Sets & Answer Views

## Phase 1: Schema Consolidation

- [ ] **1.1** Rewrite `backend/src/db/schema.sql` as a clean, standalone schema
  - Remove all `ADD COLUMN IF NOT EXISTS` migration patches
  - Remove all `DO $$ ... END $$` conditional blocks
  - Define all tables with final column sets in `CREATE TABLE`
  - Add `answer_views` table
  - Add `answer_view_questions` junction table
  - Add `schema_migrations` tracking table
  - Add new `answer_scales` columns: `scale_mode`, `step`, `min_label`, `max_label`, `min_value`, `max_value`
  - Change `feedback_answers.value` from `INTEGER` to `NUMERIC`
  - Keep `CREATE INDEX IF NOT EXISTS` statements
- [ ] **1.2** Write `backend/src/db/migrations/008_refactor_scales_wordsets_views.sql`
  - ALTER answer_scales to add new columns
  - ALTER feedback_answers.value to NUMERIC
  - CREATE answer_views and answer_view_questions tables
  - CREATE schema_migrations table
  - Add constraints for step range and scale_mode
- [ ] **1.3** Create `backend/src/db/migrate.js` migration runner
  - Read migration files from `migrations/` directory in order
  - Track applied migrations in `schema_migrations` table
  - Skip already-applied migrations
  - Log progress
- [ ] **1.4** Add `db:migrate` script to `backend/package.json`
- [ ] **1.5** Delete old migration files: `001` through `007` + `add_word_cloud_support.sql`

## Phase 2: Enhanced Scales — Backend

- [ ] **2.1** Update answer-scales CRUD in `backend/src/routes/admin.js`
  - POST/PUT: accept `scaleMode`, `step`, `minLabel`, `maxLabel`, `minValue`, `maxValue`
  - Validate step is between 0.01 and 1
  - Validate scaleMode is 'normal' or 'bipolar'
  - GET: return new fields in response
- [ ] **2.2** Update `backend/src/routes/feedback.js`
  - Accept NUMERIC (non-integer) feedback values
- [ ] **2.3** Update `backend/src/routes/locations.js`
  - Include new scale fields (`scaleMode`, `step`, `minLabel`, `maxLabel`, `minValue`, `maxValue`) in questionnaire delivery

## Phase 3: Enhanced Scales — Frontend

- [ ] **3.1** Update `frontend/src/components/AdminAnswerScales.jsx`
  - Add scale mode selector (Normal / Bipolar radio buttons or dropdown)
  - Add step input (number input, min 0.01, max 1, step 0.01)
  - Add min/max label fields (with fi/en/sv inputs each)
  - Add min/max value number inputs
  - Show bipolar hint (-N..0..N) when bipolar selected
  - Update scale preview to show endpoint labels
- [ ] **3.2** Update `frontend/src/pages/FeedbackPage.jsx`
  - When scale has step < 1: render an HTML range slider instead of buttons
  - Show `minLabel` and `maxLabel` at scale endpoints
  - For bipolar scales: visually center at 0, show negative/positive sides
  - For normal integer step=1: keep existing button rendering (backward compatible)
- [ ] **3.3** Update `frontend/src/components/RadarChart.jsx`
  - Read `minValue`/`maxValue` from scale config (instead of inferring from buttons)
  - Support fractional step values
  - Display endpoint labels on axes if available
- [ ] **3.4** Update `frontend/src/components/AdminResults.jsx`
  - Handle fractional values in distribution histograms (bucket by step)
  - Display endpoint labels alongside averages
  - Handle bipolar scale display (show scale centered on 0)

## Phase 4: Word Cloud → Word Set Rename

- [ ] **4.1** Rename frontend component files
  - `AdminWordCloudOptions.jsx` → `AdminWordSets.jsx`
  - `WordCloudInput.jsx` → `WordSetInput.jsx`
  - Update all imports referencing old filenames
- [ ] **4.2** Update UI text throughout frontend
  - All "Word Cloud" labels → "Word Set"
  - `AdminQuestions.jsx`: type dropdown, icon, badge text
  - `AdminResults.jsx`: result section headers
  - `FeedbackPage.jsx`: component usage, CSS classes
  - `AdminPage.jsx`: navigation tab labels
- [ ] **4.3** Update i18n translation keys
  - Rename `admin.wordCloudOptions` → `admin.wordSets`
  - Rename `admin.addWordCloudOptionSet` → `admin.addWordSet`
  - Rename `admin.editWordCloudOptionSet` → `admin.editWordSet`
  - Rename `admin.loadingWordCloudOptions` → `admin.loadingWordSets`
  - Add any new keys needed
- [ ] **4.4** Add backend route aliases
  - `GET/POST /api/admin/word-sets` → same handler as `/api/admin/word-cloud-options`
  - `PUT /api/admin/word-sets/:id` → same handler
  - Keep old endpoints working

## Phase 5: Kiosk Mode Filtering

- [ ] **5.1** Update `backend/src/routes/locations.js`
  - Filter questionnaire questions to only include types: `scale`, `text`, `wordcloud`
  - Exclude `continuous_scale` from kiosk/feedback responses
- [ ] **5.2** Add frontend guard in `frontend/src/pages/FeedbackPage.jsx`
  - Skip rendering any question where `type === 'continuous_scale'`
  - Defense-in-depth in case backend filtering is bypassed

## Phase 6: Answer Views

- [ ] **6.1** Create answer-views CRUD endpoints in `backend/src/routes/admin.js`
  - `GET /api/admin/answer-views` — list (optional `?questionnaireId=` filter)
  - `GET /api/admin/answer-views/:id` — single view with included questions
  - `POST /api/admin/answer-views` — create (name, viewType, questionnaireId, questions with labels/order)
  - `PUT /api/admin/answer-views/:id` — update
  - `DELETE /api/admin/answer-views/:id` — delete
- [ ] **6.2** Update results endpoint in `backend/src/routes/admin.js`
  - For each answer view in the queried questionnaire, compute aggregate data
  - Radar view: return average value per question (axis)
- [ ] **6.3** Create `frontend/src/components/AdminAnswerViews.jsx`
  - CRUD list/form interface (consistent with other admin components)
  - Form: select questionnaire → pick scale questions from it → set axis labels → set order
  - Preview radar shape
- [ ] **6.4** Update `frontend/src/components/AdminResults.jsx`
  - Add "Answer Views" section below per-question analytics
  - For each radar answer view: render `RadarChart` in read-only mode with average values
  - Map each included question's mean score to a radar axis
- [ ] **6.5** Update `frontend/src/pages/AdminPage.jsx`
  - Add "Answer Views" tab in admin navigation
  - Route to `AdminAnswerViews` component
- [ ] **6.6** Update `frontend/src/components/AdminQuestions.jsx`
  - Hide or remove `continuous_scale` from the question type dropdown
  - Keep backward compatibility for existing continuous_scale questions (display but don't allow creation)

## Post-Implementation

- [ ] **7.1** Test fresh database creation with new `schema.sql` (`db:init`)
- [ ] **7.2** Test migration of existing database with `008` migration (`db:migrate`)
- [ ] **7.3** Verify existing scale questions still render correctly (backward compatibility)
- [ ] **7.4** Verify existing word cloud/word set questions still work
- [ ] **7.5** Verify existing continuous_scale questions still display in admin results
- [ ] **7.6** Test new scale modes: normal with fractional step, bipolar
- [ ] **7.7** Test endpoint labels display in kiosk and admin views
- [ ] **7.8** Test answer view creation, editing, deletion
- [ ] **7.9** Test radar answer view rendering in admin results
- [ ] **7.10** Verify kiosk mode does not show continuous_scale or answer view questions
