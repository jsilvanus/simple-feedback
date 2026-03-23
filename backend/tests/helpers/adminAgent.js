/**
 * Helper: create an authenticated supertest agent with CSRF cookie + header support.
 *
 * Usage:
 *   const { agent, csrfToken } = await createAdminAgent(app);
 *   await agent.post('/api/admin/foo').set('X-CSRF-Token', csrfToken).send({...});
 */
const request = require('supertest');

async function createAdminAgent(app) {
  const agent = request.agent(app);

  const loginRes = await agent.post('/api/admin/login').send({
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  });

  if (loginRes.status !== 200) {
    throw new Error(`Admin login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  // Extract CSRF token from Set-Cookie header
  let csrfToken = '';
  const setCookieHeaders = loginRes.headers['set-cookie'] || [];
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/^csrfToken=([^;]+)/);
    if (match) {
      csrfToken = decodeURIComponent(match[1]);
      break;
    }
  }

  return { agent, csrfToken };
}

module.exports = { createAdminAgent };
