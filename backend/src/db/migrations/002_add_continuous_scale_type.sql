-- Migration: Add continuous_scale question type

-- Update questions table to allow continuous_scale type
ALTER TABLE questions 
DROP CONSTRAINT IF EXISTS questions_type_check,
ADD CONSTRAINT questions_type_check CHECK (type IN ('scale', 'text', 'wordcloud', 'continuous_scale'));
