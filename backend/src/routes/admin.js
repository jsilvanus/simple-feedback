const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

/**
 * POST /api/admin/login
 * Admin login (simplified - no user table for now)
 */
router.post('/login', loginLimiter, async (req, res, next) => {
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

// All routes below require authentication and rate limiting
router.use(authenticate);
// router.use(apiLimiter);
// Deactivated in development to avoid hitting limits during testing, but should be enabled in production

/**
 * GET /api/admin/locations
 * Get all locations
 */
router.get('/locations', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT l.*, lg.name as group_name
       FROM locations l
       LEFT JOIN location_groups lg ON l.group_id = lg.id
       ORDER BY l.name`
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
    const {
      slug,
      name,
      active,
      groupId,
      password,
      passwordRequired,
    } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: { message: 'Slug and name are required' } });
    }

    if (passwordRequired && !password) {
      return res.status(400).json({ error: { message: 'Password is required when password protection is enabled' } });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    const result = await db.query(
      `INSERT INTO locations
       (slug, name, active, group_id, password_hash, password_required)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        slug,
        name,
        active !== undefined ? active : true,
        groupId || null,
        passwordHash,
        passwordRequired === true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: { message: 'Location slug already exists' } });
    }
    next(error);
  }
});

/**
 * PUT /api/admin/locations/:id
 * Update a location
 */
router.put('/locations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      slug,
      name,
      active,
      groupId,
      password,
      passwordRequired,
    } = req.body;

    const existingResult = await db.query(
      'SELECT id, password_hash, password_required FROM locations WHERE id = $1',
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location not found' } });
    }

    const existing = existingResult.rows[0];
    const finalPasswordRequired =
      passwordRequired !== undefined ? passwordRequired : existing.password_required;

    if (finalPasswordRequired && !password && !existing.password_hash) {
      return res.status(400).json({ error: { message: 'Password is required when enabling password protection' } });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (slug !== undefined) {
      updates.push(`slug = $${paramCount++}`);
      values.push(slug);
    }
    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      values.push(active);
    }
    if (groupId !== undefined) {
      updates.push(`group_id = $${paramCount++}`);
      values.push(groupId || null);
    }
    if (passwordRequired !== undefined) {
      updates.push(`password_required = $${paramCount++}`);
      values.push(passwordRequired);

      if (passwordRequired === false) {
        updates.push(`password_hash = NULL`);
      }
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE locations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: { message: 'Location slug already exists' } });
    }
    next(error);
  }
});

/**
 * PUT /api/admin/answer-scales/:id
 * Update an answer scale
 */
