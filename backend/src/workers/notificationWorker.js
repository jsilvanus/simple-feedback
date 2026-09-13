const crypto = require('crypto');
const db = require('../db');

async function processNotificationQueue() {
  try {
    const batch = await db.query(
      `SELECT id, event_type, webhook_id, payload
       FROM notification_queue
       WHERE status = 'pending'
       ORDER BY scheduled_at ASC
       LIMIT 10`
    );

    for (const job of batch.rows) {
      try {
        // Mark as processing
        await db.query(
          'UPDATE notification_queue SET status = $1 WHERE id = $2',
          ['processing', job.id]
        );

        if (job.event_type === 'webhook') {
          await deliverWebhook(job);
        }
        // Future: else if (job.event_type === 'sms') { ... }
        // Future: else if (job.event_type === 'email') { ... }

        // Mark as delivered
        await db.query(
          'UPDATE notification_queue SET status = $1, processed_at = NOW() WHERE id = $2',
          ['delivered', job.id]
        );
      } catch (error) {
        await handleFailedJob(job, error);
      }
    }
  } catch (error) {
    console.error('Error processing notification queue:', error);
  }
}

async function deliverWebhook(job) {
  const webhookResult = await db.query(
    'SELECT url, secret, timeout_seconds, payload_mode, custom_headers FROM webhooks WHERE id = $1',
    [job.webhook_id]
  );

  if (webhookResult.rows.length === 0) {
    throw new Error('Webhook not found');
  }

  const webhook = webhookResult.rows[0];

  // Determine payload based on mode
  let payload;
  if (webhook.payload_mode === 'minimal') {
    payload = {
      event_id: job.payload.event_id || `${job.id}-${Date.now()}`,
      timestamp: job.payload.timestamp,
      type: job.payload.type
    };
  } else {
    // 'standard' or 'custom' mode uses full payload (custom transform happens here in future)
    payload = job.payload;
  }

  const timestamp = Date.now();
  const signature = generateHMAC(payload, webhook.secret, timestamp);

  // Merge standard headers with custom headers
  const headers = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp.toString(),
    'X-Event-ID': `${job.id}-${timestamp}`,
    ...(webhook.custom_headers || {})  // Merge custom headers (may override standard)
  };

  const startTime = Date.now();
  const response = await fetch(webhook.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    timeout: webhook.timeout_seconds * 1000
  });

  const duration = Date.now() - startTime;
  const responseBody = await response.text();

  // Log delivery
  await db.query(
    `INSERT INTO webhook_delivery_logs
     (webhook_id, queue_id, status_code, response_body, duration_ms)
     VALUES ($1, $2, $3, $4, $5)`,
    [job.webhook_id, job.id, response.status, responseBody, duration]
  );

  if (!response.ok) {
    throw new Error(`Webhook failed with status ${response.status}`);
  }
}

async function handleFailedJob(job, error) {
  const webhookResult = await db.query(
    'SELECT retry_count FROM webhooks WHERE id = $1',
    [job.webhook_id]
  );

  if (webhookResult.rows.length === 0) {
    // Webhook deleted, mark as dead_letter
    await db.query(
      `UPDATE notification_queue
       SET status = 'dead_letter', last_error = $1, attempts = attempts + 1
       WHERE id = $2`,
      ['Webhook not found', job.id]
    );
    return;
  }

  const webhook = webhookResult.rows[0];
  const attemptsResult = await db.query(
    'SELECT attempts FROM notification_queue WHERE id = $1',
    [job.id]
  );

  const currentAttempts = attemptsResult.rows[0].attempts;
  const nextAttempts = currentAttempts + 1;

  if (nextAttempts >= webhook.retry_count) {
    // Give up after max retries
    await db.query(
      `UPDATE notification_queue
       SET status = 'dead_letter', last_error = $1, attempts = $2
       WHERE id = $3`,
      [error.message, nextAttempts, job.id]
    );
  } else {
    // Exponential backoff: 60s, 300s, 900s (5^1*12, 5^2*12, 5^3*12)
    const backoffSeconds = Math.pow(5, nextAttempts) * 12;

    await db.query(
      `UPDATE notification_queue
       SET status = 'pending',
           scheduled_at = NOW() + INTERVAL '${backoffSeconds} seconds',
           last_error = $1,
           attempts = $2
       WHERE id = $3`,
      [error.message, nextAttempts, job.id]
    );
  }
}

function generateHMAC(payload, secret, timestamp) {
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `sha256=${signature}`;
}

function validateWebhookSignature(body, secret, signature, timestamp) {
  // Check timestamp is not too old (5 min window)
  if (Math.abs(Date.now() - timestamp) > 300000) {
    return false;
  }

  const expectedSig = generateHMAC(body, secret, timestamp);
  return signature === expectedSig;
}

module.exports = { processNotificationQueue, validateWebhookSignature };
