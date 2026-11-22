const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
let jose;
const { loadAuthConfig } = require('../src/config/auth');
const {
  mapGroupsToRole,
  signToken,
  verifyToken,
  requireRole,
  authenticate,
  SESSION_COOKIE,
  OIDC_STATE_COOKIE,
  recordRevocation,
} = require('../src/middleware/auth');
const { createAuthRouter } = require('../src/routes/auth');
const db = require('../src/db');
const app = require('../src/app');

describe('OIDC Configuration and Role Mapping', () => {
  test('loadAuthConfig loads default dev configuration', () => {
    const config = loadAuthConfig({
      NODE_ENV: 'development',
      AUTH_MODE: 'dev',
    });

    expect(config.authMode).toBe('dev');
    expect(config.oidcScopes).toBe('openid profile email groups');
    expect(config.oidcGroupRoleMap).toHaveProperty('admin', 'admin');
    expect(config.oidcGroupRoleMap).toHaveProperty('/admin', 'admin');
    expect(config.allowLocalAdmin).toBe(true);
  });

  test('loadAuthConfig parses custom OIDC_GROUP_ROLE_MAP JSON', () => {
    const customMap = {
      'custom-lead': 'admin',
      '/custom-lead': 'admin',
      'custom-editor': 'manager',
    };

    const config = loadAuthConfig({
      NODE_ENV: 'development',
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: 'https://id.example.com',
      OIDC_CLIENT_ID: 'feedback-client',
      OIDC_GROUP_ROLE_MAP: JSON.stringify(customMap),
    });

    expect(config.authMode).toBe('oidc');
    expect(config.oidcGroupRoleMap).toEqual(customMap);
  });

  test('loadAuthConfig throws on invalid OIDC_GROUP_ROLE_MAP JSON', () => {
    expect(() => {
      loadAuthConfig({
        OIDC_GROUP_ROLE_MAP: 'not-valid-json',
      });
    }).toThrow(/OIDC_GROUP_ROLE_MAP must be valid JSON/);
  });

  test('loadAuthConfig validates production requirements', () => {
    expect(() => {
      loadAuthConfig({
        NODE_ENV: 'production',
        AUTH_MODE: 'oidc',
        OIDC_ISSUER: '',
        OIDC_CLIENT_ID: 'test',
        SESSION_SECRET: 'a'.repeat(40),
      });
    }).toThrow(/OIDC_ISSUER is required/);

    expect(() => {
      loadAuthConfig({
        NODE_ENV: 'production',
        AUTH_MODE: 'oidc',
        OIDC_ISSUER: 'https://id.example.com',
        OIDC_CLIENT_ID: '',
        SESSION_SECRET: 'a'.repeat(40),
      });
    }).toThrow(/OIDC_CLIENT_ID is required/);

    expect(() => {
      loadAuthConfig({
        NODE_ENV: 'production',
        AUTH_MODE: 'oidc',
        OIDC_ISSUER: 'https://id.example.com',
        OIDC_CLIENT_ID: 'test',
        SESSION_SECRET: 'secret',
      });
    }).toThrow(/SESSION_SECRET \/ JWT_SECRET must be set to a strong secret/);
  });

  test('mapGroupsToRole correctly maps groups and picks highest rank', () => {
    const map = {
      'viewer-group': 'viewer',
      '/manager-group': 'manager',
      '/admin-group': 'admin',
    };

    // Single match
    expect(mapGroupsToRole(['viewer-group'], map)).toBe('viewer');
    // Normalizes leading slash
    expect(mapGroupsToRole(['manager-group'], map)).toBe('manager');
    // Highest rank among multiple groups
    expect(mapGroupsToRole(['viewer-group', '/manager-group', '/admin-group'], map)).toBe('admin');
    expect(mapGroupsToRole(['/viewer-group', 'manager-group'], map)).toBe('manager');
    // No matching group
    expect(mapGroupsToRole(['unknown-group', 'other-group'], map)).toBeNull();
    // Invalid/empty inputs
    expect(mapGroupsToRole([], map)).toBeNull();
    expect(mapGroupsToRole(null, map)).toBeNull();
  });
});

