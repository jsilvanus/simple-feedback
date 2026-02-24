-- Migration 008: Enhanced scales, answer views, schema_migrations tracking
-- Upgrades an existing database to the refactored schema.

-- Add enhanced scale columns to answer_scales
ALTER TABLE answer_scales
ADD COLUMN IF NOT EXISTS scale_mode VARCHAR(20) DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS step NUMERIC(4,2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS min_label JSONB,
ADD COLUMN IF NOT EXISTS max_label JSONB,
ADD COLUMN IF NOT EXISTS min_value NUMERIC,
ADD COLUMN IF NOT EXISTS max_value NUMERIC;

ALTER TABLE answer_scales
DROP CONSTRAINT IF EXISTS answer_scales_scale_mode_check;
ALTER TABLE answer_scales
ADD CONSTRAINT answer_scales_scale_mode_check CHECK (scale_mode IN ('normal', 'bipolar'));

ALTER TABLE answer_scales
DROP CONSTRAINT IF EXISTS answer_scales_step_check;
ALTER TABLE answer_scales
ADD CONSTRAINT answer_scales_step_check CHECK (step >= 0.01 AND step <= 1);

-- Change feedback_answers.value from INTEGER to NUMERIC (lossless for existing integer data)
ALTER TABLE feedback_answers
ALTER COLUMN value TYPE NUMERIC USING value::NUMERIC;

-- Add answer_views table
CREATE TABLE IF NOT EXISTS answer_views (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    view_type VARCHAR(50) NOT NULL CHECK (view_type IN ('radar')),
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add answer_view_questions junction table
CREATE TABLE IF NOT EXISTS answer_view_questions (
    answer_view_id INTEGER NOT NULL REFERENCES answer_views(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    axis_label VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (answer_view_id, question_id)
);

-- Add schema_migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Record all prior migrations as already applied
INSERT INTO schema_migrations (version) VALUES
    ('001_add_features'),
    ('add_word_cloud_support'),
    ('002_add_continuous_scale_type'),
    ('003_enhance_schedules'),
    ('004_add_location_groups'),
    ('005_move_question_config_to_question_level'),
    ('006_add_continuous_axes_to_questions'),
    ('007_schedule_multi_location'),
    ('008_refactor_scales_wordsets_views')
ON CONFLICT DO NOTHING;
