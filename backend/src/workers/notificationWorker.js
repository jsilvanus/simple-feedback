const db = require('../db');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { sendEmail, sendSMS } = require('../services/brevoClient');
const { sendNotification } = require('../services/ntfyClient');

const MAX_RETRIES = 5;
const RETRY_BASE_SECONDS = 60;

async function processNotificationQueue() {
  const client = await db.pool.connect();

  try {
    const result = await client.query(
      `SELECT id, event_type, webhook_id, recipient_type, recipient_id, payload, attempts
       FROM notification_queue
       WHERE status = 'pending' AND scheduled_at <= NOW()
       ORDER BY created_at ASC
       LIMIT 10`
    );

    for (const job of result.rows) {
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE notification_queue SET status = $1 WHERE id = $2',
          ['processing', job.id]
        );
        await client.query('COMMIT');

        let deliveryResult;

        if (job.webhook_id) {
          deliveryResult = await deliverWebhook(client, job);
        } else if (job.recipient_type === 'email_recipients') {
          deliveryResult = await deliverEmail(client, job);
        } else if (job.recipient_type === 'sms_recipients') {
          deliveryResult = await deliverSMS(client, job);
        } else if (job.recipient_type === 'ntfy_subscriptions') {
          deliveryResult = await deliverNtfy(client, job);
        } else {
          throw new Error(`Unknown notification type: webhook_id=${job.webhook_id}, recipient_type=${job.recipient_type}`);
        }

        await client.query('BEGIN');
        await client.query(
          `UPDATE notification_queue
           SET status = 'delivered', processed_at = NOW(), attempts = $1
           WHERE id = $2`,
          [job.attempts + 1, job.id]
        );
        await client.query('COMMIT');

        const notificationType = job.webhook_id ? 'webhook' : job.recipient_type;
        console.log(`[Notification] Delivered ${notificationType} notification (job_id: ${job.id})`);
      } catch (error) {
        console.error(`[Notification] Failed to deliver notification (job_id: ${job.id}):`, error.message);
        await handleFailedJob(client, job, error);
      }
    }
  } catch (error) {
    console.error('[Notification] Error processing queue:', error);
  } finally {
    client.release();
  }
}

