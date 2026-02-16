const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { apiLimiter, loginLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/locations/:slug/questionnaire
 * Get active questionnaire for a location
 */
router.get('/:slug/questionnaire', apiLimiter, async (req, res, next) => {
  try {
    const { slug } = req.params;

    // Get location
    const locationResult = await db.query(
      'SELECT * FROM locations WHERE slug = $1 AND active = true',
      [slug]
    );

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location not found or inactive' } });
    }

    const location = locationResult.rows[0];

    // Get active schedule for this location
    const now = new Date();
    const scheduleResult = await db.query(
      `SELECT s.*, q.name, q.description
       FROM schedules s
       JOIN questionnaires q ON s.questionnaire_id = q.id
       WHERE s.location_id = $1 
         AND s.start_time <= $2 
         AND s.end_time >= $2
       ORDER BY s.start_time DESC
       LIMIT 1`,
      [location.id, now]
    );

    if (scheduleResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'No active questionnaire for this location' } });
    }

    const schedule = scheduleResult.rows[0];

    // Get questions for this questionnaire
    const questionsResult = await db.query(
      `SELECT q.id, q.text, q.type, qq.page_number, qq.order_index, 
              qq.answer_scale_id, a.name as scale_name, a.buttons,
              qq.word_cloud_options_id, wc.name as word_cloud_name, wc.words,
              qq.max_selections
       FROM questions q
       JOIN questionnaire_questions qq ON q.id = qq.question_id
       LEFT JOIN answer_scales a ON qq.answer_scale_id = a.id
       LEFT JOIN word_cloud_options wc ON qq.word_cloud_options_id = wc.id
       WHERE qq.questionnaire_id = $1
       ORDER BY qq.page_number, qq.order_index`,
      [schedule.questionnaire_id]
    );

    // Group questions by page
    const pages = {};
    questionsResult.rows.forEach((q) => {
      if (!pages[q.page_number]) {
        pages[q.page_number] = [];
      }
      pages[q.page_number].push({
        id: q.id,
        text: q.text,
        type: q.type,
        answerScale: q.buttons ? {
          id: q.answer_scale_id,
          name: q.scale_name,
          buttons: q.buttons,
        } : null,
        wordCloudOptions: q.words ? {
          id: q.word_cloud_options_id,
          name: q.word_cloud_name,
          words: q.words,
        } : null,
        maxSelections: q.max_selections || 3,
      });
    });

    const questionnaire = {
      id: schedule.questionnaire_id,
      name: schedule.name,
      description: schedule.description,
      pages: Object.keys(pages)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map((pageNum) => ({
          number: parseInt(pageNum),
          questions: pages[pageNum],
        })),
    };

    res.json({
      location: {
        id: location.id,
        slug: location.slug,
        name: location.name,
      },
      questionnaire,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/locations/:slug/login
 * Authenticate to a password-protected location
 */
router.post('/:slug/login', loginLimiter, async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    // Get location
    const locationResult = await db.query(
      'SELECT id, slug, name, password_hash, password_required FROM locations WHERE slug = $1 AND active = true',
      [slug]
    );

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location not found or inactive' } });
    }

    const location = locationResult.rows[0];

    // Check if password is required
    if (!location.password_required || !location.password_hash) {
      return res.json({ success: true, message: 'No password required' });
    }

    // Validate password
    if (!password) {
      return res.status(400).json({ error: { message: 'Password is required' } });
    }

    const isValid = await bcrypt.compare(password, location.password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: { message: 'Invalid password' } });
    }

    res.json({ success: true, message: 'Authenticated successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
