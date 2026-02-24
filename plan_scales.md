# Multi-Scale Question Feature Plan

## Concept

A single question can contain **multiple scales** (sub-scales), each independently configured. Instead of creating five separate questions to rate five aspects of a service, the user creates one multi-scale question with five rows. Each row has its own label, and optionally its own scale configuration.

**Example use case:** "Rate your visit" with sub-scales for Food, Service, Ambiance, Cleanliness, Value — all displayed together as a cohesive unit.

---

## Feature Overview

### Core Idea

A **multi-scale question** is a question with one or more **scale items**. Each item has:

- A **label** (what is being rated, e.g., "Food quality") — i18n supported (fi/en/sv)
- A **scale reference** — which `answer_scale` to use for this item
- **Display overrides** — per-item settings that can override the scale defaults

When all items share the same scale, the question renders as a compact **matrix**. When items use different scales, they stack individually.

### Display Modes

Each scale item (or the question as a whole) can be displayed as:

| Mode | Description | Best For |
|------|-------------|----------|
| **buttons** | Discrete clickable buttons in a row | Small scales (1-5, 1-7), emoji scales |
| **slider** | Continuous draggable slider/line | Larger ranges, fractional values, NPS-style |
| **labeled-line** | A horizontal line with tick marks at each value | Visual analog scales, clean appearance |
| **stars** | Star rating (filled/unfilled icons) | Satisfaction, product ratings |
| **thumbs** | Thumbs up / thumbs down (binary) | Quick positive/negative feedback |

The default is determined by the answer scale's `step` value (step=1 → buttons, step<1 → slider), but can be overridden per question.

### End Label Visibility

Each scale item can independently control:

- `show_end_labels`: boolean — show/hide the min/max endpoint labels
- `show_value_labels`: boolean — show/hide numeric values on buttons/ticks
- `show_item_label`: boolean — show/hide the row label (e.g., "Food quality")

This lets admins create clean, minimal UIs (just a line with two end words) or detailed ones (labels, values, and endpoints all visible).

---

## Data Model

### New Table: `question_scale_items`

```sql
CREATE TABLE question_scale_items (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_scale_id INTEGER NOT NULL REFERENCES answer_scales(id),
  label JSONB NOT NULL DEFAULT '{}',         -- i18n: {fi, en, sv}
  order_index INTEGER NOT NULL DEFAULT 0,

  -- Display overrides (NULL = inherit from answer_scale or question defaults)
  display_mode TEXT,                          -- 'buttons' | 'slider' | 'labeled-line' | 'stars' | 'thumbs'
  show_end_labels BOOLEAN DEFAULT true,
  show_value_labels BOOLEAN DEFAULT true,
  show_item_label BOOLEAN DEFAULT true,

  -- Optional per-item overrides
  min_label_override JSONB,                  -- Override the scale's min_label for this item
  max_label_override JSONB,                  -- Override the scale's max_label for this item
  required BOOLEAN DEFAULT true,

  UNIQUE(question_id, order_index)
);
```

### Changes to `questions` Table

```sql
-- Add columns to questions table
ALTER TABLE questions ADD COLUMN multi_scale_layout TEXT DEFAULT 'stacked';
  -- 'stacked': each item on its own row, full width
  -- 'matrix': compact grid with shared column headers (only when all items share same scale)
  -- 'compact': tighter vertical spacing, minimal labels

ALTER TABLE questions ADD COLUMN multi_scale_defaults JSONB DEFAULT '{}';
  -- Default display settings applied to all items unless overridden:
  -- {
  --   "displayMode": "buttons",
  --   "showEndLabels": true,
  --   "showValueLabels": true,
  --   "showItemLabel": true
  -- }
```

### Changes to `feedback_answers` Table

```sql
-- Add column to track which scale item this answer belongs to
ALTER TABLE feedback_answers ADD COLUMN scale_item_id INTEGER REFERENCES question_scale_items(id);
```

When a multi-scale question is answered, each scale item produces its own `feedback_answers` row, linked via `scale_item_id`. This preserves backward compatibility — single-scale questions still have `scale_item_id = NULL`.

---

## Backward Compatibility

- Existing `scale` questions with a direct `answer_scale_id` on the `questions` table continue to work as before (zero items in `question_scale_items`)
- The system treats a question with `answer_scale_id` set and no `question_scale_items` as a legacy single-scale question
- A question with one or more `question_scale_items` is a multi-scale question (even if it only has one item — this is valid)
- Migration creates no items for existing questions; they remain single-scale
- The `answer_scale_id` on `questions` becomes optional/unused when `question_scale_items` exist

