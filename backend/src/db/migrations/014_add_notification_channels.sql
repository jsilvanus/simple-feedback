-- Migration 015: Add notification channels for email, SMS, and ntfy
-- Adds tables for managing email/SMS recipients and notification filtering

CREATE TABLE email_recipients (
  id SERIAL PRIMARY KEY,
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'on_submit', -- 'on_submit' or 'on_change'
  on_change_threshold NUMERIC DEFAULT NULL, -- threshold percentage for on_change trigger (0-100)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_recipients_questionnaire ON email_recipients(questionnaire_id);
CREATE INDEX idx_email_recipients_location ON email_recipients(location_id);
CREATE INDEX idx_email_recipients_active ON email_recipients(active);

CREATE TABLE sms_recipients (
  id SERIAL PRIMARY KEY,
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  phone_number VARCHAR(20) NOT NULL, -- international format: +1234567890
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'on_submit', -- 'on_submit' or 'on_change'
  on_change_threshold NUMERIC DEFAULT NULL, -- threshold percentage for on_change trigger (0-100)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sms_recipients_questionnaire ON sms_recipients(questionnaire_id);
CREATE INDEX idx_sms_recipients_location ON sms_recipients(location_id);
CREATE INDEX idx_sms_recipients_active ON sms_recipients(active);

CREATE TABLE ntfy_subscriptions (
  id SERIAL PRIMARY KEY,
  questionnaire_id INTEGER NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  topic VARCHAR(255) NOT NULL, -- ntfy.sh topic name (alphanumeric, dash, underscore)
  trigger_type VARCHAR(50) NOT NULL DEFAULT 'on_submit', -- 'on_submit' or 'on_change'
  on_change_threshold NUMERIC DEFAULT NULL, -- threshold percentage for on_change trigger (0-100)
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ntfy_subscriptions_questionnaire ON ntfy_subscriptions(questionnaire_id);
CREATE INDEX idx_ntfy_subscriptions_location ON ntfy_subscriptions(location_id);
CREATE INDEX idx_ntfy_subscriptions_active ON ntfy_subscriptions(active);

-- Add notification_type column to notification_queue to track channel (webhook, email, sms, ntfy)
-- This migration assumes notification_queue already exists from migration 013
-- If adding notification_type, use:
-- ALTER TABLE notification_queue ADD COLUMN recipient_type VARCHAR(50), ADD COLUMN recipient_id INTEGER;

CREATE TABLE notification_template_logs (
  id SERIAL PRIMARY KEY,
  recipient_type VARCHAR(50) NOT NULL, -- 'email', 'sms', 'ntfy'
  recipient_id INTEGER NOT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'feedback.submitted', 'feedback.statistics', etc.
  trigger_type VARCHAR(50) NOT NULL, -- 'on_submit', 'on_change'
  message_preview TEXT,
  status VARCHAR(50) NOT NULL, -- 'sent', 'failed', 'throttled'
  error_reason TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_template_logs_recipient ON notification_template_logs(recipient_type, recipient_id);
CREATE INDEX idx_notification_template_logs_status ON notification_template_logs(status);
CREATE INDEX idx_notification_template_logs_sent_at ON notification_template_logs(sent_at DESC);
