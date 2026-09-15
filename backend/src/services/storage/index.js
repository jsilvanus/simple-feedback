'use strict';

const path = require('path');
const { createLocalAdapter } = require('./localAdapter');
const { createS3Adapter } = require('./s3Adapter');

const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase();

let adapter;

if (driver === 's3') {
  const required = ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`[STORAGE] STORAGE_DRIVER=s3 requires env vars: ${missing.join(', ')}`);
  }

  adapter = createS3Adapter({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET,
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  });
} else if (driver === 'local') {
  adapter = createLocalAdapter({
    baseDir: process.env.STORAGE_LOCAL_DIR || path.join(__dirname, '../../../uploads'),
  });
} else {
  throw new Error(`[STORAGE] Unknown STORAGE_DRIVER "${driver}". Use "local" or "s3".`);
}

let initPromise = null;
function ready() {
  if (!initPromise) {
    initPromise = adapter.init().catch((err) => {
      console.error(`[STORAGE] Failed to initialize "${driver}" storage driver:`, err.message);
      initPromise = null; // allow a retry on the next call instead of caching the failure forever
      throw err;
    });
  }
  return initPromise;
}

module.exports = adapter;
module.exports.ready = ready;
