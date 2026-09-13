-- Migration 012: Add webhook notification system
-- Creates tables for managing webhooks and the notification queue

CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'feedback.submitted', 'feedback.text_submitted', 'feedback.statistics'
  active BOOLEAN DEFAULT true,
  secret VARCHAR(255) NOT NULL, -- HMAC secret for signing requests
  retry_count INTEGER DEFAULT 0,
  timeout_seconds INTEGER DEFAULT 30,
  payload_mode VARCHAR(50) DEFAULT 'standard', -- 'minimal' or 'standard'
  payload_template JSONB DEFAULT NULL,
  custom_headers JSONB DEFAULT NULL, -- { "Authorization": "Bearer token", "X-Custom": "value" }
  stats_trigger VARCHAR(50) DEFAULT NULL, -- 'on_submit' or 'on_change' (only for feedback.statistics)
  stats_type VARCHAR(50) DEFAULT NULL, -- 'overall', 'per_question', 'both'
  stats_change_threshold NUMERIC DEFAULT NULL, -- percentage threshold (0-100)
  stats_thresholds JSONB DEFAULT NULL, -- per-question thresholds: {"q1": 10, "q2": 20}
  stats_debounce_ms INTEGER DEFAULT 1000, -- debounce window for on_change
  stats_min_interval_ms INTEGER DEFAULT 30000, -- minimum interval between sends
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhooks_active ON webhooks(active);
CREATE INDEX idx_webhooks_event_type ON webhooks(event_type);
CREATE INDEX idx_webhooks_active_event_type ON webhooks(active, event_type);

CREATE TABLE notification_queue (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'webhook', 'email', 'sms', 'ntfy'
  webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
  recipient_type VARCHAR(50) DEFAULT NULL, -- 'email_recipients', 'sms_recipients', 'ntfy_subscriptions'
  recipient_id INTEGER DEFAULT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'delivered', 'dead_letter'
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled_at ON notification_queue(scheduled_at);
CREATE INDEX idx_notification_queue_webhook_id ON notification_queue(webhook_id);
CREATE INDEX idx_notification_queue_recipient ON notification_queue(recipient_type, recipient_id);

CREATE TABLE webhook_delivery_logs (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  queue_id INTEGER REFERENCES notification_queue(id) ON DELETE SET NULL,
  status_code INTEGER,
  response_body TEXT,
  duration_ms INTEGER,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_delivery_logs_webhook_id ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_delivery_logs_delivered_at ON webhook_delivery_logs(delivered_at DESC);

CREATE TABLE webhook_stats_cache (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
  last_stats JSONB,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(webhook_id, questionnaire_id, location_id)
);

CREATE INDEX idx_webhook_stats_cache_webhook_questionnaire ON webhook_stats_cache(webhook_id, questionnaire_id);
