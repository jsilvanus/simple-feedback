# Continuous Scale / Radar Chart Question Type

## Overview

The continuous scale/radar chart question type allows admins to create interactive visualizations for multi-dimensional feedback. The display automatically adapts based on the number of axes configured:

- **1 axis**: Horizontal line with continuous color gradient (red → yellow → green)
- **2 axes**: V-shaped display with two scales
- **3+ axes**: Full radar chart with polygon visualization

## Configuration

### Database Schema

The new question type `continuous_scale` has been added to the allowed types in the `questions` table. It uses the same `answer_scales` configuration system as the regular `scale` type.

### Answer Scale Configuration

To create a continuous scale question, you need to:

1. Create an answer scale with axes configuration
2. Create a question with type `continuous_scale`
3. Link the answer scale to the question in a questionnaire

#### Answer Scale Format

The answer scale for continuous_scale uses the following JSON structure in the `buttons` field:

```json
[
  {
    "value": 1,
    "label": "Service Quality",
    "min": 0,
    "max": 10
  },
  {
    "value": 2,
    "label": "Cleanliness",
    "min": 0,
    "max": 10
  },
  {
    "value": 3,
    "label": "Atmosphere",
    "min": 0,
    "max": 10
  }
]
```

Each axis configuration includes:
- `value`: Unique identifier for the axis (used as key in answer data)
- `label`: Display name for the axis
- `min`: Minimum value on the scale (default: 0)
- `max`: Maximum value on the scale (default: 10)

### Example SQL

```sql
-- Create an answer scale for a single axis (line display)
INSERT INTO answer_scales (name, buttons) VALUES (
  'Satisfaction Line',
  '[{"value": 1, "label": "Overall Satisfaction", "min": 0, "max": 100}]'
);

-- Create an answer scale for two axes (V-shape display)
INSERT INTO answer_scales (name, buttons) VALUES (
  'Quality vs Value',
  '[
    {"value": 1, "label": "Quality", "min": 0, "max": 10},
    {"value": 2, "label": "Value", "min": 0, "max": 10}
  ]'
);

-- Create an answer scale for multiple axes (radar chart)
INSERT INTO answer_scales (name, buttons) VALUES (
  'Restaurant Experience',
  '[
    {"value": 1, "label": "Food Quality", "min": 0, "max": 10},
    {"value": 2, "label": "Service", "min": 0, "max": 10},
    {"value": 3, "label": "Atmosphere", "min": 0, "max": 10},
    {"value": 4, "label": "Value", "min": 0, "max": 10},
    {"value": 5, "label": "Cleanliness", "min": 0, "max": 10}
  ]'
);

-- Create a continuous_scale question
INSERT INTO questions (text, type) VALUES (
  'Rate your experience across different aspects',
  'continuous_scale'
);

-- Link the question to a questionnaire with the answer scale
INSERT INTO questionnaire_questions (
  questionnaire_id, 
  question_id, 
  answer_scale_id, 
  page_number, 
  order_index
) VALUES (
  1,  -- your questionnaire ID
  10, -- your question ID
  3,  -- your answer scale ID (e.g., Restaurant Experience)
  1,
  0
);
```

## User Interaction

Users can interact with the continuous scale in the following ways:

### Single Axis (Line)
- Click or tap anywhere on the horizontal line to set the value
- The marker (blue circle) will move to the clicked position
- The value is displayed as a continuous gradient from red (low) to green (high)

### Two Axes (V-Shape)
- Click or tap on either line to set the value for that axis
- Each axis can be independently adjusted
- Color gradients show low to high values

### Multiple Axes (Radar Chart)
- Click or tap near any axis line to set the value
- The system detects which axis you're closest to
- The filled polygon updates to show your selections
- All axes can be independently adjusted

## Data Storage

Answers for continuous_scale questions are stored as JSON objects in the `text_value` column of `feedback_answers`:

```json
{
  "1": 8.5,
  "2": 7.2,
  "3": 9.1
}
```

Where the keys are the axis `value` identifiers and the values are the selected ratings.

## Migration

To enable this feature on an existing database, run the migration:

```bash
psql -h localhost -U postgres -f backend/src/db/migrations/002_add_continuous_scale_type.sql simple_feedback
```

Or update your database manually:

```sql
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_type_check,
ADD CONSTRAINT questions_type_check CHECK (type IN ('scale', 'text', 'wordcloud', 'continuous_scale'));
```

## Admin Interface

The admin interface has been updated to support creating continuous_scale questions:

1. Go to the Questions tab in the admin panel
2. Click "Add Question"
3. Select "Continuous Scale (Radar)" from the question type dropdown
4. Enter your question text
5. Create or select an answer scale with the appropriate axes configuration

## Accessibility

The radar chart component includes:
- Click/tap interaction support
- Responsive sizing (adapts to screen size)
- High contrast mode support
- Touch-optimized for tablet kiosks