describe('Token Signing, Verification, and Role Middleware', () => {
  const secret = 'test-secret-key-for-unit-tests-12345';

  test('signToken and verifyToken work with valid signatures', () => {
    const token = signToken({ sub: 'u1', name: 'User 1', role: 'admin' }, secret);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token, secret);
    expect(decoded).toBeTruthy();
    expect(decoded.sub).toBe('u1');
    expect(decoded.role).toBe('admin');
  });

  test('verifyToken returns null for tampered or invalid tokens', () => {
    const token = signToken({ sub: 'u1', role: 'admin' }, secret);
    expect(verifyToken(`${token}tampered`, secret)).toBeNull();
    expect(verifyToken('totally.invalid.token', secret)).toBeNull();
    expect(verifyToken(null, secret)).toBeNull();
  });

  test('requireRole enforces role hierarchy', async () => {
    const testApp = express();
    testApp.use(express.json());

    // Inject mock user
    testApp.use((req, res, next) => {
      const authHeader = req.headers['x-test-role'];
      if (authHeader) {
        req.user = { sub: 'u-role', role: authHeader };
      }
      next();
    });

    testApp.get('/admin-endpoint', requireRole('admin'), (req, res) => res.json({ ok: true }));
    testApp.get('/manager-endpoint', requireRole('manager'), (req, res) => res.json({ ok: true }));

    // Unauthenticated
    const unauth = await request(testApp).get('/admin-endpoint');
    expect(unauth.status).toBe(401);

    // Viewer accessing manager endpoint -> 403
    const viewerForbidden = await request(testApp)
      .get('/manager-endpoint')
      .set('x-test-role', 'viewer');
    expect(viewerForbidden.status).toBe(403);

    // Manager accessing manager endpoint -> 200
    const managerOk = await request(testApp)
      .get('/manager-endpoint')
      .set('x-test-role', 'manager');
    expect(managerOk.status).toBe(200);

    // Manager accessing admin endpoint -> 403
    const managerAdminForbidden = await request(testApp)
      .get('/admin-endpoint')
      .set('x-test-role', 'manager');
    expect(managerAdminForbidden.status).toBe(403);

    // Admin accessing admin endpoint -> 200
    const adminOk = await request(testApp)
      .get('/admin-endpoint')
      .set('x-test-role', 'admin');
    expect(adminOk.status).toBe(200);
  });
});

