-- Migration 011: Add timezone column to schedules
-- Recurring weekday schedules compare times against the server's local clock, which
-- is confusing for deployments in a different timezone to the admin. Storing the
-- intended timezone per schedule lets the backend convert before comparison.

ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

