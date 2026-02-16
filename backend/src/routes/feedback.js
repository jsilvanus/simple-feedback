const express = require('express');
const router = express.Router();
const db = require('../db');
const { feedbackLimiter } = require('../middleware/rateLimiter');

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
        error: { message: 'At least one answer is required' } 
      });
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
      const normalizedValue = typeof answer.value === 'number' ? answer.value : null;
      const normalizedTextValue =
        answer.textValue !== undefined && answer.textValue !== null
          ? answer.textValue
          : (answer.value && typeof answer.value === 'object' ? JSON.stringify(answer.value) : null);

      await client.query(
        'INSERT INTO feedback_answers (session_id, question_id, value, text_value) VALUES ($1, $2, $3, $4)',
        [sessionId, answer.questionId, normalizedValue, normalizedTextValue]
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
