-- Add per-question axis configuration for continuous_scale questions

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS continuous_axes JSONB;

CREATE INDEX IF NOT EXISTS idx_questions_continuous_axes ON questions USING GIN(continuous_axes);
