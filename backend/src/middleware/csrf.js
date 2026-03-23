const crypto = require('crypto');

const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a cryptographically random CSRF token.
 */
const generateCsrfToken = () => crypto.randomBytes(32).toString('hex');

/**
 * Set the CSRF cookie on the response.
 * Not httpOnly — must be readable by JavaScript so the frontend can echo it back.
 */
const setCsrfCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 86400 * 1000,
    path: '/',
  });
};

/**
 * Middleware: reject state-changing requests that do not present a CSRF token
 * matching the csrfToken cookie (double-submit cookie pattern).
 */
const verifyCsrf = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)csrfToken=([^;]+)/);
  const cookieToken = match ? decodeURIComponent(match[1]) : null;
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: { message: 'CSRF token mismatch' } });
  }

  next();
};

module.exports = { generateCsrfToken, setCsrfCookie, verifyCsrf };