describe('OIDC Auth Endpoints Flow', () => {
  const sessionSecret = 'test-session-secret-key-for-flow-tests';
  const config = loadAuthConfig({
    NODE_ENV: 'development',
    AUTH_MODE: 'oidc',
    BASE_URL: 'http://localhost:3000',
    SESSION_SECRET: sessionSecret,
    OIDC_ISSUER: 'https://tunnus.example.com',
    OIDC_CLIENT_ID: 'simple-feedback',
    OIDC_CLIENT_SECRET: 'feedback-secret',
    OIDC_GROUP_ROLE_MAP: JSON.stringify({
      '/feedback-admins': 'admin',
      '/feedback-managers': 'manager',
    }),
  });

  // Mock discoverOidc implementation returning a proper openid-client Configuration
  const mockDiscoverOidc = async (issuer, clientId, clientSecret) => {
    const oidc = await import('openid-client');
    return new oidc.Configuration(
      {
        issuer: 'https://tunnus.example.com',
        authorization_endpoint: 'https://tunnus.example.com/auth',
        token_endpoint: 'https://tunnus.example.com/token',
        end_session_endpoint: 'https://tunnus.example.com/session/end',
      },
      clientId || 'simple-feedback',
      clientSecret || 'feedback-secret'
    );
  };

  test('GET /api/auth/config returns OIDC status and button label', async () => {
    const testApp = express();
    testApp.use('/api/auth', createAuthRouter({ db, config, discoverOidc: mockDiscoverOidc }));

    const res = await request(testApp).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      authMode: 'oidc',
      oidc: {
        enabled: true,
        buttonLabel: 'Kirjaudu Tunnuksella',
      },
      local: {
        enabled: false,
      },
    });
  });

  test('GET /api/auth/login initiates PKCE Authorization Code flow', async () => {
    const testApp = express();
    testApp.use('/api/auth', createAuthRouter({ db, config, discoverOidc: mockDiscoverOidc }));

    const res = await request(testApp).get('/api/auth/login?returnTo=/admin/locations');
    expect(res.status).toBe(302);

    const redirectUrl = new URL(res.headers.location);
    expect(redirectUrl.origin).toBe('https://tunnus.example.com');
    expect(redirectUrl.pathname).toBe('/auth');
    expect(redirectUrl.searchParams.get('client_id')).toBe('simple-feedback');
    expect(redirectUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(redirectUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(redirectUrl.searchParams.get('state')).toBeTruthy();
    expect(redirectUrl.searchParams.get('nonce')).toBeTruthy();

    // Check OIDC state cookie was set
    const setCookies = res.headers['set-cookie'] || [];
    const stateCookie = setCookies.find((c) => c.startsWith(`${OIDC_STATE_COOKIE}=`));
    expect(stateCookie).toBeTruthy();
    expect(stateCookie).toMatch(/HttpOnly/i);

    // Verify state token contents
    const match = stateCookie.match(new RegExp(`^${OIDC_STATE_COOKIE}=([^;]+)`));
    const token = decodeURIComponent(match[1]);
    const payload = verifyToken(token, sessionSecret);
    expect(payload).toBeTruthy();
    expect(payload.returnTo).toBe('/admin/locations');
    expect(payload.state).toBe(redirectUrl.searchParams.get('state'));
    expect(payload.codeVerifier).toBeTruthy();
  });

  test('GET /api/auth/callback handles code exchange, role mapping, and cookie creation', async () => {
    let mockGrantResult = {
      claims: () => ({
        sub: 'oidc-user-123',
        name: 'Matti Meikäläinen',
        email: 'matti@example.com',
        groups: ['/feedback-admins', '/other-group'],
      }),
    };

    const mockCodeGrant = jest.fn().mockImplementation(async () => mockGrantResult);

    const testApp = express();
    testApp.use('/api/auth', createAuthRouter({
      db,
      config,
      discoverOidc: mockDiscoverOidc,
      codeGrant: mockCodeGrant,
    }));

    // 1. Missing state cookie -> 400
    const missingRes = await request(testApp).get('/api/auth/callback?code=abc&state=xyz');
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error.message).toMatch(/Missing or expired/);

    // 2. Prepare valid state cookie
    const state = 'test-state-abc-123';
    const codeVerifier = 'test-verifier-xyz-456';
    const nonce = 'test-nonce-789';
    const stateCookieValue = signToken(
      { state, codeVerifier, nonce, returnTo: '/admin/questions' },
      sessionSecret
    );

    const callbackRes = await request(testApp)
      .get(`/api/auth/callback?code=auth-code-123&state=${state}`)
      .set('Cookie', `${OIDC_STATE_COOKIE}=${stateCookieValue}`);

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.location).toBe('/admin/questions');

    // Check session cookies set
    const setCookies = callbackRes.headers['set-cookie'] || [];
    const sessionCookie = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    const csrfCookie = setCookies.find((c) => c.startsWith('csrfToken='));

    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).toMatch(/HttpOnly/i);
    expect(csrfCookie).toBeTruthy();
    expect(csrfCookie).not.toMatch(/HttpOnly/i);

    // Verify session token
    const match = sessionCookie.match(new RegExp(`^${SESSION_COOKIE}=([^;]+)`));
    const sessionToken = decodeURIComponent(match[1]);
    const sessionPayload = verifyToken(sessionToken, sessionSecret);
    expect(sessionPayload.sub).toBe('oidc-user-123');
    expect(sessionPayload.name).toBe('Matti Meikäläinen');
    expect(sessionPayload.email).toBe('matti@example.com');
    expect(sessionPayload.role).toBe('admin');
    expect(sessionPayload.groups).toEqual(['/feedback-admins', '/other-group']);

    // 3. User with no matching role -> 403
    mockGrantResult = {
      claims: () => ({
        sub: 'unauthorized-user',
        name: 'No Role User',
        groups: ['/unrelated-group'],
      }),
    };

    const noRoleRes = await request(testApp)
      .get(`/api/auth/callback?code=auth-code-123&state=${state}`)
      .set('Cookie', `${OIDC_STATE_COOKIE}=${stateCookieValue}`);

    expect(noRoleRes.status).toBe(403);
    expect(noRoleRes.body.error.message).toMatch(/No matching role/);
  });

  test('GET /api/admin/me returns authenticated OIDC user info and role', async () => {
    // Generate valid session token signed with JWT_SECRET from auth middleware
    const { JWT_SECRET } = require('../src/middleware/auth');
    const token = jwt.sign(
      {
        sub: 'tunnus-user-456',
        username: 'Liisa Lahtinen',
        name: 'Liisa Lahtinen',
        email: 'liisa@example.com',
        role: 'manager',
        groups: ['/feedback-managers'],
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${SESSION_COOKIE}=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      username: 'Liisa Lahtinen',
      name: 'Liisa Lahtinen',
      email: 'liisa@example.com',
      sub: 'tunnus-user-456',
      role: 'manager',
      groups: ['/feedback-managers'],
    });
  });

  test('Logout clears session cookies and redirects / returns success', async () => {
    const testApp = express();
    testApp.use('/api/auth', createAuthRouter({ db, config, discoverOidc: mockDiscoverOidc }));

    // POST /api/auth/logout
    const postRes = await request(testApp).post('/api/auth/logout');
    expect(postRes.status).toBe(200);
    expect(postRes.body).toHaveProperty('success', true);

    const setCookies = postRes.headers['set-cookie'] || [];
    const clearedSession = setCookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(clearedSession).toBeTruthy();
    expect(clearedSession).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);

    // GET /api/auth/logout with OIDC issuer redirects to end session URL
    const getRes = await request(testApp).get('/api/auth/logout');
    expect(getRes.status).toBe(302);
    expect(getRes.headers.location).toContain('https://tunnus.example.com/session/end');
  });
});

