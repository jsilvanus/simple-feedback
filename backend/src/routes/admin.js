const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { loginLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { authenticate, JWT_SECRET } = require('../middleware/auth');
const { generateCsrfToken, setCsrfCookie, verifyCsrf } = require('../middleware/csrf');

// Shared constants
const BCRYPT_ROUNDS = 10;
const VALID_MULTI_SCALE_LAYOUTS = ['stacked', 'matrix', 'compact'];

// Validates that a string is a parseable ISO 8601 date
const isValidDate = (str) => !isNaN(Date.parse(str));

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

      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('adminToken', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 86400 * 1000,
        path: '/',
      });

      const csrfToken = generateCsrfToken();
      setCsrfCookie(res, csrfToken);

      res.json({ success: true, expiresIn: 86400 });
    } else {
      res.status(401).json({ error: { message: 'Invalid credentials' } });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/logout
 * Clear the admin session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('adminToken', { path: '/' });
  res.clearCookie('csrfToken', { path: '/' });
  res.json({ success: true });
});

// All routes below require authentication, CSRF verification, and rate limiting
router.use(authenticate);
router.use(verifyCsrf);
if (process.env.NODE_ENV !== 'development') {
  router.use(apiLimiter);
}

/**
 * GET /api/admin/me
 * Return current authenticated user (used by frontend to validate cookie on page load)
 */
router.get('/me', (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

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
      qrEntryMode,
    } = req.body;

    if (!slug || !name) {
      return res.status(400).json({ error: { message: 'Slug and name are required' } });
    }

    if (passwordRequired && !password) {
      return res.status(400).json({ error: { message: 'Password is required when password protection is enabled' } });
    }

    const passwordHash = password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : null;

    const result = await db.query(
      `INSERT INTO locations
       (slug, name, active, group_id, password_hash, password_required, qr_entry_mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        slug,
        name,
        active !== undefined ? active : true,
        groupId || null,
        passwordHash,
        passwordRequired === true,
        qrEntryMode === true,
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
      qrEntryMode,
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
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(passwordHash);
    }
    if (qrEntryMode !== undefined) {
      updates.push(`qr_entry_mode = $${paramCount++}`);
      values.push(qrEntryMode);
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
 * Word set route aliases (word-sets -> word-cloud-options for backward compat)
 * GET /api/admin/word-sets
 * POST /api/admin/word-sets
 * PUT /api/admin/word-sets/:id
 */
router.get('/word-sets', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM word_cloud_options ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/word-sets', async (req, res, next) => {
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

router.put('/word-sets/:id', async (req, res, next) => {
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
      return res.status(404).json({ error: { message: 'Word set not found' } });
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
    const questions = result.rows;

    // Fetch scale items for all questions
    if (questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      const scaleItemsResult = await db.query(
        `SELECT qsi.*,
                a.name as scale_name, a.buttons, a.scale_mode, a.step,
                a.min_label, a.max_label, a.min_value, a.max_value
         FROM question_scale_items qsi
         JOIN answer_scales a ON qsi.answer_scale_id = a.id
         WHERE qsi.question_id = ANY($1)
         ORDER BY qsi.question_id, qsi.order_index`,
        [questionIds]
      );

      const scaleItemsByQuestion = {};
      scaleItemsResult.rows.forEach(item => {
        if (!scaleItemsByQuestion[item.question_id]) {
          scaleItemsByQuestion[item.question_id] = [];
        }
        scaleItemsByQuestion[item.question_id].push({
          id: item.id,
          answerScaleId: item.answer_scale_id,
          label: item.label,
          orderIndex: item.order_index,
          displayMode: item.display_mode,
          showEndLabels: item.show_end_labels,
          showValueLabels: item.show_value_labels,
          showItemLabel: item.show_item_label,
          minLabelOverride: item.min_label_override,
          maxLabelOverride: item.max_label_override,
          required: item.required,
          scale: {
            id: item.answer_scale_id,
            name: item.scale_name,
            buttons: item.buttons || [],
            scaleMode: item.scale_mode || 'normal',
            step: item.step !== null ? parseFloat(item.step) : 1,
            minLabel: item.min_label || null,
            maxLabel: item.max_label || null,
            minValue: item.min_value !== null && item.min_value !== undefined ? parseFloat(item.min_value) : null,
            maxValue: item.max_value !== null && item.max_value !== undefined ? parseFloat(item.max_value) : null,
          },
        });
      });

      questions.forEach(q => {
        q.scaleItems = scaleItemsByQuestion[q.id] || [];
      });
    }

    res.json(questions);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/questions
 * Create a new question
 */
router.post('/questions', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const {
      text, type, answerScaleId, wordCloudOptionsId, maxSelections, continuousAxes,
      scaleItems, multiScaleLayout, multiScaleDefaults,
    } = req.body;

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

    if (scaleItems !== undefined && !Array.isArray(scaleItems)) {
      return res.status(400).json({ error: { message: 'scaleItems must be an array' } });
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

    const layout = multiScaleLayout || 'stacked';
    const defaults = multiScaleDefaults || {};

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO questions (text, type, answer_scale_id, word_cloud_options_id, max_selections,
        continuous_axes, multi_scale_layout, multi_scale_defaults)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        text, type, scaleId, cloudId, normalizedMaxSelections,
        normalizedContinuousAxes ? JSON.stringify(normalizedContinuousAxes) : null,
        layout, JSON.stringify(defaults),
      ]
    );

    const question = result.rows[0];

    // Insert scale items if provided
    if (type === 'scale' && Array.isArray(scaleItems) && scaleItems.length > 0) {
      for (const item of scaleItems) {
        await client.query(
          `INSERT INTO question_scale_items
           (question_id, answer_scale_id, label, order_index, display_mode,
            show_end_labels, show_value_labels, show_item_label,
            min_label_override, max_label_override, required)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            question.id,
            item.answerScaleId,
            JSON.stringify(item.label || {}),
            item.orderIndex ?? 0,
            item.displayMode || null,
            item.showEndLabels !== undefined ? item.showEndLabels : true,
            item.showValueLabels !== undefined ? item.showValueLabels : true,
            item.showItemLabel !== undefined ? item.showItemLabel : true,
            item.minLabelOverride ? JSON.stringify(item.minLabelOverride) : null,
            item.maxLabelOverride ? JSON.stringify(item.maxLabelOverride) : null,
            item.required !== undefined ? item.required : true,
          ]
        );
      }
    }

    await client.query('COMMIT');

    question.scaleItems = [];
    res.status(201).json(question);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin/questions/:id
 * Update a question
 */
