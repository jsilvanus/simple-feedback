const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

// Configure CORS: allow specific origins via CORS_ORIGIN env var (comma-separated),
// or fall back to permissive mode only in development.
const corsOrigin = process.env.CORS_ORIGIN;

if (!corsOrigin && process.env.NODE_ENV === 'production') {
  console.error('[SECURITY] CORS_ORIGIN is not set in production. All cross-origin requests will be blocked. Set CORS_ORIGIN to your frontend URL(s).');
}

const corsOptions = corsOrigin
  ? { origin: corsOrigin.split(',').map(o => o.trim()), credentials: true }
  : { origin: process.env.NODE_ENV === 'production' ? false : true, credentials: true };

// Middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/locations', require('./routes/locations'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/images', require('./routes/images'));

// Serve frontend static files (React build output)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// SPA fallback: serve index.html for client-side routes (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  // In production, hide internal error details from clients
  const message = (status < 500 || process.env.NODE_ENV !== 'production')
    ? (err.message || 'Internal server error')
    : 'Internal server error';
  res.status(status).json({ error: { message, status } });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
});

module.exports = app;
