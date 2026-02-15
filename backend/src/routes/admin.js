const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};

/**
 * POST /api/admin/login
 * Admin login (simplified - no user table for now)
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // Simple hardcoded admin credentials for now
    // TODO: Move to database with proper user management
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign(
        { username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        expiresIn: 86400,
      });
    } else {
      res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
  } catch (error) {
    next(error);
  }
});

// All routes below require authentication
router.use(authenticate);

/**
 * GET /api/admin/locations
 * Get all locations
 */
router.get('/locations', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM locations ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/locations
 * Create a new location
 */
router.post('/locations', async (req, res, next) => {
  try {
    const { slug, name, active } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: { message: 'Slug and name are required' } });
    }

    const result = await db.query(
      'INSERT INTO locations (slug, name, active) VALUES ($1, $2, $3) RETURNING *',
      [slug, name, active !== undefined ? active : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: { message: 'Location with this slug already exists' } });
    }
    next(error);
  }
});

/**
 * GET /api/admin/questions
 * Get all questions
 */
router.get('/questions', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM questions ORDER BY id'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/questions
 * Create a new question
 */
router.post('/questions', async (req, res, next) => {
  try {
    const { text, type } = req.body;

    if (!text || !type) {
      return res.status(400).json({ error: { message: 'Text and type are required' } });
    }

    if (!['scale', 'text', 'wordcloud'].includes(type)) {
      return res.status(400).json({ error: { message: 'Invalid question type' } });
    }

    const result = await db.query(
      'INSERT INTO questions (text, type) VALUES ($1, $2) RETURNING *',
      [text, type]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/answer-scales
 * Get all answer scales
 */
router.get('/answer-scales', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM answer_scales ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/answer-scales
 * Create a new answer scale
 */
router.post('/answer-scales', async (req, res, next) => {
  try {
    const { name, buttons } = req.body;

    if (!name || !buttons || !Array.isArray(buttons)) {
      return res.status(400).json({ error: { message: 'Name and buttons array are required' } });
    }

    const result = await db.query(
      'INSERT INTO answer_scales (name, buttons) VALUES ($1, $2) RETURNING *',
      [name, JSON.stringify(buttons)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/questionnaires
 * Get all questionnaires
 */
router.get('/questionnaires', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM questionnaires ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/questionnaires
 * Create a new questionnaire
 */
router.post('/questionnaires', async (req, res, next) => {
  const client = await db.pool.connect();
  
  try {
    const { name, description, questions } = req.body;

    if (!name) {
      return res.status(400).json({ error: { message: 'Name is required' } });
    }

    await client.query('BEGIN');

    // Create questionnaire
    const questionnaireResult = await client.query(
      'INSERT INTO questionnaires (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || null]
    );

    const questionnaireId = questionnaireResult.rows[0].id;

    // Add questions if provided
    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        await client.query(
          'INSERT INTO questionnaire_questions (questionnaire_id, question_id, page_number, answer_scale_id, order_index) VALUES ($1, $2, $3, $4, $5)',
          [questionnaireId, q.questionId, q.pageNumber || 1, q.answerScaleId || null, q.orderIndex || 0]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json(questionnaireResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/schedules
 * Get all schedules
 */
router.get('/schedules', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, l.name as location_name, q.name as questionnaire_name
       FROM schedules s
       JOIN locations l ON s.location_id = l.id
       JOIN questionnaires q ON s.questionnaire_id = q.id
       ORDER BY s.start_time DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/schedules
 * Create a new schedule
 */
router.post('/schedules', async (req, res, next) => {
  try {
    const { locationId, questionnaireId, startTime, endTime } = req.body;

    if (!locationId || !questionnaireId || !startTime || !endTime) {
      return res.status(400).json({ 
        error: { message: 'locationId, questionnaireId, startTime, and endTime are required' } 
      });
    }

    const result = await db.query(
      'INSERT INTO schedules (location_id, questionnaire_id, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [locationId, questionnaireId, startTime, endTime]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/results
 * Get feedback results with optional filters
 */
router.get('/results', async (req, res, next) => {
  try {
    const { locationId, questionnaireId, startDate, endDate } = req.query;

    let query = `
      SELECT 
        fs.id as session_id,
        fs.timestamp,
        l.name as location_name,
        q.name as questionnaire_name,
        quest.id as question_id,
        quest.text as question_text,
        quest.type as question_type,
        fa.value,
        fa.text_value
      FROM feedback_sessions fs
      JOIN locations l ON fs.location_id = l.id
      JOIN questionnaires q ON fs.questionnaire_id = q.id
      JOIN feedback_answers fa ON fs.id = fa.session_id
      JOIN questions quest ON fa.question_id = quest.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (locationId) {
      paramCount++;
      query += ` AND fs.location_id = $${paramCount}`;
      params.push(locationId);
    }

    if (questionnaireId) {
      paramCount++;
      query += ` AND fs.questionnaire_id = $${paramCount}`;
      params.push(questionnaireId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND fs.timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND fs.timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    query += ' ORDER BY fs.timestamp DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/export
 * Export results as CSV (simplified)
 */
router.get('/export', async (req, res, next) => {
  try {
    const { locationId, questionnaireId, startDate, endDate } = req.query;

    let query = `
      SELECT 
        fs.id as session_id,
        fs.timestamp,
        l.name as location_name,
        q.name as questionnaire_name,
        quest.text as question_text,
        fa.value,
        fa.text_value
      FROM feedback_sessions fs
      JOIN locations l ON fs.location_id = l.id
      JOIN questionnaires q ON fs.questionnaire_id = q.id
      JOIN feedback_answers fa ON fs.id = fa.session_id
      JOIN questions quest ON fa.question_id = quest.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (locationId) {
      paramCount++;
      query += ` AND fs.location_id = $${paramCount}`;
      params.push(locationId);
    }

    if (questionnaireId) {
      paramCount++;
      query += ` AND fs.questionnaire_id = $${paramCount}`;
      params.push(questionnaireId);
    }

    if (startDate) {
      paramCount++;
      query += ` AND fs.timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      query += ` AND fs.timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    query += ' ORDER BY fs.timestamp DESC';

    const result = await db.query(query, params);

    // Convert to CSV
    const csv = [
      'Session ID,Timestamp,Location,Questionnaire,Question,Value,Text Value',
      ...result.rows.map(row => 
        `${row.session_id},"${row.timestamp}","${row.location_name}","${row.questionnaire_name}","${row.question_text}",${row.value || ''},"${row.text_value || ''}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
