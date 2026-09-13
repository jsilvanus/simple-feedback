const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { feedbackLimiter } = require('../middleware/rateLimiter');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/feedback
 * Submit feedback
 * 
 * Body:
 * {
 *   locationId: number,
 *   questionnaireId: number,
 *   answers: [
 *     { questionId: number, value: number, textValue: string }
 *   ]
 * }
 */
router.post('/', feedbackLimiter, async (req, res, next) => {
  const client = await db.pool.connect();
  
  try {
    const { locationId, questionnaireId, answers } = req.body;

    // Validate input
    if (!locationId || !questionnaireId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        error: { message: 'Invalid input: locationId, questionnaireId, and answers array required' } 
      });
    }

    if (answers.length === 0) {
      return res.status(400).json({
        error: { message: 'At least one answer is required' },
      });
    }

    // Check if the target location is password-protected; if so, require a valid location token.
    const locationRow = await client.query(
      'SELECT password_required FROM locations WHERE id = $1 AND active = true',
      [locationId]
    );

    if (locationRow.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location not found' } });
    }

    if (locationRow.rows[0].password_required) {
      const locationToken = req.headers['x-location-token'];
      if (!locationToken) {
        return res.status(401).json({ error: { message: 'Location authentication required' } });
      }
      try {
        const decoded = jwt.verify(locationToken, JWT_SECRET);
        if (decoded.role !== 'location' || String(decoded.locationId) !== String(locationId)) {
          return res.status(403).json({ error: { message: 'Location token is not valid for this location' } });
        }
      } catch {
        return res.status(401).json({ error: { message: 'Invalid or expired location token' } });
      }
    }

    // Validate that all submitted questionIds belong to the questionnaire
    const submittedQuestionIds = [...new Set(answers.map(a => a.questionId))];
    const validQuestionsResult = await client.query(
      `SELECT question_id FROM questionnaire_questions
       WHERE questionnaire_id = $1 AND question_id = ANY($2)`,
      [questionnaireId, submittedQuestionIds]
    );
    const validIds = new Set(validQuestionsResult.rows.map(r => r.question_id));
    const invalidIds = submittedQuestionIds.filter(id => !validIds.has(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        error: { message: `Question IDs not part of this questionnaire: ${invalidIds.join(', ')}` },
      });
    }

    // Validate scaleItemId values are integers when provided (M9)
    for (const answer of answers) {
      if (answer.scaleItemId !== undefined && answer.scaleItemId !== null) {
        const parsed = parseInt(answer.scaleItemId, 10);
        if (isNaN(parsed)) {
          return res.status(400).json({ error: { message: 'scaleItemId must be an integer' } });
        }
      }
    }

    await client.query('BEGIN');

    // Create feedback session
    const sessionResult = await client.query(
      'INSERT INTO feedback_sessions (location_id, questionnaire_id, timestamp) VALUES ($1, $2, NOW()) RETURNING id',
      [locationId, questionnaireId]
    );

    const sessionId = sessionResult.rows[0].id;

    // Insert all answers
    for (const answer of answers) {
      // Accept numeric (including fractional) values; parse strings to float for NUMERIC column
      const rawValue = answer.value;
      let normalizedValue = null;
      if (rawValue !== null && rawValue !== undefined) {
        const parsed = parseFloat(rawValue);
        normalizedValue = isNaN(parsed) ? null : parsed;
      }
      const normalizedTextValue =
        answer.textValue !== undefined && answer.textValue !== null
          ? answer.textValue
          : (answer.value && typeof answer.value === 'object' ? JSON.stringify(answer.value) : null);

      const scaleItemId = answer.scaleItemId != null ? parseInt(answer.scaleItemId, 10) : null;

      await client.query(
        'INSERT INTO feedback_answers (session_id, question_id, scale_item_id, value, text_value) VALUES ($1, $2, $3, $4, $5)',
        [sessionId, answer.questionId, scaleItemId, normalizedValue, normalizedTextValue]
      );
    }

    await client.query('COMMIT');

    // Enqueue notifications (fire-and-forget after commit)
    enqueueNotifications(client, locationId, questionnaireId, sessionId, answers).catch(error => {
      console.error('[Feedback] Failed to enqueue notifications:', error);
    });

    res.status(201).json({
      success: true,
      sessionId,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

async function enqueueNotifications(client, locationId, questionnaireId, sessionId, answers) {
  try {
    // Get location and questionnaire info for payload
    const locationResult = await client.query(
      'SELECT id, name FROM locations WHERE id = $1',
      [locationId]
    );
    const locationName = locationResult.rows[0]?.name || 'Unknown Location';

    const questionnaireResult = await client.query(
      'SELECT id, name FROM questionnaires WHERE id = $1',
      [questionnaireId]
    );
    const questionnaireName = questionnaireResult.rows[0]?.name || 'Unknown Questionnaire';

    const eventPayload = {
      event_id: crypto.randomUUID(),
      timestamp: Math.floor(Date.now() / 1000),
      event_type: 'feedback.submitted',
      location_id: locationId,
      location_name: locationName,
      questionnaire_id: questionnaireId,
      questionnaire_name: questionnaireName,
      session_id: sessionId,
      trigger_type: 'on_submit',
    };

    // Enqueue webhooks (if any configured)
    const webhooksResult = await client.query(
      `SELECT id, event_type FROM webhooks
       WHERE active = true AND event_type = 'feedback.submitted'
       AND id IN (
         SELECT webhook_id FROM schedule_webhooks
         WHERE schedule_id IN (
           SELECT id FROM schedules
           WHERE active = true
           AND (id IN (
             SELECT schedule_id FROM schedule_locations WHERE location_id = $1
           ) OR id IN (
             SELECT schedule_id FROM schedule_location_groups
             WHERE location_group_id = (
               SELECT group_id FROM locations WHERE id = $1
             )
           ))
         )
       )`,
      [locationId]
    );

    for (const webhook of webhooksResult.rows) {
      await client.query(
        `INSERT INTO notification_queue (event_type, webhook_id, payload, status, attempts, scheduled_at)
         VALUES ('webhook', $1, $2, 'pending', 0, NOW())`,
        [webhook.id, JSON.stringify(eventPayload)]
      );
    }

    // Enqueue email notifications
    const emailResult = await client.query(
      `SELECT id FROM email_recipients
       WHERE active = true AND questionnaire_id = $1 AND trigger_type = 'on_submit'`,
      [questionnaireId]
    );

    for (const recipient of emailResult.rows) {
      await client.query(
        `INSERT INTO notification_queue (event_type, recipient_id, recipient_type, payload, status, attempts, scheduled_at)
         VALUES ('email', $1, 'email_recipients', $2, 'pending', 0, NOW())`,
        [recipient.id, JSON.stringify(eventPayload)]
      );
    }

    // Enqueue SMS notifications
    const smsResult = await client.query(
      `SELECT id FROM sms_recipients
       WHERE active = true AND questionnaire_id = $1 AND trigger_type = 'on_submit'`,
      [questionnaireId]
    );

    for (const recipient of smsResult.rows) {
      await client.query(
        `INSERT INTO notification_queue (event_type, recipient_id, recipient_type, payload, status, attempts, scheduled_at)
         VALUES ('sms', $1, 'sms_recipients', $2, 'pending', 0, NOW())`,
        [recipient.id, JSON.stringify(eventPayload)]
      );
    }

    // Enqueue ntfy notifications
    const ntfyResult = await client.query(
      `SELECT id FROM ntfy_subscriptions
       WHERE active = true AND questionnaire_id = $1 AND trigger_type = 'on_submit'`,
      [questionnaireId]
    );

    for (const subscription of ntfyResult.rows) {
      await client.query(
        `INSERT INTO notification_queue (event_type, recipient_id, recipient_type, payload, status, attempts, scheduled_at)
         VALUES ('ntfy', $1, 'ntfy_subscriptions', $2, 'pending', 0, NOW())`,
        [subscription.id, JSON.stringify(eventPayload)]
      );
    }
  } catch (error) {
    console.error('[Feedback] Error enqueueing notifications:', error);
    throw error;
  }
}

module.exports = router;
