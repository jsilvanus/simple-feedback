-- Migration to add word cloud support
-- This adds word cloud options management similar to answer_scales

-- Create word_cloud_options table to store word cloud presets
CREATE TABLE IF NOT EXISTS word_cloud_options (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    words JSONB NOT NULL,  -- Array of word objects: [{ text: "Good", color: "#2ecc71" }, ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add word_cloud_options_id to questionnaire_questions
ALTER TABLE questionnaire_questions 
ADD COLUMN IF NOT EXISTS word_cloud_options_id INTEGER REFERENCES word_cloud_options(id) ON DELETE SET NULL;

-- Add max_selections to questionnaire_questions for controlling how many words users can select
ALTER TABLE questionnaire_questions 
ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 3;

-- Create index for word_cloud_options lookup
CREATE INDEX IF NOT EXISTS idx_questionnaire_questions_wordcloud 
ON questionnaire_questions(word_cloud_options_id);

-- Insert sample word cloud options for testing
INSERT INTO word_cloud_options (name, words) VALUES 
('Service Quality', '[
    {"text": "Excellent", "color": "#2ecc71"},
    {"text": "Professional", "color": "#3498db"},
    {"text": "Friendly", "color": "#9b59b6"},
    {"text": "Fast", "color": "#1abc9c"},
    {"text": "Helpful", "color": "#f39c12"},
    {"text": "Clean", "color": "#16a085"},
    {"text": "Organized", "color": "#27ae60"},
    {"text": "Responsive", "color": "#2980b9"}
]'),
('Customer Experience', '[
    {"text": "Amazing", "color": "#2ecc71"},
    {"text": "Satisfied", "color": "#3498db"},
    {"text": "Disappointed", "color": "#e74c3c"},
    {"text": "Confused", "color": "#95a5a6"},
    {"text": "Happy", "color": "#f39c12"},
    {"text": "Frustrated", "color": "#c0392b"},
    {"text": "Impressed", "color": "#9b59b6"},
    {"text": "Neutral", "color": "#7f8c8d"}
]'),
('Product Features', '[
    {"text": "Innovative", "color": "#e74c3c"},
    {"text": "Easy to use", "color": "#2ecc71"},
    {"text": "Reliable", "color": "#3498db"},
    {"text": "Powerful", "color": "#9b59b6"},
    {"text": "Affordable", "color": "#f39c12"},
    {"text": "Modern", "color": "#1abc9c"},
    {"text": "Intuitive", "color": "#16a085"},
    {"text": "Flexible", "color": "#27ae60"}
]');
