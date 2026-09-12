-- Migration 012: Add QR-First Entry Mode support
-- Allows locations to display a QR code initially, with option to continue on device.
-- Tracks entry method (kiosk vs phone) for analytics.

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS qr_entry_mode BOOLEAN DEFAULT false;

ALTER TABLE feedback_sessions
  ADD COLUMN IF NOT EXISTS entry_method VARCHAR(20) DEFAULT 'kiosk'
  CHECK (entry_method IN ('kiosk', 'phone'));

INSERT INTO schema_migrations (version) VALUES ('012_add_qr_entry_mode')
ON CONFLICT DO NOTHING;
