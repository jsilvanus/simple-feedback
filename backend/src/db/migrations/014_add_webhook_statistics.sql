-- Migration 014: Webhook Statistics Events
-- Adds support for calculating and sending statistics webhooks after feedback submission

-- Add statistics-related columns to webhooks table
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS stats_trigger VARCHAR(20) DEFAULT 'on_submit' CHECK (stats_trigger IN ('on_submit', 'on_change'));
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS stats_type VARCHAR(20) DEFAULT 'overall' CHECK (stats_type IN ('overall', 'per_question', 'both'));
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS stats_change_threshold NUMERIC DEFAULT 5.0; -- default percentage change threshold
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS stats_thresholds JSONB; -- per-question thresholds: {"123": 10, "456": 5} (question_id => percentage)
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS stats_debounce_ms INT DEFAULT 1000; -- debounce window after submission
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS stats_min_interval_ms INT DEFAULT 60000; -- minimum time between stats sends (1 minute)

-- Track last sent statistics for on_change mode to detect threshold breaches
CREATE TABLE IF NOT EXISTS webhook_stats_cache (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    questionnaire_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    last_stats JSONB, -- Previous stats snapshot
    last_sent_at TIMESTAMP, -- When this webhook last sent stats
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(webhook_id, questionnaire_id, location_id)
);

CREATE INDEX idx_webhook_stats_cache_webhook ON webhook_stats_cache(webhook_id);
