-- Migration 013: Add webhook-schedule associations
-- Links webhooks to schedules for conditional triggering

CREATE TABLE schedule_webhooks (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(schedule_id, webhook_id)
);

CREATE INDEX idx_schedule_webhooks_schedule_id ON schedule_webhooks(schedule_id);
CREATE INDEX idx_schedule_webhooks_webhook_id ON schedule_webhooks(webhook_id);
