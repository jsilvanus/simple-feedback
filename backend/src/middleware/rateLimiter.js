const rateLimit = require('express-rate-limit');


// General rate limiter for API endpoints — 100 req / 15 min
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: { message: 'Too many requests. Please try again later.' },
  }),
});

// Strict rate limiter for login endpoint — 5 req / 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: { message: 'Too many login attempts. Please try again later.' },
  }),
});

// Rate limiter for feedback submissions — 10 req / min
const feedbackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    error: { message: 'Too many feedback submissions. Please slow down.' },
  }),
});

module.exports = {
  apiLimiter,
  loginLimiter,
  feedbackLimiter,
};
