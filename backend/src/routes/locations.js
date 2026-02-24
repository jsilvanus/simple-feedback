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

    // Get location with group information
    const locationResult = await db.query(
      'SELECT l.*, lg.id as group_id FROM locations l LEFT JOIN location_groups lg ON l.group_id = lg.id WHERE l.slug = $1 AND l.active = true',
      [slug]
    );

    if (locationResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location not found or inactive' } });
    }

    const location = locationResult.rows[0];

    // Get active schedule for this location
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format

    // Query for active schedules (both location-specific and group-level)
    // Priority: location-specific schedules first, then group-level schedules
    const scheduleResult = await db.query(
      `SELECT DISTINCT s.*, s.schedule_type, s.weekday_pattern, s.show_only_one,
              CASE WHEN sl.location_id IS NOT NULL THEN 1 ELSE 2 END as priority
       FROM schedules s
       JOIN schedule_locations sl ON s.id = sl.schedule_id
       WHERE (sl.location_id = $1 OR (sl.location_group_id = $2 AND $2 IS NOT NULL))
         AND (
           (s.schedule_type = 'date_based' AND s.start_time <= $3 AND s.end_time >= $3)
           OR (s.schedule_type = 'recurring_weekday')
         )
       ORDER BY priority, s.created_at DESC
       LIMIT 100`,
      [location.id, location.group_id, now]
    );

    // Filter recurring schedules based on current day and time
    const activeSchedules = scheduleResult.rows.filter(schedule => {
      if (schedule.schedule_type === 'date_based') {
        return true; // Already filtered in SQL
      } else if (schedule.schedule_type === 'recurring_weekday' && schedule.weekday_pattern) {
        const pattern = schedule.weekday_pattern;
        const isDayActive = pattern.days && pattern.days.includes(currentDayOfWeek);
        const isTimeActive = currentTime >= pattern.start_hour && currentTime <= pattern.end_hour;
        return isDayActive && isTimeActive;
      }
      return false;
    });

    if (activeSchedules.length === 0) {
      return res.status(404).json({ error: { message: 'No active questionnaire for this location' } });
    }

    const schedule = activeSchedules[0];

    // Get questionnaires for this schedule
    let questionnairesResult = await db.query(
      `SELECT q.id, q.name, q.description, sq.display_order
       FROM schedule_questionnaires sq
       JOIN questionnaires q ON sq.questionnaire_id = q.id
       WHERE sq.schedule_id = $1
       ORDER BY sq.display_order`,
      [schedule.id]
    );

    // Fallback to legacy questionnaire_id if no questionnaires in junction table
    if (questionnairesResult.rows.length === 0 && schedule.questionnaire_id) {
      questionnairesResult = await db.query(
        'SELECT id, name, description FROM questionnaires WHERE id = $1',
        [schedule.questionnaire_id]
      );
    }

    if (questionnairesResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'No questionnaires found for this schedule' } });
    }

    // If show_only_one is true, return only the first questionnaire
    const questionnairesToShow = schedule.show_only_one
      ? [questionnairesResult.rows[0]]
      : questionnairesResult.rows;

    // Get questions for all questionnaires
    const questionnaires = await Promise.all(
      questionnairesToShow.map(async (q) => {
        const questionsResult = await db.query(
          `SELECT q.id, q.text, q.type, qq.page_number, qq.order_index,
                  q.answer_scale_id, a.name as scale_name, a.buttons,
                  a.scale_mode, a.step, a.min_label, a.max_label, a.min_value, a.max_value,
                  q.word_cloud_options_id, wc.name as word_cloud_name, wc.words,
                  q.max_selections, q.continuous_axes
           FROM questions q
           JOIN questionnaire_questions qq ON q.id = qq.question_id
           LEFT JOIN answer_scales a ON q.answer_scale_id = a.id
           LEFT JOIN word_cloud_options wc ON q.word_cloud_options_id = wc.id
           WHERE qq.questionnaire_id = $1
             AND q.type IN ('scale', 'text', 'wordcloud')
           ORDER BY qq.page_number, qq.order_index`,
          [q.id]
        );

        // Group questions by page
        const pages = {};
        questionsResult.rows.forEach((question) => {
          if (!pages[question.page_number]) {
            pages[question.page_number] = [];
          }
          pages[question.page_number].push({
            id: question.id,
            text: question.text,
            type: question.type,
            answerScale: question.answer_scale_id ? {
              id: question.answer_scale_id,
              name: question.scale_name,
              buttons: question.buttons || [],
              scaleMode: question.scale_mode || 'normal',
              step: question.step !== null && question.step !== undefined ? parseFloat(question.step) : 1,
              minLabel: question.min_label || null,
              maxLabel: question.max_label || null,
              minValue: question.min_value !== null && question.min_value !== undefined ? parseFloat(question.min_value) : null,
              maxValue: question.max_value !== null && question.max_value !== undefined ? parseFloat(question.max_value) : null,
            } : null,
            wordCloudOptions: question.words ? {
              id: question.word_cloud_options_id,
              name: question.word_cloud_name,
              words: question.words,
            } : null,
            maxSelections: question.max_selections || 3,
            continuousAxes: Array.isArray(question.continuous_axes) ? question.continuous_axes : [],
          });
        });

        return {
          id: q.id,
          name: q.name,
          description: q.description,
          pages: Object.keys(pages)
            .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
            .map((pageNum) => ({
              number: parseInt(pageNum, 10),
              questions: pages[pageNum],
            })),
        };
      })
    );

    // For backward compatibility, if only one questionnaire, return it directly
    const response = {
      location: {
        id: location.id,
        slug: location.slug,
        name: location.name,
        passwordRequired: location.password_required || false,
      },
    };

    if (questionnaires.length === 1) {
      response.questionnaire = questionnaires[0];
    } else {
      response.questionnaires = questionnaires;
    }

    res.json(response);
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
