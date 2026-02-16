-- Migration: Add password protection, archiving, and image support

-- Add password support to locations
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS password_required BOOLEAN DEFAULT false;

-- Add archived fields
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

ALTER TABLE questionnaires 
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Create images table for button images
CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size INTEGER NOT NULL,
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for archived items
CREATE INDEX IF NOT EXISTS idx_questions_archived ON questions(archived);
CREATE INDEX IF NOT EXISTS idx_questionnaires_archived ON questionnaires(archived);
