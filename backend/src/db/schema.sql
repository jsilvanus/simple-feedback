-- Database schema for Simple Feedback App
-- Clean, standalone schema — run via db:init for fresh installations.
-- For existing databases, use db:migrate (runs migrations/ in order).

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
    password_hash VARCHAR(255),
    password_required BOOLEAN DEFAULT false,
    qr_entry_mode BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answer_scales (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    buttons JSONB NOT NULL,
    scale_mode VARCHAR(20) DEFAULT 'normal' CHECK (scale_mode IN ('normal', 'bipolar')),
    step NUMERIC(4,2) DEFAULT 1 CHECK (step >= 0.01 AND step <= 1),
    min_label JSONB,
    max_label JSONB,
    min_value NUMERIC,
    max_value NUMERIC,
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
    answer_scale_id INTEGER REFERENCES answer_scales(id) ON DELETE SET NULL,
    word_cloud_options_id INTEGER REFERENCES word_cloud_options(id) ON DELETE SET NULL,
    max_selections INTEGER DEFAULT 3,
    continuous_axes JSONB,
    multi_scale_layout TEXT DEFAULT 'stacked' CHECK (multi_scale_layout IN ('stacked', 'matrix', 'compact')),
    multi_scale_defaults JSONB DEFAULT '{}',
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questionnaires (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS questionnaire_questions (
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL DEFAULT 1,
    order_index INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (questionnaire_id, question_id)
);

CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    location_group_id INTEGER REFERENCES location_groups(id) ON DELETE CASCADE,
    questionnaire_id INTEGER REFERENCES questionnaires(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) DEFAULT 'date_based' CHECK (schedule_type IN ('date_based', 'recurring_weekday')),
    weekday_pattern JSONB,
    show_only_one BOOLEAN DEFAULT false,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_time > start_time OR end_time IS NULL)
);

CREATE TABLE IF NOT EXISTS schedule_questionnaires (
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (schedule_id, questionnaire_id)
);

CREATE TABLE IF NOT EXISTS schedule_locations (
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
    location_group_id INTEGER REFERENCES location_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback_sessions (
    id SERIAL PRIMARY KEY,
    location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    entry_method VARCHAR(20) DEFAULT 'kiosk' CHECK (entry_method IN ('kiosk', 'phone')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS question_scale_items (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_scale_id INTEGER NOT NULL REFERENCES answer_scales(id),
    label JSONB NOT NULL DEFAULT '{}',
    order_index INTEGER NOT NULL DEFAULT 0,
    display_mode TEXT CHECK (display_mode IN ('buttons', 'slider', 'labeled-line', 'stars', 'thumbs')),
    show_end_labels BOOLEAN DEFAULT true,
    show_value_labels BOOLEAN DEFAULT true,
    show_item_label BOOLEAN DEFAULT true,
    min_label_override JSONB,
    max_label_override JSONB,
    required BOOLEAN DEFAULT true,
    UNIQUE(question_id, order_index)
);

CREATE TABLE IF NOT EXISTS feedback_answers (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES feedback_sessions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    scale_item_id INTEGER REFERENCES question_scale_items(id),
    value NUMERIC,
    text_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    url TEXT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answer_views (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    view_type VARCHAR(50) NOT NULL CHECK (view_type IN ('radar')),
    questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS answer_view_questions (
    answer_view_id INTEGER NOT NULL REFERENCES answer_views(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    axis_label VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    PRIMARY KEY (answer_view_id, question_id)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_locations_slug ON locations(slug);
CREATE INDEX IF NOT EXISTS idx_locations_active ON locations(active);
CREATE INDEX IF NOT EXISTS idx_locations_group ON locations(group_id);
CREATE INDEX IF NOT EXISTS idx_schedules_location_time ON schedules(location_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_location_group ON schedules(location_group_id);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_schedule_questionnaires_schedule ON schedule_questionnaires(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_locations_schedule ON schedule_locations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_locations_location ON schedule_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_schedule_locations_group ON schedule_locations(location_group_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_location ON feedback_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_feedback_sessions_timestamp ON feedback_sessions(timestamp);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_session ON feedback_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_question ON feedback_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_questions_wordcloud_options ON questions(word_cloud_options_id);
CREATE INDEX IF NOT EXISTS idx_questions_archived ON questions(archived);
CREATE INDEX IF NOT EXISTS idx_questions_continuous_axes ON questions USING GIN(continuous_axes);
CREATE INDEX IF NOT EXISTS idx_questionnaires_archived ON questionnaires(archived);
CREATE INDEX IF NOT EXISTS idx_question_scale_items_question ON question_scale_items(question_id);
CREATE INDEX IF NOT EXISTS idx_feedback_answers_scale_item ON feedback_answers(scale_item_id);
