const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All routes require authentication
router.use(authenticate);
router.use(apiLimiter);

// Configure multer for image uploads
const uploadsDir = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
})();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'image-' + uniqueSuffix + path.extname(file.originalname));
  }
});

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
  storage,
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
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No image file provided' } });
    }

    const { filename, originalname, mimetype, size } = req.file;
    const url = `/uploads/${filename}`;

    const result = await db.query(
      'INSERT INTO images (filename, original_name, mime_type, size, url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [filename, originalname, mimetype, size, url]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    // Clean up uploaded file if database insert fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
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

    // Delete file from filesystem
    const filePath = path.join(uploadsDir, image.filename);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error('Error deleting file:', err);
      // Continue even if file deletion fails
    }

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
