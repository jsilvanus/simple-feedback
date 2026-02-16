-- Database schema for Simple Feedback App

CREATE TABLE IF NOT EXISTS location_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN DEFAULT true,
    group_id INTEGER REFERENCES location_groups(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answer_scales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    buttons JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS word_cloud_options (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    words JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('scale', 'text', 'wordcloud', 'continuous_scale')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questionnaires (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questionnaire_questions (
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL DEFAULT 1,
    answer_scale_id INTEGER REFERENCES answer_scales(id) ON DELETE SET NULL,
    word_cloud_options_id INTEGER REFERENCES word_cloud_options(id) ON DELETE SET NULL,
    max_selections INTEGER DEFAULT 3,
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (questionnaire_id, question_id)
);

CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    location_group_id INTEGER REFERENCES location_groups(id) ON DELETE CASCADE,
    questionnaire_id INTEGER REFERENCES questionnaires(id) ON DELETE CASCADE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time OR end_time IS NULL),
    CHECK (
        (location_id IS NOT NULL AND location_group_id IS NULL) OR 
        (location_id IS NULL AND location_group_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS feedback_sessions (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback_answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    value INTEGER,
    text_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_questionnaires (
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (schedule_id, questionnaire_id)
);

-- Backward-compatible schema updates for existing databases
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_required BOOLEAN DEFAULT false;

ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'date_based',
ADD COLUMN IF NOT EXISTS weekday_pattern JSONB,
ADD COLUMN IF NOT EXISTS show_only_one BOOLEAN DEFAULT false;

UPDATE schedules SET schedule_type = 'date_based' WHERE schedule_type IS NULL;

ALTER TABLE schedules
DROP CONSTRAINT IF EXISTS schedules_schedule_type_check;

ALTER TABLE schedules
ADD CONSTRAINT schedules_schedule_type_check
CHECK (schedule_type IN ('date_based', 'recurring_weekday'));

INSERT INTO schedule_questionnaires (schedule_id, questionnaire_id, display_order)
SELECT id, questionnaire_id, 0
FROM schedules
WHERE questionnaire_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

ALTER TABLE questionnaires
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(active);
CREATE INDEX IF NOT EXISTS idx_locations_group ON locations(group_id);
CREATE INDEX IF NOT EXISTS idx_schedules_location_time ON schedules(location_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_location_group ON schedules(location_group_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_location ON feedback_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_timestamp ON feedback_sessions(timestamp);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_session ON feedback_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_question ON feedback_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_wordcloud ON questionnaire_questions(word_cloud_options_id);
CREATE INDEX IF NOT EXISTS idx_schedule_questionnaires_schedule ON schedule_questionnaires(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_questions_archived ON questions(archived);
CREATE INDEX IF NOT EXISTS idx_questionnaires_archived ON questionnaires(archived);
