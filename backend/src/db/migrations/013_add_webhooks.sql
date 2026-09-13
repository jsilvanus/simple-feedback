-- Migration 013: Webhook Notifications & Async Queue System
-- Creates tables for webhook management, notification queueing, and delivery logging

-- Webhook definitions table
CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('feedback.submitted', 'feedback.text_submitted', 'feedback.batch')),
    active BOOLEAN DEFAULT true,
    secret VARCHAR(255) NOT NULL, -- HMAC signing key (64-byte hex)
    retry_count INT DEFAULT 3,
    timeout_seconds INT DEFAULT 10,
    payload_mode VARCHAR(20) DEFAULT 'minimal' CHECK (payload_mode IN ('minimal', 'standard', 'custom')),
    payload_template JSONB, -- Custom field mapping (future use; NULL for minimal/standard)
    custom_headers JSONB, -- Custom HTTP headers: {"Authorization": "Bearer xyz", "X-Custom-Header": "value"}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Async notification queue
CREATE TABLE IF NOT EXISTS notification_queue (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'webhook', 'sms', 'email', 'web'
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE SET NULL,
    payload JSONB NOT NULL, -- Event data
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
    attempts INT DEFAULT 0,
    last_error TEXT,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhook delivery log (audit trail)
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    queue_id INTEGER REFERENCES notification_queue(id) ON DELETE SET NULL,
    status_code INT,
    response_body TEXT,
    duration_ms INT,
    delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_at);
CREATE INDEX idx_webhook_delivery_webhook ON webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhooks_active_event ON webhooks(active, event_type);
