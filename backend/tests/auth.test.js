const request = require('supertest');
const app = require('../src/app');
const { createAdminAgent } = require('./helpers/adminAgent');

// ─── Authentication middleware ───────────────────────────────────────────────

describe('Authentication — unauthenticated access', () => {
  test('GET /api/admin/locations rejects request with no token', async () => {
    const res = await request(app).get('/api/admin/locations');
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('message');
  });

  test('POST /api/admin/locations rejects request with no token', async () => {
    const res = await request(app)
      .post('/api/admin/locations')
      .send({ slug: 'x', name: 'X' });
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/me rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/admin/me');
    expect(res.status).toBe(401);
  });

  test('Invalid Bearer token is rejected', async () => {
    const res = await request(app)
      .get('/api/admin/locations')
      .set('Authorization', 'Bearer totally.invalid.token');
    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('message');
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

describe('POST /api/admin/login', () => {
  test('Valid credentials return success and set httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).not.toHaveProperty('token'); // token must NOT be in body

    const setCookies = res.headers['set-cookie'] || [];
    const adminTokenCookie = setCookies.find(c => c.startsWith('adminToken='));
    const csrfTokenCookie  = setCookies.find(c => c.startsWith('csrfToken='));

    expect(adminTokenCookie).toBeTruthy();
    expect(adminTokenCookie).toMatch(/HttpOnly/i);
    expect(csrfTokenCookie).toBeTruthy();
    // csrfToken must NOT be httpOnly (JS needs to read it)
    expect(csrfTokenCookie).not.toMatch(/HttpOnly/i);
  });

  test('Wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toHaveProperty('message');
  });

  test('Missing credentials returns 401', async () => {
    const res = await request(app)
      .post('/api/admin/login')
      .send({});
    expect(res.status).toBe(401);
  });
});

// ─── Cookie-based session ────────────────────────────────────────────────────

describe('Cookie-based authentication', () => {
  test('GET /api/admin/me succeeds with valid cookie session', async () => {
    const { agent } = await createAdminAgent(app);
    const res = await agent.get('/api/admin/me');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('username');
    expect(res.body).toHaveProperty('role', 'admin');
  });

  test('Authenticated GET requests succeed without CSRF header', async () => {
    // GET is a safe method — CSRF not required
    const { agent } = await createAdminAgent(app);
    const res = await agent.get('/api/admin/locations');
    expect(res.status).toBe(200);
  });

  test('Mutating requests are rejected without CSRF header', async () => {
    const { agent } = await createAdminAgent(app);
    const res = await agent
      .post('/api/admin/location-groups')
      .send({ name: 'No CSRF' });
    // CSRF middleware should reject this
    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/csrf/i);
  });

  test('Mutating requests succeed with correct CSRF header', async () => {
    const { agent, csrfToken } = await createAdminAgent(app);
    const res = await agent
      .post('/api/admin/location-groups')
      .set('X-CSRF-Token', csrfToken)
      .send({ name: `CSRF Test Group ${Date.now()}`, active: true });
    expect([200, 201]).toContain(res.status);

    // Cleanup
    if (res.body.id) {
      await agent
        .delete(`/api/admin/location-groups/${res.body.id}`)
        .set('X-CSRF-Token', csrfToken);
    }
  });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

describe('POST /api/admin/logout', () => {
  test('Clears the admin session cookie', async () => {
    const { agent, csrfToken } = await createAdminAgent(app);

    // Confirm authenticated before logout
    const meBefore = await agent.get('/api/admin/me');
    expect(meBefore.status).toBe(200);

    const logoutRes = await agent
      .post('/api/admin/logout')
      .set('X-CSRF-Token', csrfToken);
    expect(logoutRes.status).toBe(200);

    // Verify the cookie is cleared (Set-Cookie should set adminToken to empty/expired)
    const setCookies = logoutRes.headers['set-cookie'] || [];
    const cleared = setCookies.find(c => c.startsWith('adminToken='));
    expect(cleared).toBeTruthy();
    // A cleared cookie has Max-Age=0 or Expires in the past
    expect(cleared).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
