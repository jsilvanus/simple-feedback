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

-- Indexes for performance
CREATE INDEX idx_locations_slug ON locations(slug);
CREATE INDEX idx_locations_active ON locations(active);
CREATE INDEX idx_locations_group ON locations(group_id);
CREATE INDEX idx_schedules_location_time ON schedules(location_id, start_time, end_time);
CREATE INDEX idx_schedules_location_group ON schedules(location_group_id);
CREATE INDEX idx_feedback_sessions_location ON feedback_sessions(location_id);
CREATE INDEX idx_feedback_sessions_timestamp ON feedback_sessions(timestamp);
CREATE INDEX idx_feedback_answers_session ON feedback_answers(session_id);
CREATE INDEX idx_feedback_answers_question ON feedback_answers(question_id);
CREATE INDEX idx_questionnaire_questions_wordcloud ON questionnaire_questions(word_cloud_options_id);
