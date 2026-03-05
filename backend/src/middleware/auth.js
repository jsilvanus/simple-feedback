const jwt = require('jsonwebtoken');

const WEAK_SECRETS = [
  'your-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'secret',
  'changeme',
];

if (!process.env.JWT_SECRET) {
  console.warn('[SECURITY] JWT_SECRET environment variable is not set. Using insecure default. Set JWT_SECRET in production!');
} else if (process.env.JWT_SECRET.length < 32) {
  console.warn('[SECURITY] JWT_SECRET is too short. Use at least 32 characters in production!');
} else if (WEAK_SECRETS.includes(process.env.JWT_SECRET)) {
  console.warn('[SECURITY] JWT_SECRET is a known weak/default value. Change it in production!');
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};

module.exports = { authenticate, JWT_SECRET };
