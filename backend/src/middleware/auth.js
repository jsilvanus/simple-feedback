const jwt = require('jsonwebtoken');

const WEAK_SECRETS = [
  'your-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'secret',
  'changeme',
];

const isProduction = process.env.NODE_ENV === 'production';

let jwtSecretError = null;
if (!process.env.JWT_SECRET) {
  jwtSecretError = '[SECURITY] JWT_SECRET environment variable is not set. Set a strong JWT_SECRET.';
} else if (process.env.JWT_SECRET.length < 32) {
  jwtSecretError = '[SECURITY] JWT_SECRET is too short. Use at least 32 characters.';
} else if (WEAK_SECRETS.includes(process.env.JWT_SECRET)) {
  jwtSecretError = '[SECURITY] JWT_SECRET is a known weak/default value. Change it before deploying.';
}

if (jwtSecretError) {
  if (isProduction) {
    console.error(jwtSecretError);
    process.exit(1);
  } else {
    console.warn(jwtSecretError);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
// Accepts: Authorization: Bearer <token> header (API clients) or adminToken httpOnly cookie (browser)
const authenticate = (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    // Parse adminToken from cookie header without an extra dependency
    const match = req.headers.cookie.match(/(?:^|;\s*)adminToken=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : null;
  }

  if (!token) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};

module.exports = { authenticate, JWT_SECRET };