async function deliverWebhook(client, job) {
  const webhookResult = await client.query(
    `SELECT id, url, secret, payload_mode, custom_headers, timeout_seconds
     FROM webhooks WHERE id = $1`,
    [job.webhook_id]
  );

  if (webhookResult.rows.length === 0) {
    throw new Error(`Webhook ${job.webhook_id} not found`);
  }

  const webhook = webhookResult.rows[0];
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = filterWebhookPayload(job.payload, webhook.payload_mode);
  const signature = generateHMAC(payload, webhook.secret, timestamp);

  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Event-ID': job.payload.event_id || crypto.randomUUID(),
    ...(webhook.custom_headers || {}),
  };

  const startTime = Date.now();
  const response = await makeHttpRequest(
    webhook.url,
    'POST',
    JSON.stringify(payload),
    headers,
    webhook.timeout_seconds || 30
  );
  const duration = Date.now() - startTime;

  await client.query(
    `INSERT INTO webhook_delivery_logs (webhook_id, queue_id, status_code, response_body, duration_ms, delivered_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [webhook.id, job.id, response.statusCode, response.body, duration]
  );

  return { statusCode: response.statusCode, duration };
}

async function deliverEmail(client, job) {
  const recipientResult = await client.query(
    `SELECT id, email, questionnaire_id, location_id FROM email_recipients WHERE id = $1`,
    [job.recipient_id]
  );

  if (recipientResult.rows.length === 0) {
    throw new Error(`Email recipient ${job.recipient_id} not found`);
  }

  const recipient = recipientResult.rows[0];
  const { subject, htmlContent, textContent } = formatEmailContent(job.payload);

  const result = await sendEmail(
    recipient.email,
    subject,
    htmlContent,
    textContent
  );

  await client.query(
    `INSERT INTO notification_template_logs (recipient_type, recipient_id, event_type, trigger_type, message_preview, status, sent_at)
     VALUES ('email', $1, $2, $3, $4, 'sent', NOW())`,
    [
      recipient.id,
      job.payload.event_type || 'feedback.submitted',
      job.payload.trigger_type || 'on_submit',
      `To: ${recipient.email}`,
    ]
  );

  return result;
}

async function deliverSMS(client, job) {
  const recipientResult = await client.query(
    `SELECT id, phone_number, questionnaire_id, location_id FROM sms_recipients WHERE id = $1`,
    [job.recipient_id]
  );

  if (recipientResult.rows.length === 0) {
    throw new Error(`SMS recipient ${job.recipient_id} not found`);
  }

  const recipient = recipientResult.rows[0];
  const message = formatSMSContent(job.payload);

  const result = await sendSMS(recipient.phone_number, message);

  await client.query(
    `INSERT INTO notification_template_logs (recipient_type, recipient_id, event_type, trigger_type, message_preview, status, sent_at)
     VALUES ('sms', $1, $2, $3, $4, 'sent', NOW())`,
    [
      recipient.id,
      job.payload.event_type || 'feedback.submitted',
      job.payload.trigger_type || 'on_submit',
      message.substring(0, 160),
    ]
  );

  return result;
}

async function deliverNtfy(client, job) {
  const subscriptionResult = await client.query(
    `SELECT id, topic, questionnaire_id, location_id FROM ntfy_subscriptions WHERE id = $1`,
    [job.recipient_id]
  );

  if (subscriptionResult.rows.length === 0) {
    throw new Error(`Ntfy subscription ${job.recipient_id} not found`);
  }

  const subscription = subscriptionResult.rows[0];
  const { title, message } = formatNtfyContent(job.payload);

  const result = await sendNotification(
    subscription.topic,
    title,
    message,
    ['feedback'],
    job.payload.event_type === 'feedback.statistics' ? 'high' : 'default'
  );

  await client.query(
    `INSERT INTO notification_template_logs (recipient_type, recipient_id, event_type, trigger_type, message_preview, status, sent_at)
     VALUES ('ntfy', $1, $2, $3, $4, 'sent', NOW())`,
    [
      subscription.id,
      job.payload.event_type || 'feedback.submitted',
      job.payload.trigger_type || 'on_submit',
      message,
    ]
  );

  return result;
}

async function handleFailedJob(client, job, error) {
  const nextAttempt = job.attempts + 1;

  if (nextAttempt > MAX_RETRIES) {
    await client.query('BEGIN');
    await client.query(
      `UPDATE notification_queue
       SET status = 'dead_letter', last_error = $1, processed_at = NOW(), attempts = $2
       WHERE id = $3`,
      [error.message, nextAttempt, job.id]
    );
    await client.query('COMMIT');
    console.error(`[Notification] Job moved to dead letter queue (job_id: ${job.id})`);
  } else {
    const backoffSeconds = Math.pow(RETRY_BASE_SECONDS, nextAttempt);
    const nextSchedule = new Date(Date.now() + backoffSeconds * 1000);

    await client.query('BEGIN');
    await client.query(
      `UPDATE notification_queue
       SET status = 'pending', scheduled_at = $1, last_error = $2, attempts = $3
       WHERE id = $4`,
      [nextSchedule, error.message, nextAttempt, job.id]
    );
    await client.query('COMMIT');
    console.log(`[Notification] Scheduled retry (job_id: ${job.id}, next_attempt: ${nextSchedule.toISOString()})`);
  }
}

function generateHMAC(payload, secret, timestamp) {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(`${message}${timestamp}`)
    .digest('hex');
  return `sha256=${hmac}`;
}

function filterWebhookPayload(payload, mode) {
  if (mode === 'minimal') {
    return {
      event_id: payload.event_id,
      timestamp: payload.timestamp,
      type: payload.event_type,
    };
  }
  return payload;
}

function formatEmailContent(payload) {
  const subject = `Feedback Notification: ${payload.event_type}`;
  let htmlContent = `<h2>Feedback Notification</h2>`;
  let textContent = `Feedback Notification: ${payload.event_type}\n\n`;

  if (payload.event_type === 'feedback.submitted') {
    htmlContent += `<p>New feedback received at location <strong>${payload.location_name || 'Unknown'}</strong>.</p>`;
    textContent += `New feedback received at location: ${payload.location_name || 'Unknown'}\n`;
  } else if (payload.event_type === 'feedback.statistics') {
    htmlContent += `<p>Statistics update for <strong>${payload.location_name || 'Unknown'}</strong>:</p>`;
    textContent += `Statistics update for: ${payload.location_name || 'Unknown'}\n`;
    if (payload.statistics && payload.statistics.mean !== undefined) {
      htmlContent += `<ul><li>Mean: ${payload.statistics.mean.toFixed(2)}</li>`;
      textContent += `Mean: ${payload.statistics.mean.toFixed(2)}\n`;
    }
  }

  htmlContent += `<p>Event ID: ${payload.event_id}</p>`;
  textContent += `\nEvent ID: ${payload.event_id}`;

  return { subject, htmlContent, textContent };
}

function formatSMSContent(payload) {
  if (payload.event_type === 'feedback.statistics') {
    const mean = payload.statistics?.mean?.toFixed(2) || 'N/A';
    return `Feedback: ${payload.location_name || 'Location'} - Avg: ${mean}`;
  }
  return `New feedback received at ${payload.location_name || 'your location'}. ID: ${payload.event_id}`;
}

function formatNtfyContent(payload) {
  let title = 'Feedback Notification';
  let message = '';

  if (payload.event_type === 'feedback.submitted') {
    title = 'New Feedback';
    message = `Feedback received at ${payload.location_name || 'your location'}`;
  } else if (payload.event_type === 'feedback.statistics') {
    title = 'Statistics Update';
    const mean = payload.statistics?.mean?.toFixed(2) || 'N/A';
    message = `${payload.location_name || 'Location'} - Average: ${mean}`;
  }

  return { title, message };
}

function makeHttpRequest(url, method, body, headers, timeoutSeconds) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers,
      timeout: timeoutSeconds * 1000,
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTP request timeout (${timeoutSeconds}s)`));
    });

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

module.exports = {
  processNotificationQueue,
};
