const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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
    const { locationId, questionnaireId, answers, entryMethod } = req.body;
    const method = entryMethod || 'kiosk';

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
      'INSERT INTO feedback_sessions (location_id, questionnaire_id, entry_method, timestamp) VALUES ($1, $2, $3, NOW()) RETURNING id',
      [locationId, questionnaireId, method]
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

    // After transaction commits, enqueue webhook notifications (fire & forget)
    try {
      await enqueueWebhookNotifications(sessionId, locationId, questionnaireId, method, answers);
    } catch (err) {
      // Log error but don't fail the feedback submission
      console.error('Failed to enqueue webhook notifications:', err);
    }

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

/**
 * Helper function to enqueue webhook notifications after feedback submission
 */
async function enqueueWebhookNotifications(sessionId, locationId, questionnaireId, entryMethod, answers) {
  // Get location and questionnaire names
  const [locationResult, questionnaireResult, answersWithMetadata] = await Promise.all([
    db.query('SELECT name FROM locations WHERE id = $1', [locationId]),
    db.query('SELECT name FROM questionnaires WHERE id = $1', [questionnaireId]),
    getAnswerMetadata(answers)
  ]);

  if (locationResult.rows.length === 0 || questionnaireResult.rows.length === 0) {
    throw new Error('Location or questionnaire not found');
  }

  const locationName = locationResult.rows[0].name;
  const questionnaireName = questionnaireResult.rows[0].name;
  const timestamp = new Date().toISOString();
  const eventId = `${sessionId}-${Date.now()}`;

  // Separate structured vs text answers
  const structuredAnswers = answersWithMetadata.filter(a => a.type !== 'text');
  const textAnswers = answersWithMetadata.filter(a => a.type === 'text');

  // Event 1: Always enqueue feedback.submitted (structured answers only)
  if (structuredAnswers.length > 0 || true) { // Always enqueue even if no structured answers
    const webhookEvent = {
      event_id: eventId,
      timestamp,
      type: 'feedback.submitted',
      data: {
        sessionId,
        locationId,
        locationName,
        questionnaireId,
        questionnaireName,
        entryMethod,
        answersCount: answers.length,
        answers: structuredAnswers.map(a => ({
          questionId: a.question_id,
          questionText: a.question_text,
          type: a.type,
          value: a.numeric_value
        }))
      }
    };

    // Find all active webhooks for feedback.submitted event
    const submitWebhooks = await db.query(
      'SELECT id FROM webhooks WHERE active = true AND event_type = $1',
      ['feedback.submitted']
    );

    for (const webhook of submitWebhooks.rows) {
      await db.query(
        `INSERT INTO notification_queue
         (event_type, webhook_id, payload, status)
         VALUES ('webhook', $1, $2, 'pending')`,
        [webhook.id, JSON.stringify(webhookEvent)]
      );
    }
  }

  // Event 2: Only enqueue feedback.text_submitted if text answers exist AND webhooks exist
  if (textAnswers.length > 0) {
    const textWebhooks = await db.query(
      'SELECT id FROM webhooks WHERE active = true AND event_type = $1',
      ['feedback.text_submitted']
    );

    if (textWebhooks.rows.length > 0) {
      const textEvent = {
        event_id: eventId,
        timestamp,
        type: 'feedback.text_submitted',
        data: {
          sessionId,
          locationId,
          locationName,
          questionnaireId,
          questionnaireName,
          entryMethod,
          textAnswers: textAnswers.map(a => ({
            questionId: a.question_id,
            questionText: a.question_text,
            type: 'text',
            textValue: a.text_value
          }))
        }
      };

      for (const webhook of textWebhooks.rows) {
        await db.query(
          `INSERT INTO notification_queue
           (event_type, webhook_id, payload, status)
           VALUES ('webhook', $1, $2, 'pending')`,
          [webhook.id, JSON.stringify(textEvent)]
        );
      }
    }
  }
}

/**
 * Helper function to get answer metadata (question text, type) from question IDs
 */
async function getAnswerMetadata(answers) {
  if (answers.length === 0) {
    return [];
  }

  const questionIds = answers.map(a => a.questionId);
  const qResult = await db.query(
    `SELECT id, text as question_text, type FROM questions WHERE id = ANY($1)`,
    [questionIds]
  );

  const questionMap = {};
  qResult.rows.forEach(row => {
    questionMap[row.id] = row;
  });

  return answers.map(answer => ({
    question_id: answer.questionId,
    question_text: questionMap[answer.questionId]?.question_text || '',
    type: questionMap[answer.questionId]?.type || 'unknown',
    numeric_value: answer.value || null,
    text_value: answer.textValue || null
  }));
}

module.exports = router;
