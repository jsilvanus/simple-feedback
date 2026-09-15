const express = require('express');
const router = express.Router();
const db = require('../db');
const storage = require('../services/storage');
const { apiLimiter } = require('../middleware/rateLimiter');

/**
 * GET /api/images/:filename
 * Public proxy-read for stored images (local disk or S3/MinIO).
 * No auth: these are shown on the public feedback UI (question images).
 */
router.get('/:filename', apiLimiter, async (req, res, next) => {
  try {
    const { filename } = req.params;

    const result = await db.query(
      'SELECT storage_key, mime_type FROM images WHERE filename = $1',
      [filename]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }

    const { storage_key: storageKey, mime_type: mimeType } = result.rows[0];

    await storage.ready();
    const object = await storage.get(storageKey);

    res.set('Content-Type', object.contentType || mimeType);
    if (object.contentLength != null) {
      res.set('Content-Length', object.contentLength);
    }
    res.set('Cache-Control', 'public, max-age=31536000, immutable');

    object.stream.on('error', next);
    object.stream.pipe(res);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ error: { message: 'Image not found' } });
    }
    next(error);
  }
});

module.exports = router;