router.put('/answer-scales/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, buttons, scaleMode, step, minLabel, maxLabel, minValue, maxValue } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (buttons !== undefined) {
      if (!Array.isArray(buttons)) {
        return res.status(400).json({ error: { message: 'Buttons must be an array' } });
      }
      updates.push(`buttons = $${paramCount++}`);
      values.push(JSON.stringify(buttons));
    }
    if (scaleMode !== undefined) {
      if (!['normal', 'bipolar'].includes(scaleMode)) {
        return res.status(400).json({ error: { message: "scaleMode must be 'normal' or 'bipolar'" } });
      }
      updates.push(`scale_mode = $${paramCount++}`);
      values.push(scaleMode);
    }
    if (step !== undefined) {
      const stepFloat = parseFloat(step);
      if (isNaN(stepFloat) || stepFloat < 0.01 || stepFloat > 1) {
        return res.status(400).json({ error: { message: 'step must be between 0.01 and 1' } });
      }
      updates.push(`step = $${paramCount++}`);
      values.push(stepFloat);
    }
    if (minLabel !== undefined) {
      updates.push(`min_label = $${paramCount++}`);
      values.push(minLabel !== null ? JSON.stringify(minLabel) : null);
    }
    if (maxLabel !== undefined) {
      updates.push(`max_label = $${paramCount++}`);
      values.push(maxLabel !== null ? JSON.stringify(maxLabel) : null);
    }
    if (minValue !== undefined) {
      updates.push(`min_value = $${paramCount++}`);
      values.push(minValue !== null && minValue !== '' ? parseFloat(minValue) : null);
    }
    if (maxValue !== undefined) {
      updates.push(`max_value = $${paramCount++}`);
      values.push(maxValue !== null && maxValue !== '' ? parseFloat(maxValue) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE answer_scales SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Answer scale not found' } });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/answer-scales/:id
 * Delete an answer scale
 */
router.delete('/answer-scales/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM answer_scales WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Answer scale not found' } });
    }

    res.json({ success: true, message: 'Answer scale deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/word-cloud-options
 * Get all word cloud options
 */
router.get('/word-cloud-options', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM word_cloud_options ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/word-cloud-options
 * Create a new word cloud option set
 */
router.post('/word-cloud-options', async (req, res, next) => {
  try {
    const { name, words } = req.body;

    if (!name || !words || !Array.isArray(words)) {
      return res.status(400).json({ error: { message: 'Name and words array are required' } });
    }

    const result = await db.query(
      'INSERT INTO word_cloud_options (name, words) VALUES ($1, $2) RETURNING *',
      [name, JSON.stringify(words)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/word-cloud-options/:id
 * Update an existing word cloud option set
 */
router.put('/word-cloud-options/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, words } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (words !== undefined) {
      if (!Array.isArray(words)) {
        return res.status(400).json({ error: { message: 'words must be an array' } });
      }
      updates.push(`words = $${paramCount++}`);
      values.push(JSON.stringify(words));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE word_cloud_options SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Word cloud option set not found' } });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/locations/:id
 * Delete a location
 */
router.delete('/locations/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM locations WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location not found' } });
    }

    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/location-groups
 * Get all location groups
 */
router.get('/location-groups', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM location_groups ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/location-groups
 * Create a new location group
 */
router.post('/location-groups', async (req, res, next) => {
  try {
    const { name, description, active } = req.body;

    if (!name) {
      return res.status(400).json({ error: { message: 'Name is required' } });
    }

    const result = await db.query(
      'INSERT INTO location_groups (name, description, active) VALUES ($1, $2, $3) RETURNING *',
      [name, description, active !== undefined ? active : true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/location-groups/:id
 * Update a location group
 */
router.put('/location-groups/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      values.push(active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE location_groups SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location group not found' } });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/location-groups/:id
 * Delete a location group
 */
router.delete('/location-groups/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM location_groups WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Location group not found' } });
    }

    res.json({ success: true, message: 'Location group deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/questions
 * Get all questions
 */
router.get('/questions', async (req, res, next) => {
  try {
    const { includeArchived } = req.query;
    
    let query = 'SELECT * FROM questions';
    if (includeArchived !== 'true') {
      query += ' WHERE archived = false';
    }
    query += ' ORDER BY id';

    const result = await db.query(query);
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
    const { text, type, answerScaleId, wordCloudOptionsId, maxSelections, continuousAxes } = req.body;

    if (!text || !type) {
      return res.status(400).json({ error: { message: 'Text and type are required' } });
    }

    if (!['scale', 'text', 'wordcloud', 'continuous_scale'].includes(type)) {
      return res.status(400).json({ error: { message: 'Invalid question type' } });
    }

    if (continuousAxes !== undefined && !Array.isArray(continuousAxes)) {
      return res.status(400).json({ error: { message: 'continuousAxes must be an array' } });
    }

    if (type === 'continuous_scale') {
      if (!answerScaleId) {
        return res.status(400).json({ error: { message: 'answerScaleId is required for continuous_scale questions' } });
      }
      if (!Array.isArray(continuousAxes) || continuousAxes.length === 0) {
        return res.status(400).json({ error: { message: 'continuousAxes must contain at least one axis for continuous_scale questions' } });
      }
    }

    const scaleId = ['scale', 'continuous_scale'].includes(type) ? (answerScaleId || null) : null;
    const cloudId = type === 'wordcloud' ? (wordCloudOptionsId || null) : null;
    const normalizedMaxSelections = type === 'wordcloud' ? (maxSelections || 3) : 3;
    const normalizedContinuousAxes = type === 'continuous_scale'
      ? continuousAxes.map((axis, index) => ({
          id: axis.id || `axis_${index + 1}`,
          label: axis.label || `Axis ${index + 1}`,
        }))
      : null;

    const result = await db.query(
      'INSERT INTO questions (text, type, answer_scale_id, word_cloud_options_id, max_selections, continuous_axes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [text, type, scaleId, cloudId, normalizedMaxSelections, normalizedContinuousAxes ? JSON.stringify(normalizedContinuousAxes) : null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/questions/:id
 * Update a question
 */
router.put('/questions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text, type, answerScaleId, wordCloudOptionsId, maxSelections, continuousAxes } = req.body;

    const existingResult = await db.query('SELECT * FROM questions WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Question not found' } });
    }

    const existing = existingResult.rows[0];
    const finalType = type !== undefined ? type : existing.type;

    if (continuousAxes !== undefined && !Array.isArray(continuousAxes)) {
      return res.status(400).json({ error: { message: 'continuousAxes must be an array' } });
    }

    const finalContinuousAxes = continuousAxes !== undefined ? continuousAxes : (existing.continuous_axes || []);

    if (finalType === 'continuous_scale') {
      const finalAnswerScale = answerScaleId !== undefined ? answerScaleId : existing.answer_scale_id;
      if (!finalAnswerScale) {
        return res.status(400).json({ error: { message: 'answerScaleId is required for continuous_scale questions' } });
      }
      if (!Array.isArray(finalContinuousAxes) || finalContinuousAxes.length === 0) {
        return res.status(400).json({ error: { message: 'continuousAxes must contain at least one axis for continuous_scale questions' } });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (text !== undefined) {
      updates.push(`text = $${paramCount++}`);
      values.push(text);
    }
    if (type !== undefined) {
      if (!['scale', 'text', 'wordcloud', 'continuous_scale'].includes(type)) {
        return res.status(400).json({ error: { message: 'Invalid question type' } });
      }
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }

    if (answerScaleId !== undefined) {
      updates.push(`answer_scale_id = $${paramCount++}`);
      values.push(answerScaleId || null);
    }

    if (wordCloudOptionsId !== undefined) {
      updates.push(`word_cloud_options_id = $${paramCount++}`);
      values.push(wordCloudOptionsId || null);
    }

    if (maxSelections !== undefined) {
      updates.push(`max_selections = $${paramCount++}`);
      values.push(maxSelections || 3);
    }

    if (continuousAxes !== undefined) {
      const normalizedAxes = continuousAxes.map((axis, index) => ({
        id: axis.id || `axis_${index + 1}`,
        label: axis.label || `Axis ${index + 1}`,
      }));
      updates.push(`continuous_axes = $${paramCount++}`);
      values.push(JSON.stringify(normalizedAxes));
    }

    if (!['scale', 'continuous_scale'].includes(finalType) && answerScaleId === undefined) {
      updates.push(`answer_scale_id = NULL`);
    }
    if (finalType !== 'wordcloud') {
      if (wordCloudOptionsId === undefined) {
        updates.push(`word_cloud_options_id = NULL`);
      }
      if (maxSelections === undefined) {
        updates.push(`max_selections = 3`);
      }
    }
    if (finalType !== 'continuous_scale' && continuousAxes === undefined) {
      updates.push(`continuous_axes = NULL`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `UPDATE questions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/questions/:id/archive
 * Archive or unarchive a question
 */
router.patch('/questions/:id/archive', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.body;

    if (archived === undefined) {
      return res.status(400).json({ error: { message: 'archived field is required' } });
    }

    const result = await db.query(
      'UPDATE questions SET archived = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [archived, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Question not found' } });
    }

    res.json(result.rows[0]);
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
    const { name, buttons, scaleMode, step, minLabel, maxLabel, minValue, maxValue } = req.body;

    if (!name || !buttons || !Array.isArray(buttons)) {
      return res.status(400).json({ error: { message: 'Name and buttons array are required' } });
    }

    if (scaleMode !== undefined && !['normal', 'bipolar'].includes(scaleMode)) {
      return res.status(400).json({ error: { message: "scaleMode must be 'normal' or 'bipolar'" } });
    }

    if (step !== undefined) {
      const stepFloat = parseFloat(step);
      if (isNaN(stepFloat) || stepFloat < 0.01 || stepFloat > 1) {
        return res.status(400).json({ error: { message: 'step must be between 0.01 and 1' } });
      }
    }

    const result = await db.query(
      `INSERT INTO answer_scales (name, buttons, scale_mode, step, min_label, max_label, min_value, max_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        name,
        JSON.stringify(buttons),
        scaleMode || 'normal',
        step !== undefined ? parseFloat(step) : 1,
        minLabel ? JSON.stringify(minLabel) : null,
        maxLabel ? JSON.stringify(maxLabel) : null,
        minValue !== undefined && minValue !== null && minValue !== '' ? parseFloat(minValue) : null,
        maxValue !== undefined && maxValue !== null && maxValue !== '' ? parseFloat(maxValue) : null,
      ]
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
    const { includeArchived } = req.query;
    
    let query = 'SELECT * FROM questionnaires';
    if (includeArchived !== 'true') {
      query += ' WHERE archived = false';
    }
    query += ' ORDER BY name';

    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/questionnaires/:id
 * Get questionnaire details including assigned questions
 */
router.get('/questionnaires/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const questionnaireResult = await db.query(
      'SELECT * FROM questionnaires WHERE id = $1',
      [id]
    );

    if (questionnaireResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Questionnaire not found' } });
    }

    const questionsResult = await db.query(
      `SELECT question_id, page_number, order_index
       FROM questionnaire_questions
       WHERE questionnaire_id = $1
       ORDER BY page_number, order_index`,
      [id]
    );

    res.json({
      ...questionnaireResult.rows[0],
      questions: questionsResult.rows,
    });
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
          'INSERT INTO questionnaire_questions (questionnaire_id, question_id, page_number, order_index) VALUES ($1, $2, $3, $4)',
          [questionnaireId, q.questionId, q.pageNumber || 1, q.orderIndex || 0]
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
 * PUT /api/admin/questionnaires/:id
 * Update a questionnaire
 */
router.put('/questionnaires/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  
  try {
    const { id } = req.params;
    const { name, description, questions } = req.body;

    await client.query('BEGIN');

    // Update questionnaire basic info
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE questionnaires SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: { message: 'Questionnaire not found' } });
      }
    }

    // Update questions if provided
    if (questions !== undefined && Array.isArray(questions)) {
      // Delete existing questions
      await client.query(
        'DELETE FROM questionnaire_questions WHERE questionnaire_id = $1',
        [id]
      );

      // Add new questions
      for (const q of questions) {
        await client.query(
          'INSERT INTO questionnaire_questions (questionnaire_id, question_id, page_number, order_index) VALUES ($1, $2, $3, $4)',
          [
            id,
            q.questionId,
            q.pageNumber || 1,
            q.orderIndex || 0,
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch updated questionnaire
    const result = await db.query('SELECT * FROM questionnaires WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/schedules
 * Get all schedules with their questionnaires
 */
router.get('/schedules', async (req, res, next) => {
  try {
    // Get all schedules with location and location group info
    const schedulesResult = await db.query(
      `SELECT s.*, 
              l.name as location_name, l.slug as location_slug,
              lg.name as location_group_name
       FROM schedules s
       LEFT JOIN locations l ON s.location_id = l.id
       LEFT JOIN location_groups lg ON s.location_group_id = lg.id
       ORDER BY s.start_time DESC`
    );

    // For each schedule, get associated questionnaires and location targets
    const schedules = await Promise.all(
      schedulesResult.rows.map(async (schedule) => {
        // Try to get questionnaires from junction table first
        let questionnairesResult = await db.query(
          `SELECT q.id, q.name, sq.display_order
           FROM schedule_questionnaires sq
           JOIN questionnaires q ON sq.questionnaire_id = q.id
           WHERE sq.schedule_id = $1
           ORDER BY sq.display_order`,
          [schedule.id]
        );

        // If no questionnaires in junction table and legacy questionnaire_id exists, use that
        if (questionnairesResult.rows.length === 0 && schedule.questionnaire_id) {
          const legacyResult = await db.query(
            'SELECT id, name FROM questionnaires WHERE id = $1',
            [schedule.questionnaire_id]
          );
          questionnairesResult.rows = legacyResult.rows.map(q => ({ ...q, display_order: 0 }));
        }

        // Get location targets from junction table
        const locTargetsResult = await db.query(
          `SELECT sl.location_id, sl.location_group_id,
                  l.name  AS location_name,  l.slug AS location_slug,
                  lg.name AS location_group_name
           FROM schedule_locations sl
           LEFT JOIN locations      l  ON sl.location_id       = l.id
           LEFT JOIN location_groups lg ON sl.location_group_id = lg.id
           WHERE sl.schedule_id = $1`,
          [schedule.id]
        );

        return {
          ...schedule,
          questionnaires: questionnairesResult.rows,
          questionnaire_name: questionnairesResult.rows[0]?.name || null,
          locationTargets: locTargetsResult.rows,
        };
      })
    );

    res.json(schedules);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/admin/questionnaires/:id/archive
 * Archive or unarchive a questionnaire
 */
router.patch('/questionnaires/:id/archive', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { archived } = req.body;

    if (archived === undefined) {
      return res.status(400).json({ error: { message: 'archived field is required' } });
    }

    const result = await db.query(
      'UPDATE questionnaires SET archived = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [archived, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Questionnaire not found' } });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/schedules
 * Create a new schedule
 */
router.post('/schedules', async (req, res, next) => {
  const client = await db.pool.connect();
  
  try {
    const {
      locationTargets,  // Array of {locationId?} | {locationGroupId?} — replaces old locationId/locationGroupId
      questionnaireIds, // Array of questionnaire IDs
      scheduleType,     // 'date_based' or 'recurring_weekday'
      startTime,        // For date_based
      endTime,          // For date_based
      weekdayPattern,   // For recurring_weekday: {days: [1,2,3], start_hour: "09:00", end_hour: "17:00"}
      showOnlyOne       // Boolean
    } = req.body;

    if (!questionnaireIds || !Array.isArray(questionnaireIds) || questionnaireIds.length === 0) {
      return res.status(400).json({
        error: { message: 'questionnaireIds array is required and must not be empty' }
      });
    }

    const type = scheduleType || 'date_based';

    // Validate based on schedule type
    if (type === 'date_based') {
      if (!startTime || !endTime) {
        return res.status(400).json({
          error: { message: 'startTime and endTime are required for date_based schedules' }
        });
      }
    } else if (type === 'recurring_weekday') {
      if (!weekdayPattern || !weekdayPattern.days || !weekdayPattern.start_hour || !weekdayPattern.end_hour) {
        return res.status(400).json({
          error: { message: 'weekdayPattern with days, start_hour, and end_hour is required for recurring_weekday schedules' }
        });
      }
    } else {
      return res.status(400).json({
        error: { message: 'scheduleType must be either date_based or recurring_weekday' }
      });
    }

    await client.query('BEGIN');

    // Determine location_id or location_group_id if provided
    let locationId = null;
    let locationGroupId = null;
    if (Array.isArray(locationTargets) && locationTargets.length > 0) {
      const target = locationTargets[0]; // Only use the first for legacy column
      if (target.locationId) locationId = target.locationId;
      if (target.locationGroupId) locationGroupId = target.locationGroupId;
    }

    const scheduleResult = await client.query(
      `INSERT INTO schedules
       (schedule_type, start_time, end_time, weekday_pattern, show_only_one, location_id, location_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        type,
        type === 'date_based' ? startTime : null,
        type === 'date_based' ? endTime : null,
        type === 'recurring_weekday' ? JSON.stringify(weekdayPattern) : null,
        showOnlyOne || false,
        locationId,
        locationGroupId
      ]
    );

    const scheduleId = scheduleResult.rows[0].id;

    // Add questionnaires to junction table
    for (let i = 0; i < questionnaireIds.length; i++) {
      await client.query(
        'INSERT INTO schedule_questionnaires (schedule_id, questionnaire_id, display_order) VALUES ($1, $2, $3)',
        [scheduleId, questionnaireIds[i], i]
      );
    }

    // Add location targets to junction table
    if (Array.isArray(locationTargets)) {
      for (const target of locationTargets) {
        const locId = target.locationId || null;
        const lgId  = target.locationGroupId || null;
        if (locId || lgId) {
          await client.query(
            'INSERT INTO schedule_locations (schedule_id, location_id, location_group_id) VALUES ($1, $2, $3)',
            [scheduleId, locId, lgId]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json(scheduleResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin/schedules/:id
 * Update a schedule
 */
router.put('/schedules/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  
  try {
    const { id } = req.params;
    const {
      locationTargets, // Array of {locationId?} | {locationGroupId?} — replaces old locationId/locationGroupId
      questionnaireIds,
      scheduleType,
      startTime,
      endTime,
      weekdayPattern,
      showOnlyOne
    } = req.body;

    await client.query('BEGIN');

    // Build update query for scalar schedule fields
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (scheduleType !== undefined) {
      updates.push(`schedule_type = $${paramCount++}`);
      values.push(scheduleType);
    }
    if (startTime !== undefined) {
      updates.push(`start_time = $${paramCount++}`);
      values.push(startTime);
    }
    if (endTime !== undefined) {
      updates.push(`end_time = $${paramCount++}`);
      values.push(endTime);
    }
    if (weekdayPattern !== undefined) {
      updates.push(`weekday_pattern = $${paramCount++}`);
      values.push(weekdayPattern ? JSON.stringify(weekdayPattern) : null);
    }
    if (showOnlyOne !== undefined) {
      updates.push(`show_only_one = $${paramCount++}`);
      values.push(showOnlyOne);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE schedules SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: { message: 'Schedule not found' } });
      }
    }

    // Update questionnaires if provided
    if (questionnaireIds !== undefined && Array.isArray(questionnaireIds)) {
      await client.query('DELETE FROM schedule_questionnaires WHERE schedule_id = $1', [id]);
      for (let i = 0; i < questionnaireIds.length; i++) {
        await client.query(
          'INSERT INTO schedule_questionnaires (schedule_id, questionnaire_id, display_order) VALUES ($1, $2, $3)',
          [id, questionnaireIds[i], i]
        );
      }
    }

    // Update location targets if provided
    if (locationTargets !== undefined && Array.isArray(locationTargets)) {
      await client.query('DELETE FROM schedule_locations WHERE schedule_id = $1', [id]);
      for (const target of locationTargets) {
        const locId = target.locationId || null;
        const lgId  = target.locationGroupId || null;
        if (locId || lgId) {
          await client.query(
            'INSERT INTO schedule_locations (schedule_id, location_id, location_group_id) VALUES ($1, $2, $3)',
            [id, locId, lgId]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Fetch updated schedule
    const result = await db.query('SELECT * FROM schedules WHERE id = $1', [id]);
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/admin/schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM schedules WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Schedule not found' } });
    }

    res.json({ success: true, message: 'Schedule deleted successfully' });
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
        fa.text_value,
        quest.answer_scale_id,
        a.buttons as answer_scale_buttons,
        a.scale_mode,
        a.step as scale_step,
        a.min_label,
        a.max_label,
        a.min_value,
        a.max_value,
        quest.continuous_axes,
        quest.word_cloud_options_id,
        wco.words as word_cloud_words
      FROM feedback_sessions fs
      JOIN locations l ON fs.location_id = l.id
      JOIN questionnaires q ON fs.questionnaire_id = q.id
      JOIN feedback_answers fa ON fs.id = fa.session_id
      JOIN questions quest ON fa.question_id = quest.id
      LEFT JOIN answer_scales a ON quest.answer_scale_id = a.id
      LEFT JOIN word_cloud_options wco ON quest.word_cloud_options_id = wco.id
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
