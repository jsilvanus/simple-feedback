-- Migration: Add location groups functionality

-- Create location_groups table
CREATE TABLE IF NOT EXISTS location_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add group_id to locations table to assign locations to groups
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS group_id INTEGER REFERENCES location_groups(id) ON DELETE SET NULL;

-- Add location_group_id to schedules table to allow group-level schedules
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS location_group_id INTEGER REFERENCES location_groups(id) ON DELETE CASCADE;

-- Add constraint to ensure schedule has either location_id or location_group_id but not both
ALTER TABLE schedules 
ADD CONSTRAINT check_schedule_target 
CHECK (
    (location_id IS NOT NULL AND location_group_id IS NULL) OR 
    (location_id IS NULL AND location_group_id IS NOT NULL)
);

-- Make location_id nullable since group-level schedules won't have it
ALTER TABLE schedules ALTER COLUMN location_id DROP NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_group ON locations(group_id);
CREATE INDEX IF NOT EXISTS idx_schedules_location_group ON schedules(location_group_id);
