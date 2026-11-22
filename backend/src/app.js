const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

// Behind a reverse proxy (e.g. nginx on the host), set TRUST_PROXY so req.ip is the client address
// and the rate limiters count clients instead of the proxy: a hop count ("1"), "true", or an
// address/subnet list, as Express's `trust proxy` setting accepts.
if (process.env.TRUST_PROXY) {
  const trustProxy = process.env.TRUST_PROXY.trim();
  app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy === 'true' ? true : trustProxy);
}

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/images', require('./routes/images'));
app.use('/api/images', require('./routes/imagePublic'));

function getSubpath() {
  if (process.env.DOMAIN_PATH && process.env.DOMAIN_PATH !== '/') {
    return process.env.DOMAIN_PATH.replace(/\/+$/, '');
  }
  if (process.env.BASE_URL) {
    try {
      const p = new URL(process.env.BASE_URL).pathname.replace(/\/+$/, '');
      if (p) return p;
    } catch {}
  }
  return '';
}

function injectSubpathIntoHtml(html, subpath) {
  if (!subpath) return html;
  const injection = `<base href="${subpath}/" />\n  <meta name="base-path" content="${subpath}" />\n  <script>window.__BASE_PATH__ = ${JSON.stringify(subpath)};</script>`;
  if (html.includes('<head>')) {
    return html.replace('<head>', `<head>\n  ${injection}`);
  }
  return html.replace(/<head([^>]*)>/i, `<head$1>\n  ${injection}`);
}

// Serve frontend static files (React build output)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath, { index: false }));

// SPA fallback: serve index.html for client-side routes (React Router) with injected base path
app.get(/^\/(?!api\/)/, (req, res) => {
  const indexPath = path.join(publicPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    const rawHtml = fs.readFileSync(indexPath, 'utf8');
    const subpath = getSubpath();
    const finalHtml = injectSubpathIntoHtml(rawHtml, subpath);
    return res.type('html').send(finalHtml);
  }
  res.sendFile(indexPath);
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