describe('OIDC Backchannel Logout', () => {
  let keySet;
  let privateKey;
  const issuer = 'https://tunnus.example.com';
  const clientId = 'simple-feedback';

  beforeAll(async () => {
    jose = await import('jose');
    const keyPair = await jose.generateKeyPair('RS256');
    privateKey = keyPair.privateKey;
    const jwk = await jose.exportJWK(keyPair.publicKey);
    jwk.kid = 'test-tunnus-key-1';
    jwk.use = 'sig';
    keySet = jose.createLocalJWKSet({ keys: [jwk] });
  });

  test('Backchannel logout rejects missing or invalid tokens', async () => {
    const testApp = express();
    const config = loadAuthConfig({
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: issuer,
      OIDC_CLIENT_ID: clientId,
    });
    testApp.use('/api/auth', createAuthRouter({ db, config, keySet }));

    // 1. Missing token -> 400
    const missingRes = await request(testApp)
      .post('/api/auth/backchannel')
      .type('form')
      .send({});
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error).toBe('invalid_request');

    // 2. Token with nonce -> 400
    const nonceToken = await new jose.SignJWT({
      sub: 'revoked-user-1',
      nonce: 'invalid-nonce-in-backchannel',
      events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-tunnus-key-1' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    const nonceRes = await request(testApp)
      .post('/api/auth/backchannel')
      .type('form')
      .send({ logout_token: nonceToken });
    expect(nonceRes.status).toBe(400);
    expect(nonceRes.body.message).toContain('nonce');

    // 3. Token missing events -> 400
    const noEventsToken = await new jose.SignJWT({
      sub: 'revoked-user-1',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-tunnus-key-1' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    const noEventsRes = await request(testApp)
      .post('/api/auth/backchannel')
      .type('form')
      .send({ logout_token: noEventsToken });
    expect(noEventsRes.status).toBe(400);
    expect(noEventsRes.body.message).toContain('events');
  });

  test('Valid backchannel logout records revocation and invalidates active session', async () => {
    const testApp = express();
    const config = loadAuthConfig({
      AUTH_MODE: 'oidc',
      OIDC_ISSUER: issuer,
      OIDC_CLIENT_ID: clientId,
    });
    testApp.use('/api/auth', createAuthRouter({ db, config, keySet }));

    const targetSub = `backchannel-revoked-${Date.now()}`;

    // Create session token for target user issued 10 seconds ago
    const { JWT_SECRET } = require('../src/middleware/auth');
    const issuedAt = Math.floor(Date.now() / 1000) - 10;
    const sessionToken = jwt.sign(
      {
        sub: targetSub,
        username: 'Revoked User',
        role: 'admin',
        iat: issuedAt,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Verify user can authenticate before revocation
    const beforeRes = await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${SESSION_COOKIE}=${sessionToken}`);
    expect(beforeRes.status).toBe(200);

    // Send valid backchannel logout token
    const logoutToken = await new jose.SignJWT({
      sub: targetSub,
      events: {
        'http://schemas.openid.net/event/backchannel-logout': {},
      },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-tunnus-key-1' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    const logoutRes = await request(testApp)
      .post('/api/auth/backchannel')
      .type('form')
      .send({ logout_token: logoutToken });

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body).toEqual({ ok: true });

    // Verify revocation was recorded in DB
    const revRow = await db.query('SELECT sub FROM user_revocations WHERE sub = $1', [targetSub]);
    expect(revRow.rows).toHaveLength(1);

    // Verify subsequent authenticated requests with this session are rejected (401)
    const afterRes = await request(app)
      .get('/api/admin/me')
      .set('Cookie', `${SESSION_COOKIE}=${sessionToken}`);
    expect(afterRes.status).toBe(401);
    expect(afterRes.body.error.message).toMatch(/Session has been revoked/i);
  });

  afterAll(async () => {
    await db.pool.end();
  });
});
