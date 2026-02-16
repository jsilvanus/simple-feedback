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
    {"text": {"fi": "Erinomainen", "en": "Excellent", "sv": "Utmärkt"}, "color": "#2ecc71"},
    {"text": {"fi": "Ammattimainen", "en": "Professional", "sv": "Professionell"}, "color": "#3498db"},
    {"text": {"fi": "Ystävällinen", "en": "Friendly", "sv": "Vänlig"}, "color": "#9b59b6"},
    {"text": {"fi": "Nopea", "en": "Fast", "sv": "Snabb"}, "color": "#1abc9c"},
    {"text": {"fi": "Avulias", "en": "Helpful", "sv": "Hjälpsam"}, "color": "#f39c12"},
    {"text": {"fi": "Siisti", "en": "Clean", "sv": "Ren"}, "color": "#16a085"},
    {"text": {"fi": "Järjestetty", "en": "Organized", "sv": "Organiserad"}, "color": "#27ae60"},
    {"text": {"fi": "Reagoiva", "en": "Responsive", "sv": "Responsiv"}, "color": "#2980b9"}
]'),
('Customer Experience', '[
    {"text": {"fi": "Hämmästyttävä", "en": "Amazing", "sv": "Fantastisk"}, "color": "#2ecc71"},
    {"text": {"fi": "Tyytyväinen", "en": "Satisfied", "sv": "Nöjd"}, "color": "#3498db"},
    {"text": {"fi": "Pettynyt", "en": "Disappointed", "sv": "Besviken"}, "color": "#e74c3c"},
    {"text": {"fi": "Hämmentynyt", "en": "Confused", "sv": "Förvirrad"}, "color": "#95a5a6"},
    {"text": {"fi": "Iloinen", "en": "Happy", "sv": "Glad"}, "color": "#f39c12"},
    {"text": {"fi": "Turhautunut", "en": "Frustrated", "sv": "Frustrerad"}, "color": "#c0392b"},
    {"text": {"fi": "Vaikuttunut", "en": "Impressed", "sv": "Imponerad"}, "color": "#9b59b6"},
    {"text": {"fi": "Neutraali", "en": "Neutral", "sv": "Neutral"}, "color": "#7f8c8d"}
]'),
('Product Features', '[
    {"text": {"fi": "Innovatiivinen", "en": "Innovative", "sv": "Innovativ"}, "color": "#e74c3c"},
    {"text": {"fi": "Helppo käyttää", "en": "Easy to use", "sv": "Lätt att använda"}, "color": "#2ecc71"},
    {"text": {"fi": "Luotettava", "en": "Reliable", "sv": "Pålitlig"}, "color": "#3498db"},
    {"text": {"fi": "Tehokas", "en": "Powerful", "sv": "Kraftfull"}, "color": "#9b59b6"},
    {"text": {"fi": "Edullinen", "en": "Affordable", "sv": "Prisvärd"}, "color": "#f39c12"},
    {"text": {"fi": "Moderni", "en": "Modern", "sv": "Modern"}, "color": "#1abc9c"},
    {"text": {"fi": "Intuitiivinen", "en": "Intuitive", "sv": "Intuitiv"}, "color": "#16a085"},
    {"text": {"fi": "Joustava", "en": "Flexible", "sv": "Flexibel"}, "color": "#27ae60"}
]');
