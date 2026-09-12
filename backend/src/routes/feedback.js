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

module.exports = router;