router.put('/questions/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const {
      text, type, answerScaleId, wordCloudOptionsId, maxSelections, continuousAxes,
      scaleItems, multiScaleLayout, multiScaleDefaults,
    } = req.body;

    const existingResult = await db.query('SELECT * FROM questions WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Question not found' } });
    }

    const existing = existingResult.rows[0];
    const finalType = type !== undefined ? type : existing.type;

    if (continuousAxes !== undefined && !Array.isArray(continuousAxes)) {
      return res.status(400).json({ error: { message: 'continuousAxes must be an array' } });
    }

    if (scaleItems !== undefined && !Array.isArray(scaleItems)) {
      return res.status(400).json({ error: { message: 'scaleItems must be an array' } });
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

    if (multiScaleLayout !== undefined) {
      const layout = multiScaleLayout || 'stacked';
      if (!VALID_MULTI_SCALE_LAYOUTS.includes(layout)) {
        return res.status(400).json({ error: { message: `multiScaleLayout must be one of: ${VALID_MULTI_SCALE_LAYOUTS.join(', ')}` } });
      }
      updates.push(`multi_scale_layout = $${paramCount++}`);
      values.push(layout);
    }

    if (multiScaleDefaults !== undefined) {
      updates.push(`multi_scale_defaults = $${paramCount++}`);
      values.push(JSON.stringify(multiScaleDefaults || {}));
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

    if (updates.length === 0 && scaleItems === undefined) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    await client.query('BEGIN');

    let question = existing;
    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);
      const query = `UPDATE questions SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      const result = await client.query(query, values);
      question = result.rows[0];
    }

    // Replace scale items if provided (upsert to preserve IDs for historical answers)
    if (finalType === 'scale' && scaleItems !== undefined) {
      const existingResult = await client.query(
        'SELECT id FROM question_scale_items WHERE question_id = $1',
        [id]
      );
      const existingIds = new Set(existingResult.rows.map(r => r.id));

      const incomingWithId   = scaleItems.filter(item => item.id && existingIds.has(item.id));
      const incomingNewItems = scaleItems.filter(item => !item.id || !existingIds.has(item.id));
      const incomingIds      = new Set(incomingWithId.map(item => item.id));
      const idsToDelete      = [...existingIds].filter(eid => !incomingIds.has(eid));

      // Delete only truly removed items
      if (idsToDelete.length > 0) {
        await client.query(
          'DELETE FROM question_scale_items WHERE id = ANY($1)',
          [idsToDelete]
        );
      }

      // Update items that already exist (preserve their IDs)
      for (const item of incomingWithId) {
        const updateResult = await client.query(
          `UPDATE question_scale_items SET
             answer_scale_id = $1, label = $2, order_index = $3, display_mode = $4,
             show_end_labels = $5, show_value_labels = $6, show_item_label = $7,
             min_label_override = $8, max_label_override = $9, required = $10
           WHERE id = $11 AND question_id = $12`,
          [
            item.answerScaleId,
            JSON.stringify(item.label || {}),
            item.orderIndex ?? 0,
            item.displayMode || null,
            item.showEndLabels !== undefined ? item.showEndLabels : true,
            item.showValueLabels !== undefined ? item.showValueLabels : true,
            item.showItemLabel !== undefined ? item.showItemLabel : true,
            item.minLabelOverride ? JSON.stringify(item.minLabelOverride) : null,
            item.maxLabelOverride ? JSON.stringify(item.maxLabelOverride) : null,
            item.required !== undefined ? item.required : true,
            item.id,
            id,
          ]
        );
        if (updateResult.rowCount === 0) {
          throw Object.assign(new Error(`Scale item ${item.id} not found for question ${id}`), { status: 404 });
        }
      }

      // Insert genuinely new items
      for (const item of incomingNewItems) {
        await client.query(
          `INSERT INTO question_scale_items
             (question_id, answer_scale_id, label, order_index, display_mode,
              show_end_labels, show_value_labels, show_item_label,
              min_label_override, max_label_override, required)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            id,
            item.answerScaleId,
            JSON.stringify(item.label || {}),
            item.orderIndex ?? 0,
            item.displayMode || null,
            item.showEndLabels !== undefined ? item.showEndLabels : true,
            item.showValueLabels !== undefined ? item.showValueLabels : true,
            item.showItemLabel !== undefined ? item.showItemLabel : true,
            item.minLabelOverride ? JSON.stringify(item.minLabelOverride) : null,
            item.maxLabelOverride ? JSON.stringify(item.maxLabelOverride) : null,
            item.required !== undefined ? item.required : true,
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.json(question);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
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
    // Single query fetching schedules with questionnaires and location targets via json_agg
    const schedulesResult = await db.query(
      `SELECT
         s.*,
         COALESCE(
           (SELECT json_agg(
                     json_build_object('id', q.id, 'name', q.name, 'display_order', sq.display_order)
                     ORDER BY sq.display_order
                   )
            FROM schedule_questionnaires sq
            JOIN questionnaires q ON sq.questionnaire_id = q.id
            WHERE sq.schedule_id = s.id),
           -- Legacy fallback: single questionnaire_id column
           CASE WHEN s.questionnaire_id IS NOT NULL THEN
             (SELECT json_agg(json_build_object('id', q.id, 'name', q.name, 'display_order', 0))
              FROM questionnaires q WHERE q.id = s.questionnaire_id)
           END,
           '[]'::json
         ) AS questionnaires,
         COALESCE(
           (SELECT json_agg(
                     json_build_object(
                       'location_id', sl.location_id,
                       'location_group_id', sl.location_group_id,
                       'location_name', l.name,
                       'location_slug', l.slug,
                       'location_group_name', lg.name
                     )
                   )
            FROM schedule_locations sl
            LEFT JOIN locations l ON sl.location_id = l.id
            LEFT JOIN location_groups lg ON sl.location_group_id = lg.id
            WHERE sl.schedule_id = s.id),
           '[]'::json
         ) AS "locationTargets"
       FROM schedules s
       ORDER BY s.start_time DESC`
    );

    const schedules = schedulesResult.rows.map(s => ({
      ...s,
      questionnaire_name: (s.questionnaires[0] || null)?.name || null,
    }));

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
      showOnlyOne,      // Boolean
      timezone,         // IANA timezone string, e.g. 'Europe/Helsinki' (default 'UTC')
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
       (schedule_type, start_time, end_time, weekday_pattern, show_only_one, timezone, location_id, location_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        type,
        type === 'date_based' ? startTime : null,
        type === 'date_based' ? endTime : null,
        type === 'recurring_weekday' ? JSON.stringify(weekdayPattern) : null,
        showOnlyOne || false,
        timezone || 'UTC',
        locationId,
        locationGroupId,
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
      showOnlyOne,
      timezone,
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
    if (timezone !== undefined) {
      updates.push(`timezone = $${paramCount++}`);
      values.push(timezone || 'UTC');
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
 * GET /api/admin/answer-views
 * List all answer views (optionally filtered by questionnaire)
 */
router.get('/answer-views', async (req, res, next) => {
  try {
    const { questionnaireId } = req.query;
    let query = `
      SELECT av.*, q.name as questionnaire_name
      FROM answer_views av
      JOIN questionnaires q ON av.questionnaire_id = q.id
      WHERE 1=1
    `;
    const params = [];
    if (questionnaireId) {
      params.push(questionnaireId);
      query += ` AND av.questionnaire_id = $${params.length}`;
    }
    query += ' ORDER BY av.created_at DESC';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/answer-views/:id
 * Get a single answer view with its questions
 */
router.get('/answer-views/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const viewResult = await db.query(
      `SELECT av.*, q.name as questionnaire_name
       FROM answer_views av
       JOIN questionnaires q ON av.questionnaire_id = q.id
       WHERE av.id = $1`,
      [id]
    );
    if (viewResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Answer view not found' } });
    }
    const questionsResult = await db.query(
      `SELECT avq.question_id, avq.axis_label, avq.display_order,
              quest.text as question_text, quest.type as question_type
       FROM answer_view_questions avq
       JOIN questions quest ON avq.question_id = quest.id
       WHERE avq.answer_view_id = $1
       ORDER BY avq.display_order, avq.question_id`,
      [id]
    );
    const view = viewResult.rows[0];
    view.questions = questionsResult.rows;
    res.json(view);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/answer-views
 * Create a new answer view
 */
router.post('/answer-views', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { name, viewType, questionnaireId, questions, config } = req.body;

    if (!name || !viewType || !questionnaireId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { message: 'name, viewType, and questionnaireId are required' } });
    }
    if (!['radar'].includes(viewType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { message: "viewType must be 'radar'" } });
    }

    const viewResult = await client.query(
      `INSERT INTO answer_views (name, view_type, questionnaire_id, config)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, viewType, questionnaireId, JSON.stringify(config || {})]
    );
    const view = viewResult.rows[0];

    if (Array.isArray(questions) && questions.length > 0) {
      for (const q of questions) {
        await client.query(
          `INSERT INTO answer_view_questions (answer_view_id, question_id, axis_label, display_order)
           VALUES ($1, $2, $3, $4)`,
          [view.id, q.questionId, q.axisLabel || null, q.displayOrder || 0]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(view);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * PUT /api/admin/answer-views/:id
 * Update an answer view and its questions
 */
router.put('/answer-views/:id', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { name, viewType, questionnaireId, questions, config } = req.body;

    const fields = [];
    const params = [];

    if (name !== undefined) { params.push(name); fields.push(`name = $${params.length}`); }
    if (viewType !== undefined) {
      if (!['radar'].includes(viewType)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: { message: "viewType must be 'radar'" } });
      }
      params.push(viewType); fields.push(`view_type = $${params.length}`);
    }
    if (questionnaireId !== undefined) { params.push(questionnaireId); fields.push(`questionnaire_id = $${params.length}`); }
    if (config !== undefined) { params.push(JSON.stringify(config)); fields.push(`config = $${params.length}`); }
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    if (fields.length > 1) {
      params.push(id);
      await client.query(
        `UPDATE answer_views SET ${fields.join(', ')} WHERE id = $${params.length}`,
        params
      );
    }

    if (Array.isArray(questions)) {
      await client.query('DELETE FROM answer_view_questions WHERE answer_view_id = $1', [id]);
      for (const q of questions) {
        await client.query(
          `INSERT INTO answer_view_questions (answer_view_id, question_id, axis_label, display_order)
           VALUES ($1, $2, $3, $4)`,
          [id, q.questionId, q.axisLabel || null, q.displayOrder || 0]
        );
      }
    }

    await client.query('COMMIT');

    const viewResult = await db.query(
      `SELECT av.*, q.name as questionnaire_name FROM answer_views av
       JOIN questionnaires q ON av.questionnaire_id = q.id WHERE av.id = $1`,
      [id]
    );
    if (viewResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Answer view not found' } });
    }
    res.json(viewResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/admin/answer-views/:id
 * Delete an answer view
 */
router.delete('/answer-views/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM answer_views WHERE id = $1', [id]);
    res.json({ success: true });
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
    const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 5000);
    const offset = parseInt(req.query.offset, 10) || 0;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({ error: { message: 'startDate is not a valid date' } });
    }
    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({ error: { message: 'endDate is not a valid date' } });
    }

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
        fa.scale_item_id,
        qsi.label as scale_item_label,
        qsi.order_index as scale_item_order,
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
      LEFT JOIN question_scale_items qsi ON fa.scale_item_id = qsi.id
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

    paramCount++;
    query += ` ORDER BY fs.timestamp DESC LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await db.query(query, params);

    // Compute answer view aggregates for the filtered questionnaire
    let answerViews = [];
    if (questionnaireId) {
      const viewsResult = await db.query(
        `SELECT av.id, av.name, av.view_type, av.config,
                avq.question_id, avq.axis_label, avq.display_order,
                quest.text as question_text
         FROM answer_views av
         JOIN answer_view_questions avq ON av.id = avq.answer_view_id
         JOIN questions quest ON avq.question_id = quest.id
         WHERE av.questionnaire_id = $1
         ORDER BY av.id, avq.display_order, avq.question_id`,
        [questionnaireId]
      );

      // Group by answer view
      const viewMap = {};
      viewsResult.rows.forEach(row => {
        if (!viewMap[row.id]) {
          viewMap[row.id] = {
            id: row.id,
            name: row.name,
            viewType: row.view_type,
            config: row.config,
            axes: [],
          };
        }
        viewMap[row.id].axes.push({
          questionId: row.question_id,
          axisLabel: row.axis_label || row.question_text,
          displayOrder: row.display_order,
        });
      });

      // Compute averages for all view axes in a single query grouped by question
      const allAxisQuestionIds = [...new Set(
        Object.values(viewMap).flatMap(v => v.axes.map(a => a.questionId))
      )];

      const avgByQuestion = {};
      if (allAxisQuestionIds.length > 0) {
        let avgQuery = `
          SELECT fa.question_id, AVG(fa.value::numeric) AS avg_value, COUNT(*) AS response_count
          FROM feedback_answers fa
          JOIN feedback_sessions fs ON fa.session_id = fs.id
          WHERE fa.question_id = ANY($1) AND fs.questionnaire_id = $2
        `;
        const avgParams = [allAxisQuestionIds, questionnaireId];
        let paramIdx = 2;
        if (locationId) { paramIdx++; avgQuery += ` AND fs.location_id = $${paramIdx}`; avgParams.push(locationId); }
        if (startDate)  { paramIdx++; avgQuery += ` AND fs.timestamp >= $${paramIdx}`; avgParams.push(startDate); }
        if (endDate)    { paramIdx++; avgQuery += ` AND fs.timestamp <= $${paramIdx}`; avgParams.push(endDate); }
        avgQuery += ' GROUP BY fa.question_id';

        const avgResult = await db.query(avgQuery, avgParams);
        avgResult.rows.forEach(r => {
          avgByQuestion[r.question_id] = {
            avg: parseFloat(r.avg_value),
            count: parseInt(r.response_count, 10),
          };
        });
      }

      for (const view of Object.values(viewMap)) {
        view.axes = view.axes.map(axis => ({
          ...axis,
          avg: avgByQuestion[axis.questionId]?.avg ?? null,
          count: avgByQuestion[axis.questionId]?.count ?? 0,
        }));
        answerViews.push(view);
      }
    }

    res.json({ rows: result.rows, answerViews, limit, offset });
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
    const limit = Math.min(parseInt(req.query.limit, 10) || 10000, 50000);
    const offset = parseInt(req.query.offset, 10) || 0;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({ error: { message: 'startDate is not a valid date' } });
    }
    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({ error: { message: 'endDate is not a valid date' } });
    }

    let query = `
      SELECT
        fs.id as session_id,
        fs.timestamp,
        l.name as location_name,
        q.name as questionnaire_name,
        quest.id as question_id,
        quest.text as question_text,
        fa.scale_item_id,
        qsi.label as scale_item_label,
        fa.value,
        fa.text_value
      FROM feedback_sessions fs
      JOIN locations l ON fs.location_id = l.id
      JOIN questionnaires q ON fs.questionnaire_id = q.id
      JOIN feedback_answers fa ON fs.id = fa.session_id
      JOIN questions quest ON fa.question_id = quest.id
      LEFT JOIN question_scale_items qsi ON fa.scale_item_id = qsi.id
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

    paramCount++;
    query += ` ORDER BY fs.timestamp DESC LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await db.query(query, params);

    // Convert to CSV
    const getScaleItemLabel = (label) => {
      if (!label) return '';
      if (typeof label === 'string') {
        try { label = JSON.parse(label); } catch { return label; }
      }
      return label.en || label.fi || label.sv || Object.values(label).find(v => v) || '';
    };

    const csv = [
      'Session ID,Timestamp,Location,Questionnaire,Question ID,Question,Scale Item ID,Scale Item Label,Value,Text Value',
      ...result.rows.map(row =>
        `${row.session_id},"${row.timestamp}","${row.location_name}","${row.questionnaire_name}",${row.question_id},"${row.question_text}",${row.scale_item_id || ''},"${getScaleItemLabel(row.scale_item_label)}",${row.value || ''},"${row.text_value || ''}"`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=feedback-export.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/webhooks
 * Get all webhooks (paginated)
 */
router.get('/webhooks', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = page * pageSize;

    const result = await db.query(
      `SELECT id, name, url, event_type, active, payload_mode, retry_count, timeout_seconds, created_at
       FROM webhooks
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM webhooks');
    const total = parseInt(countResult.rows[0].count);

    res.json({
      webhooks: result.rows,
      total,
      page,
      pageSize
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/webhooks/:id
 * Get a single webhook (mask secret)
 */
router.get('/webhooks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT id, name, url, event_type, active, secret, payload_mode, custom_headers,
              retry_count, timeout_seconds, created_at, updated_at
       FROM webhooks WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Webhook not found' } });
    }

    const webhook = result.rows[0];
    // Mask secret: show only last 4 chars
    webhook.secretMasked = webhook.secret ? `****${webhook.secret.slice(-4)}` : '';

    res.json(webhook);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/webhooks
 * Create a new webhook
 */
router.post('/webhooks', async (req, res, next) => {
  try {
    const {
      name, url, eventType, payloadMode, customHeaders, retryCount, timeoutSeconds
    } = req.body;

    if (!name || !url || !eventType) {
      return res.status(400).json({ error: { message: 'name, url, and eventType are required' } });
    }

    const validEventTypes = ['feedback.submitted', 'feedback.text_submitted', 'feedback.batch'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({ error: { message: 'Invalid eventType' } });
    }

    const validPayloadModes = ['minimal', 'standard', 'custom'];
    if (payloadMode && !validPayloadModes.includes(payloadMode)) {
      return res.status(400).json({ error: { message: 'Invalid payloadMode' } });
    }

    // Validate custom_headers is valid JSON
    if (customHeaders && typeof customHeaders !== 'object') {
      return res.status(400).json({ error: { message: 'customHeaders must be a JSON object' } });
    }

    // Generate random 64-byte hex secret
    const secret = require('crypto').randomBytes(32).toString('hex');

    const result = await db.query(
      `INSERT INTO webhooks (name, url, event_type, secret, payload_mode, custom_headers, retry_count, timeout_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, url, event_type, active, payload_mode, retry_count, timeout_seconds, secret, created_at`,
      [
        name, url, eventType, secret,
        payloadMode || 'minimal',
        customHeaders ? JSON.stringify(customHeaders) : null,
        retryCount || 3,
        timeoutSeconds || 10
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/admin/webhooks/:id
 * Update a webhook
 */
router.put('/webhooks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name, url, eventType, active, payloadMode, customHeaders, retryCount, timeoutSeconds
    } = req.body;

    const existing = await db.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Webhook not found' } });
    }

    const updates = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      params.push(name);
    }
    if (url !== undefined) {
      updates.push(`url = $${paramCount++}`);
      params.push(url);
    }
    if (eventType !== undefined) {
      const validEventTypes = ['feedback.submitted', 'feedback.text_submitted', 'feedback.batch'];
      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({ error: { message: 'Invalid eventType' } });
      }
      updates.push(`event_type = $${paramCount++}`);
      params.push(eventType);
    }
    if (active !== undefined) {
      updates.push(`active = $${paramCount++}`);
      params.push(active);
    }
    if (payloadMode !== undefined) {
      const validPayloadModes = ['minimal', 'standard', 'custom'];
      if (!validPayloadModes.includes(payloadMode)) {
        return res.status(400).json({ error: { message: 'Invalid payloadMode' } });
      }
      updates.push(`payload_mode = $${paramCount++}`);
      params.push(payloadMode);
    }
    if (customHeaders !== undefined) {
      if (typeof customHeaders !== 'object') {
        return res.status(400).json({ error: { message: 'customHeaders must be a JSON object' } });
      }
      updates.push(`custom_headers = $${paramCount++}`);
      params.push(customHeaders ? JSON.stringify(customHeaders) : null);
    }
    if (retryCount !== undefined) {
      updates.push(`retry_count = $${paramCount++}`);
      params.push(retryCount);
    }
    if (timeoutSeconds !== undefined) {
      updates.push(`timeout_seconds = $${paramCount++}`);
      params.push(timeoutSeconds);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'No fields to update' } });
    }

    updates.push(`updated_at = NOW()`);

    params.push(id);
    const query = `UPDATE webhooks SET ${updates.join(', ')} WHERE id = $${paramCount + 1} RETURNING *`;

    const result = await db.query(query, params);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/webhooks/:id
 * Delete a webhook
 */
router.delete('/webhooks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM webhooks WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Webhook not found' } });
    }

    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/webhooks/:id/test
 * Send a test webhook payload
 */
router.post('/webhooks/:id/test', async (req, res, next) => {
  try {
    const { id } = req.params;

    const webhook = await db.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    if (webhook.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Webhook not found' } });
    }

    const w = webhook.rows[0];
    const timestamp = new Date().toISOString();
    const eventId = `999999-${Date.now()}`;

    // Build payload based on mode
    let payload;
    if (w.payload_mode === 'minimal') {
      payload = {
        event_id: eventId,
        timestamp,
        type: w.event_type
      };
    } else {
      // standard mode
      payload = {
        event_id: eventId,
        timestamp,
        type: w.event_type,
        data: {
          sessionId: 999999,
          locationId: 1,
          locationName: 'Test Location',
          questionnaireId: 1,
          questionnaireName: 'Test Questionnaire',
          entryMethod: 'kiosk',
          answersCount: 1,
          answers: [{
            questionId: 1,
            questionText: 'How satisfied are you?',
            type: 'scale',
            value: 4.5
          }]
        }
      };
    }

    // Generate HMAC
    const crypto = require('crypto');
    const message = `${Date.now()}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac('sha256', w.secret)
      .update(message)
      .digest('hex');

    const headers = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Timestamp': Date.now().toString(),
      'X-Event-ID': `test-${Date.now()}`,
      ...(w.custom_headers || {})
    };

    try {
      const startTime = Date.now();
      const response = await fetch(w.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        timeout: w.timeout_seconds * 1000
      });
      const duration = Date.now() - startTime;
      const responseBody = await response.text();

      res.json({
        success: true,
        statusCode: response.status,
        responseBody,
        durationMs: duration
      });
    } catch (fetchError) {
      res.status(502).json({
        success: false,
        error: fetchError.message
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/webhooks/:id/regenerate-secret
 * Generate a new secret for a webhook
 */
router.post('/webhooks/:id/regenerate-secret', async (req, res, next) => {
  try {
    const { id } = req.params;

    const webhook = await db.query('SELECT * FROM webhooks WHERE id = $1', [id]);
    if (webhook.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Webhook not found' } });
    }

    // Generate new secret
    const secret = require('crypto').randomBytes(32).toString('hex');

    const result = await db.query(
      'UPDATE webhooks SET secret = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [secret, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/webhooks/:id/logs
 * Get delivery logs for a webhook (paginated)
 */
router.get('/webhooks/:id/logs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 0;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = page * pageSize;

    // Verify webhook exists
    const webhook = await db.query('SELECT id FROM webhooks WHERE id = $1', [id]);
    if (webhook.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Webhook not found' } });
    }

    const result = await db.query(
      `SELECT id, status_code, response_body, duration_ms, delivered_at
       FROM webhook_delivery_logs
       WHERE webhook_id = $1
       ORDER BY delivered_at DESC
       LIMIT $2 OFFSET $3`,
      [id, pageSize, offset]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM webhook_delivery_logs WHERE webhook_id = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      total,
      page,
      pageSize
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
