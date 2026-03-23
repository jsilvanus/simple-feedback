const app = require('./app');

// Validate critical environment variables before starting
const isProduction = process.env.NODE_ENV === 'production';
const DEFAULT_ADMIN_USERNAMES = ['admin'];
const DEFAULT_ADMIN_PASSWORDS = ['admin123', 'password', 'changeme', ''];

const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminUsername || DEFAULT_ADMIN_USERNAMES.includes(adminUsername)) {
  const msg = '[SECURITY] ADMIN_USERNAME is missing or set to a default value. Set a strong ADMIN_USERNAME.';
  if (isProduction) { console.error(msg); process.exit(1); }
  else console.warn(msg);
}

if (!adminPassword || DEFAULT_ADMIN_PASSWORDS.includes(adminPassword)) {
  const msg = '[SECURITY] ADMIN_PASSWORD is missing or set to a known default. Set a strong ADMIN_PASSWORD.';
  if (isProduction) { console.error(msg); process.exit(1); }
  else console.warn(msg);
}

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});
