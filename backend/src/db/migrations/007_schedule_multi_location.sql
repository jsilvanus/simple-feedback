-- Migration 007: Allow schedules to target multiple locations/groups
-- Mirrors the schedule_questionnaires pattern for questionnaire multi-select.

-- Create the junction table
CREATE TABLE IF NOT EXISTS schedule_locations (
  schedule_id       INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  location_id       INTEGER          REFERENCES locations(id) ON DELETE CASCADE,
  location_group_id INTEGER          REFERENCES location_groups(id) ON DELETE CASCADE,
  CONSTRAINT check_sl_one_target CHECK (
    (location_id IS NOT NULL AND location_group_id IS NULL) OR
    (location_id IS NULL    AND location_group_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_schedule_locations_schedule ON schedule_locations(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_locations_location ON schedule_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_schedule_locations_group    ON schedule_locations(location_group_id);

-- Migrate existing single-target data into the junction table
INSERT INTO schedule_locations (schedule_id, location_id, location_group_id)
SELECT id, location_id, NULL
FROM schedules
WHERE location_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO schedule_locations (schedule_id, location_id, location_group_id)
SELECT id, NULL, location_group_id
FROM schedules
WHERE location_group_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop the old exclusivity constraint so location_id / location_group_id can be null
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS check_schedule_target;
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_check1;
