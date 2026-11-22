const app = require('./app');
const { processNotificationQueue } = require('./workers/notificationWorker');

// Validate critical environment variables before starting
const isProduction = process.env.NODE_ENV === 'production';
const authMode = process.env.AUTH_MODE || 'dev';

if (authMode === 'oidc') {
  try {
    const { getAuthConfig } = require('./config/auth');
    getAuthConfig();
    console.log('[AUTH] OIDC authentication mode active');
  } catch (err) {
    console.error(`[AUTH CONFIG ERROR] ${err.message}`);
    if (isProduction) process.exit(1);
  }
} else {
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
}

// Validate database configuration
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  const msg = '[CONFIG] No database configuration found. Set DATABASE_URL or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD.';
  if (isProduction) { console.error(msg); process.exit(1); }
  else console.warn(msg);
}

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Start notification worker
let notificationWorkerInterval;
notificationWorkerInterval = setInterval(processNotificationQueue, 30000);
console.log('Notification worker started (30s interval)');

// Graceful shutdown
const shutdown = () => {
  console.log('Shutdown signal received: stopping worker and closing HTTP server');
  if (notificationWorkerInterval) {
    clearInterval(notificationWorkerInterval);
    console.log('Notification worker stopped');
  }
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
