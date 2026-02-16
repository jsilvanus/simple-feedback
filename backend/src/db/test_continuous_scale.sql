-- Test data for continuous scale / radar chart question type
-- This script sets up sample data to test the new feature

-- First, create answer scales for different configurations

-- 1. Single axis (line display) - 0 to 100 scale
INSERT INTO answer_scales (name, buttons) VALUES (
  'Satisfaction Score (0-100)',
  '[{"value": 1, "label": "Overall Satisfaction", "min": 0, "max": 100}]'
) RETURNING id;
-- Note the ID returned, let's say it's 101

-- 2. Two axes (V-shape display) - Quality vs Speed
INSERT INTO answer_scales (name, buttons) VALUES (
  'Quality vs Speed',
  '[
    {"value": 1, "label": "Quality", "min": 1, "max": 10},
    {"value": 2, "label": "Speed", "min": 1, "max": 10}
  ]'
) RETURNING id;
-- Note the ID returned, let's say it's 102

-- 3. Three axes (radar chart) - Product, Service, Value
INSERT INTO answer_scales (name, buttons) VALUES (
  'Product Experience Triangle',
  '[
    {"value": 1, "label": "Product Quality", "min": 0, "max": 10},
    {"value": 2, "label": "Customer Service", "min": 0, "max": 10},
    {"value": 3, "label": "Value for Money", "min": 0, "max": 10}
  ]'
) RETURNING id;
-- Note the ID returned, let's say it's 103

-- 4. Five axes (full radar chart) - Restaurant experience
INSERT INTO answer_scales (name, buttons) VALUES (
  'Restaurant Experience',
  '[
    {"value": 1, "label": "Food Quality", "min": 0, "max": 10},
    {"value": 2, "label": "Service", "min": 0, "max": 10},
    {"value": 3, "label": "Atmosphere", "min": 0, "max": 10},
    {"value": 4, "label": "Value", "min": 0, "max": 10},
    {"value": 5, "label": "Cleanliness", "min": 0, "max": 10}
  ]'
) RETURNING id;
-- Note the ID returned, let's say it's 104

-- Create continuous_scale questions
INSERT INTO questions (text, type) VALUES 
  ('How satisfied are you overall?', 'continuous_scale'),
  ('Rate our quality and speed', 'continuous_scale'),
  ('Evaluate our product experience', 'continuous_scale'),
  ('Rate your restaurant experience', 'continuous_scale')
RETURNING id;
-- Note the IDs returned, let's say they're 201, 202, 203, 204

-- Create a test questionnaire
INSERT INTO questionnaires (name, description) VALUES (
  'Continuous Scale Demo',
  'Testing different continuous scale configurations'
) RETURNING id;
-- Note the ID returned, let's say it's 301

-- Link questions to questionnaire with their answer scales
-- Replace the IDs below with the actual IDs from your inserts

-- Page 1: Single axis line
INSERT INTO questionnaire_questions (
  questionnaire_id, question_id, answer_scale_id, page_number, order_index
) VALUES (301, 201, 101, 1, 0);

-- Page 2: Two axes V-shape
INSERT INTO questionnaire_questions (
  questionnaire_id, question_id, answer_scale_id, page_number, order_index
) VALUES (301, 202, 102, 2, 0);

-- Page 3: Three axes triangle
INSERT INTO questionnaire_questions (
  questionnaire_id, question_id, answer_scale_id, page_number, order_index
) VALUES (301, 203, 103, 3, 0);

-- Page 4: Five axes radar chart
INSERT INTO questionnaire_questions (
  questionnaire_id, question_id, answer_scale_id, page_number, order_index
) VALUES (301, 204, 104, 4, 0);

-- Create or update a test location
INSERT INTO locations (slug, name, active) VALUES (
  'demo', 'Demo Location', true
) ON CONFLICT (slug) DO UPDATE SET active = true
RETURNING id;
-- Note the ID returned, let's say it's 1

-- Create a schedule to make the questionnaire active
INSERT INTO schedules (location_id, questionnaire_id, start_time, end_time) VALUES (
  1,  -- location ID
  301, -- questionnaire ID
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '30 days'
);

-- Verify the setup
SELECT 'Answer Scales Created:' as info;
SELECT id, name FROM answer_scales WHERE name LIKE '%Satisfaction Score%' OR name LIKE '%Quality vs Speed%' OR name LIKE '%Triangle%' OR name LIKE '%Restaurant%';

SELECT 'Questions Created:' as info;
SELECT id, text, type FROM questions WHERE type = 'continuous_scale';

SELECT 'Questionnaire Created:' as info;
SELECT id, name, description FROM questionnaires WHERE name = 'Continuous Scale Demo';

SELECT 'Schedule Created:' as info;
SELECT s.id, l.name as location, q.name as questionnaire, s.start_time, s.end_time
FROM schedules s
JOIN locations l ON s.location_id = l.id
JOIN questionnaires q ON s.questionnaire_id = q.id
WHERE q.name = 'Continuous Scale Demo';