---

## API Changes

### Admin Endpoints

**GET /api/admin/questions**
- Response includes `scaleItems` array for each question (empty array for legacy single-scale)

**POST /api/admin/questions**
```json
{
  "text": { "fi": "Arvioi vierailusi", "en": "Rate your visit" },
  "type": "scale",
  "multiScaleLayout": "stacked",
  "multiScaleDefaults": {
    "displayMode": "buttons",
    "showEndLabels": true,
    "showValueLabels": false
  },
  "scaleItems": [
    {
      "label": { "fi": "Ruuan laatu", "en": "Food quality" },
      "answerScaleId": 3,
      "orderIndex": 0,
      "displayMode": null,
      "showEndLabels": null,
      "required": true
    },
    {
      "label": { "fi": "Palvelu", "en": "Service" },
      "answerScaleId": 3,
      "orderIndex": 1,
      "required": true
    },
    {
      "label": { "fi": "Tunnelma", "en": "Ambiance" },
      "answerScaleId": 5,
      "orderIndex": 2,
      "displayMode": "slider",
      "showEndLabels": true,
      "required": false
    }
  ]
}
```

**PUT /api/admin/questions/:id**
- Same shape; replaces all `scaleItems` (delete + re-insert)

### Public Endpoints

**GET /api/locations/:slug/questionnaire**
- Scale questions now include `scaleItems` in their response
- Each item includes resolved display settings (merged defaults + overrides)
- Legacy single-scale questions return `scaleItems: []` and work as before

### Feedback Submission

**POST /api/feedback**
```json
{
  "locationId": 1,
  "questionnaireId": 10,
  "answers": [
    { "questionId": 42, "scaleItemId": 101, "value": 4 },
    { "questionId": 42, "scaleItemId": 102, "value": 5 },
    { "questionId": 42, "scaleItemId": 103, "value": 3.5 }
  ]
}
```

---

## Frontend Components

### Admin: Question Editor (`AdminQuestions.jsx`)

When type is `scale`, show a **scale items editor**:

1. **"Add scale item" button** — appends a new row
2. Each row shows:
   - Drag handle for reordering
   - Label input (with i18n toggle for fi/en/sv)
   - Answer scale dropdown (reuse existing scales)
   - Display mode override dropdown (auto / buttons / slider / labeled-line / stars / thumbs)
   - Toggles: show end labels, show value labels, required
   - Delete button
3. **Question-level settings** (above the items):
   - Layout selector: stacked / matrix / compact
   - Default display mode
   - Default toggle states
4. **Live preview** below the editor showing how the question will look

### Admin: Scale Editor (`AdminAnswerScales.jsx`)

Minor enhancements:
- Add a **preview** section that renders the scale in each display mode (buttons, slider, labeled-line, stars, thumbs)
- Show usage count (how many questions/items reference this scale)

### Kiosk: Feedback Page (`FeedbackPage.jsx`)

New rendering logic for multi-scale questions:

**Stacked layout:**
```
┌─────────────────────────────────────┐
│  Rate your visit                     │
│                                      │
│  Food quality                        │
│  Terrible ○ ○ ○ ○ ○ Excellent       │
│                                      │
│  Service                             │
│  Terrible ○ ○ ○ ○ ○ Excellent       │
│                                      │
│  Ambiance                            │
│  Low ─────────●───────────── High    │
└─────────────────────────────────────┘
```

**Matrix layout** (all items share the same scale):
```
┌─────────────────────────────────────┐
│  Rate your visit                     │
│              1   2   3   4   5       │
│  Food       ○   ○   ○   ○   ○      │
│  Service    ○   ○   ○   ○   ○      │
│  Ambiance   ○   ○   ○   ○   ○      │
│  Value      ○   ○   ○   ○   ○      │
│                                      │
│         Terrible ←──→ Excellent      │
└─────────────────────────────────────┘
```

**Compact layout:**
```
┌─────────────────────────────────────┐
│  Rate your visit                     │
│  Food      ○ ○ ○ ○ ○               │
│  Service   ○ ○ ○ ○ ○               │
│  Ambiance  ○ ○ ○ ○ ○               │
└─────────────────────────────────────┘
```

### Display Mode Renderers

Create a set of small, reusable renderer components:

| Component | Renders |
|-----------|---------|
| `ScaleButtons` | Row of clickable circular/square buttons with optional labels |
| `ScaleSlider` | HTML range input with styled track and thumb |
| `ScaleLabeledLine` | SVG/CSS line with tick marks at each value |
| `ScaleStars` | Row of star icons, click to set rating |
| `ScaleThumbs` | Two large thumb icons (up/down), binary choice |
| `ScaleItemRow` | Wraps any renderer with item label + end labels |
| `MultiScaleQuestion` | Orchestrates layout (stacked/matrix/compact) for a set of items |

---

## Results & Analytics

### Per-Item Breakdown

In `AdminResults.jsx`, multi-scale questions show:

- **Summary bar** — overall average across all items
- **Per-item rows** — each item's average, distribution, and count
- **Comparison view** — horizontal bar chart comparing all items side by side
- Optionally feed into **answer views** (radar charts) — each scale item can be a separate axis

### CSV Export

Multi-scale answers export with additional columns:
```
session_id, question_id, question_text, scale_item_id, scale_item_label, value
abc-123,    42,          "Rate visit",  101,           "Food quality",    4
abc-123,    42,          "Rate visit",  102,           "Service",         5
abc-123,    42,          "Rate visit",  103,           "Ambiance",        3.5
```

### Answer Views Integration

Scale items can be individually selected as axes in answer views (radar charts). This replaces the need for `continuous_scale` questions — a multi-scale question with a radar answer view achieves the same result with better UX.

---

## Implementation Phases

### Phase 1: Database & Backend
1. Create migration for `question_scale_items` table
2. Add `multi_scale_layout` and `multi_scale_defaults` columns to `questions`
3. Add `scale_item_id` column to `feedback_answers`
4. Update admin CRUD endpoints for questions (read/write scale items)
5. Update public questionnaire endpoint to include scale items
6. Update feedback submission to accept `scaleItemId`
7. Backward-compatibility: questions without scale items work exactly as before

### Phase 2: Admin UI
1. Build scale items editor in `AdminQuestions.jsx`
2. Add layout and default settings controls
3. Add live preview panel
4. Enhance `AdminAnswerScales.jsx` with multi-mode preview
5. Update answer views to support individual scale items as axes

### Phase 3: Kiosk/Respondent UI
1. Build `MultiScaleQuestion` component
2. Build display mode renderer components (buttons, slider, labeled-line, stars, thumbs)
3. Integrate into `FeedbackPage.jsx`
4. Handle validation (required items must have a value before submit)
5. Touch-optimized: large tap targets, smooth slider interaction
6. Accessibility: keyboard navigation between items, ARIA labels

### Phase 4: Results & Analytics
1. Update `AdminResults.jsx` for per-item breakdowns
2. Build comparison bar chart view
3. Update CSV export format
4. Update answer views to allow scale items as individual axes
5. Consider deprecating `continuous_scale` question type in favor of multi-scale + answer view

---

## Design Considerations

### Kiosk UX
- Touch targets must remain large (44px minimum)
- Avoid scroll-heavy layouts — if a multi-scale question has many items, consider pagination or a scrollable container with clear visual indication
- Matrix layout should only be offered when all items share the same scale (enforce in admin UI)
- Animations: subtle highlight on item selection, smooth transitions between items

### i18n
- All labels (item label, end labels) support fi/en/sv
- Layout terms (matrix, stacked, compact) are admin-only and can stay in English or be translated in the admin UI

### Validation
- At least one scale item required for a multi-scale question
- Each item must reference a valid answer scale
- `orderIndex` must be unique within a question
- Matrix layout only allowed when all items reference the same answer scale
- Required items must be answered before submission

### Performance
- Multi-scale questions with many items (10+) should lazy-render off-screen items
- Feedback submission batches all item answers in a single request (already the case)

---

## Open Questions

1. **Maximum items per question?** Should we enforce a limit (e.g., 10-15 items) to prevent unusable questions, or leave it unrestricted?
2. **Shared vs. independent scales:** Should there be a "quick mode" where you just set one scale for all items, vs. the full per-item scale assignment?
3. **Conditional items:** Should items be conditionally visible based on other answers? (Probably out of scope for v1)
4. **Image labels:** Should scale items support image labels in addition to text? (e.g., photos of menu items to rate)
5. **Grouping within a question:** For very long item lists, should we support sub-groups with headers? (e.g., "Food" group with items, "Service" group with items)
