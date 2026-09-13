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
      // Also check if stats webhooks need to be enqueued
      await enqueueStatisticsWebhooks(locationId, questionnaireId, answers);
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

/**
 * Calculate statistics for feedback answers
 */
function calculateStatistics(answers) {
  const numericAnswers = answers
    .filter(a => a.numeric_value !== null && a.numeric_value !== undefined)
    .map(a => parseFloat(a.numeric_value));

  if (numericAnswers.length === 0) {
    return null;
  }

  const sorted = numericAnswers.sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const variance = sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / sorted.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean: parseFloat(mean.toFixed(2)),
    median: parseFloat(median.toFixed(2)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    sum: parseFloat(sum.toFixed(2)),
    count: sorted.length,
    stdDev: parseFloat(stdDev.toFixed(2))
  };
}

/**
 * Calculate per-question statistics
 */
function calculatePerQuestionStats(answers) {
  const byQuestion = {};

  answers.forEach(answer => {
    if (!byQuestion[answer.question_id]) {
      byQuestion[answer.question_id] = [];
    }
    if (answer.numeric_value !== null && answer.numeric_value !== undefined) {
      byQuestion[answer.question_id].push(answer);
    }
  });

  return Object.entries(byQuestion).map(([qId, qAnswers]) => ({
    questionId: parseInt(qId),
    questionText: qAnswers[0]?.question_text || '',
    stats: calculateStatistics(qAnswers)
  })).filter(q => q.stats !== null);
}

/**
 * Check if statistics changed beyond threshold
 */
function hasStatsChanged(previousStats, currentStats, thresholds, questionThresholds) {
  if (!previousStats) return true; // First time, always send

  // Check overall stats if present
  if (previousStats.overall && currentStats.overall) {
    const threshold = thresholds.overall || 5;
    const changePercent = Math.abs((currentStats.overall.mean - previousStats.overall.mean) / previousStats.overall.mean * 100);
    if (changePercent >= threshold) return true;
  }

  // Check per-question stats
  if (previousStats.by_question && currentStats.by_question) {
    for (const curr of currentStats.by_question) {
      const prev = previousStats.by_question.find(q => q.questionId === curr.questionId);
      if (!prev || !prev.stats) continue;

      const qThreshold = questionThresholds?.[curr.questionId] || thresholds.default || 5;
      if (prev.stats.mean === 0) continue; // Avoid division by zero

      const changePercent = Math.abs((curr.stats.mean - prev.stats.mean) / prev.stats.mean * 100);
      if (changePercent >= qThreshold) return true;
    }
  }

  return false;
}

/**
 * Enqueue statistics webhooks if configured
 */
async function enqueueStatisticsWebhooks(locationId, questionnaireId, answers) {
  try {
    const answersWithMetadata = await getAnswerMetadata(answers);

    // Get all active stats webhooks
    const statsWebhooks = await db.query(
      `SELECT id, stats_trigger, stats_type, stats_change_threshold, stats_thresholds,
              stats_debounce_ms, stats_min_interval_ms
       FROM webhooks
       WHERE active = true AND event_type = $1`,
      ['feedback.statistics']
    );

    for (const webhook of statsWebhooks.rows) {
      // Skip on_change webhooks during debounce or min_interval
      if (webhook.stats_trigger === 'on_change') {
        const cache = await db.query(
          `SELECT last_sent_at FROM webhook_stats_cache
           WHERE webhook_id = $1 AND questionnaire_id = $2 AND location_id = $3`,
          [webhook.id, questionnaireId, locationId]
        );

        if (cache.rows.length > 0) {
          const lastSent = new Date(cache.rows[0].last_sent_at);
          const now = new Date();

          if (now - lastSent < webhook.stats_min_interval_ms) {
            continue; // Skip, still within min_interval
          }
        }
      }

      // Calculate current stats
      const statsPayload = {
        overall: webhook.stats_type !== 'per_question' ? calculateStatistics(answersWithMetadata) : null,
        by_question: webhook.stats_type !== 'overall' ? calculatePerQuestionStats(answersWithMetadata) : null
      };

      // For on_change, check if stats changed enough
      if (webhook.stats_trigger === 'on_change') {
        const cache = await db.query(
          `SELECT last_stats FROM webhook_stats_cache
           WHERE webhook_id = $1 AND questionnaire_id = $2 AND location_id = $3`,
          [webhook.id, questionnaireId, locationId]
        );

        const previousStats = cache.rows[0]?.last_stats || null;
        const thresholds = {
          overall: webhook.stats_change_threshold,
          default: webhook.stats_change_threshold
        };

        if (!hasStatsChanged(previousStats, statsPayload, thresholds, webhook.stats_thresholds)) {
          continue; // Stats didn't change enough
        }
      }

      // Enqueue the stats webhook event
      const timestamp = new Date().toISOString();
      const statsEvent = {
        event_id: `stats-${questionnaireId}-${locationId}-${Date.now()}`,
        timestamp,
        type: 'feedback.statistics',
        data: {
          locationId,
          questionnaireId,
          stats: statsPayload
        }
      };

      await db.query(
        `INSERT INTO notification_queue
         (event_type, webhook_id, payload, status)
         VALUES ('webhook', $1, $2, 'pending')`,
        [webhook.id, JSON.stringify(statsEvent)]
      );

      // Update cache
      await db.query(
        `INSERT INTO webhook_stats_cache (webhook_id, questionnaire_id, location_id, last_stats, last_sent_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (webhook_id, questionnaire_id, location_id)
         DO UPDATE SET last_stats = $4, last_sent_at = NOW()`,
        [webhook.id, questionnaireId, locationId, JSON.stringify(statsPayload)]
      );
    }
  } catch (err) {
    console.error('Failed to enqueue statistics webhooks:', err);
  }
}

module.exports = router;
