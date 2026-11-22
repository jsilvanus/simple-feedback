const jwt = require('jsonwebtoken');
const db = require('../db');

const SESSION_COOKIE = 'adminToken';
const OIDC_STATE_COOKIE = 'sf_oidc_state';

const ROLE_RANK = {
  viewer: 1,
  manager: 2,
  admin: 3,
};

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

/**
 * Normalize group name by removing leading slashes and trimming whitespace.
 * @param {string} g
 * @returns {string}
 */
function normalizeGroup(g) {
  return String(g || '').replace(/^\/+/, '').trim();
}

/**
 * Map OIDC groups array to highest matching role.
 * @param {string[]} groups
 * @param {Record<string, string | { role: string }>} groupRoleMap
 * @returns {string | null}
 */
function mapGroupsToRole(groups, groupRoleMap) {
  if (!Array.isArray(groups) || !groupRoleMap || typeof groupRoleMap !== 'object') {
    return null;
  }

  const normalizedMap = {};
  for (const [k, v] of Object.entries(groupRoleMap)) {
    const key = normalizeGroup(k);
    if (typeof v === 'string') {
      normalizedMap[key] = v.toLowerCase();
    } else if (v && typeof v === 'object' && typeof v.role === 'string') {
      normalizedMap[key] = v.role.toLowerCase();
    }
  }

  let bestRole = null;
  let bestRank = 0;

  for (const g of groups) {
    const key = normalizeGroup(g);
    const role = normalizedMap[key];
    if (role && ROLE_RANK[role]) {
      if (ROLE_RANK[role] > bestRank) {
        bestRole = role;
        bestRank = ROLE_RANK[role];
      }
    }
  }

  return bestRole;
}

/**
 * Check if an OIDC user subject has been revoked.
 * @param {string} sub
 * @param {number} [iat]
 * @param {any} [dbClient]
 * @returns {Promise<boolean>}
 */
async function isUserRevoked(sub, iat, dbClient = db) {
  if (!sub) return false;
  try {
    const res = await dbClient.query(
      'SELECT EXTRACT(EPOCH FROM revoked_at) AS revoked_epoch FROM user_revocations WHERE sub = $1',
      [sub]
    );
    if (!res || !res.rows || res.rows.length === 0) return false;
    const revokedEpoch = Math.floor(Number(res.rows[0].revoked_epoch));
    const tokenIssuedTime = iat ? Number(iat) : 0;
    return revokedEpoch >= tokenIssuedTime;
  } catch {
    // If table doesn't exist or DB temporarily unavailable, don't block
    return false;
  }
}

/**
 * Record a user revocation in the database.
 * @param {string} sub
 * @param {any} [dbClient]
 * @returns {Promise<void>}
 */
async function recordRevocation(sub, dbClient = db) {
  if (!sub) return;
  await dbClient.query(
    `INSERT INTO user_revocations (sub, revoked_at)
     VALUES ($1, CURRENT_TIMESTAMP)
     ON CONFLICT (sub) DO UPDATE SET revoked_at = CURRENT_TIMESTAMP`,
    [sub]
  );
}

/**
 * Sign a JWT payload.
 * @param {Record<string, unknown>} payload
 * @param {string} [secret]
 * @param {object} [options]
 * @returns {string}
 */
function signToken(payload, secret = JWT_SECRET, options = {}) {
  const opts = { expiresIn: '8h', ...options };
  return jwt.sign(payload, secret, opts);
}

/**
 * Verify a JWT token.
 * @param {string} token
 * @param {string} [secret]
 * @returns {Record<string, unknown> | null}
 */
function verifyToken(token, secret = JWT_SECRET) {
  if (!token || typeof token !== 'string') return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/**
 * Require a minimum role rank.
 * @param {'viewer' | 'manager' | 'admin'} minRole
 * @returns {import('express').RequestHandler}
 */
function requireRole(minRole) {
  const minRank = ROLE_RANK[minRole] || 1;
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    const userRole = req.user.role;
    const userRank = ROLE_RANK[userRole] || 0;
    if (userRank < minRank) {
      return res.status(403).json({ error: { message: 'Insufficient permissions' } });
    }
    next();
  };
}

// Middleware to verify JWT token
// Accepts: Authorization: Bearer <token> header (API clients) or adminToken httpOnly cookie (browser)
const authenticate = async (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)(?:adminToken|sf_session)=([^;]+)/);
    token = match ? decodeURIComponent(match[1]) : null;
  }

  if (!token) {
    return res.status(401).json({ error: { message: 'No token provided' } });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded && decoded.sub) {
      const revoked = await isUserRevoked(decoded.sub, decoded.iat);
      if (revoked) {
        return res.status(401).json({ error: { message: 'Session has been revoked' } });
      }
    }
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: { message: 'Invalid token' } });
  }
};

module.exports = {
  authenticate,
  requireRole,
  signToken,
  verifyToken,
  mapGroupsToRole,
  normalizeGroup,
  isUserRevoked,
  recordRevocation,
  JWT_SECRET,
  SESSION_COOKIE,
  OIDC_STATE_COOKIE,
  ROLE_RANK,
};
