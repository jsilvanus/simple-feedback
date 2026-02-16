-- Migration: Enhance schedules to support weekday/time patterns and multiple questionnaires

-- Add schedule type and pattern support
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'date_based' 
    CHECK (schedule_type IN ('date_based', 'recurring_weekday')),
ADD COLUMN IF NOT EXISTS weekday_pattern JSONB, -- For recurring_weekday type: {"days": [1,2,3], "start_hour": "09:00", "end_hour": "17:00"}
ADD COLUMN IF NOT EXISTS show_only_one BOOLEAN DEFAULT false;

-- Update existing schedules to have the date_based type
UPDATE schedules SET schedule_type = 'date_based' WHERE schedule_type IS NULL;

-- Create junction table for schedules with multiple questionnaires
CREATE TABLE IF NOT EXISTS schedule_questionnaires (
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (schedule_id, questionnaire_id)
);

-- Migrate existing schedule-questionnaire relationships
INSERT INTO schedule_questionnaires (schedule_id, questionnaire_id, display_order)
SELECT id, questionnaire_id, 0
FROM schedules
WHERE questionnaire_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_schedule_questionnaires_schedule ON schedule_questionnaires(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(schedule_type);

-- Note: We keep questionnaire_id for backward compatibility but it's now optional
-- New schedules should use schedule_questionnaires junction table
ALTER TABLE schedules ALTER COLUMN questionnaire_id DROP NOT NULL;
