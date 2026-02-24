-- Migration 009: Multi-scale questions
-- Adds support for questions with multiple independently-configured scale items.

-- Create question_scale_items table
CREATE TABLE IF NOT EXISTS question_scale_items (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_scale_id INTEGER NOT NULL REFERENCES answer_scales(id),
  label JSONB NOT NULL DEFAULT '{}',
  order_index INTEGER NOT NULL DEFAULT 0,

  -- Display overrides (NULL = inherit from answer_scale or question defaults)
  display_mode TEXT CHECK (display_mode IN ('buttons', 'slider', 'labeled-line', 'stars', 'thumbs')),
  show_end_labels BOOLEAN DEFAULT true,
  show_value_labels BOOLEAN DEFAULT true,
  show_item_label BOOLEAN DEFAULT true,

  -- Optional per-item label overrides
  min_label_override JSONB,
  max_label_override JSONB,

  required BOOLEAN DEFAULT true,

  UNIQUE(question_id, order_index)
);

-- Add multi_scale_layout and multi_scale_defaults columns to questions
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS multi_scale_layout TEXT DEFAULT 'stacked',
ADD COLUMN IF NOT EXISTS multi_scale_defaults JSONB DEFAULT '{}';

ALTER TABLE questions
DROP CONSTRAINT IF EXISTS questions_multi_scale_layout_check;

ALTER TABLE questions
ADD CONSTRAINT questions_multi_scale_layout_check
  CHECK (multi_scale_layout IN ('stacked', 'matrix', 'compact'));

-- Add scale_item_id to feedback_answers for per-item tracking
ALTER TABLE feedback_answers
ADD COLUMN IF NOT EXISTS scale_item_id INTEGER REFERENCES question_scale_items(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_question_scale_items_question ON question_scale_items(question_id);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_scale_item ON feedback_answers(scale_item_id);

-- Record this migration
INSERT INTO schema_migrations (version) VALUES ('009_multi_scale_questions')
ON CONFLICT DO NOTHING;
