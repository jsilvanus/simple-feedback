const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const storage = require('../services/storage');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authenticate);
router.use(apiLimiter);

const fileFilter = (req, file, cb) => {
  // Accept images only
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Error handler for multer errors
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: { message: 'File size exceeds 5MB limit' }
      });
    }
    return res.status(400).json({
      error: { message: `Upload error: ${err.message}` }
    });
  }
  if (err) {
    return res.status(400).json({
      error: { message: err.message }
    });
  }
  next();
};

/**
 * GET /api/admin/images
 * Get all images
 */
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM images ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/images
 * Upload a new image
 */
router.post('/', upload.single('image'), handleUploadError, async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: { message: 'No image file provided' } });
  }

  const { originalname, mimetype, size, buffer } = req.file;
  const key = 'image-' + Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(originalname);

  try {
    await storage.ready();
    await storage.put(key, buffer, mimetype);
  } catch (error) {
    return next(error);
  }

  try {
    const url = `/api/images/${key}`;
    const result = await db.query(
      'INSERT INTO images (filename, original_name, mime_type, size, url, storage_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [key, originalname, mimetype, size, url, key]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Clean up uploaded object if database insert fails
    try {
      await storage.delete(key);
    } catch (deleteError) {
      console.error('Error deleting stored object after failed insert:', deleteError);
    }
    next(error);
  }
});

/**
 * DELETE /api/admin/images/:id
 * Delete an image
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get image info first
    const imageResult = await db.query(
      'SELECT * FROM images WHERE id = $1',
      [id]
    );

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }

    const image = imageResult.rows[0];

    // Delete from database
    await db.query('DELETE FROM images WHERE id = $1', [id]);

    // Delete stored object
    try {
      await storage.delete(image.storage_key);
    } catch (err) {
      console.error('Error deleting stored object:', err);
      // Continue even if object deletion fails
    }

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
