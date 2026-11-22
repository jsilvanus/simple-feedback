'use strict';

const express = require('express');
const { getAuthConfig } = require('../config/auth');
const defaultDb = require('../db');
const {
  signToken,
  verifyToken,
  mapGroupsToRole,
  recordRevocation,
  SESSION_COOKIE,
  OIDC_STATE_COOKIE,
} = require('../middleware/auth');
const { generateCsrfToken, setCsrfCookie } = require('../middleware/csrf');

/**
 * Validate that returnTo is a safe local relative path, prefixing with subpath if needed.
 * @param {any} val
 * @param {string} [subpath]
 * @returns {string}
 */
function safeReturnTo(val, subpath = '') {
  const defaultPath = subpath ? `${subpath}/admin` : '/admin';
  if (typeof val === 'string' && val.startsWith('/') && !val.startsWith('//') && !val.startsWith('/\\')) {
    if (!subpath || val === subpath || val.startsWith(`${subpath}/`)) {
      return val;
    }
    return `${subpath}${val}`;
  }
  return defaultPath;
}

/**
 * Factory creating the auth router.
 * @param {object} [options]
 * @param {any} [options.db]
 * @param {any} [options.config]
 * @param {(issuer: string, clientId: string, clientSecret?: string) => Promise<any>} [options.discoverOidc]
 * @param {any} [options.keySet]
 * @returns {express.Router}
 */
function createAuthRouter(options = {}) {
  const router = express.Router();
  const db = options.db || defaultDb;
  const config = options.config || getAuthConfig();
  const discoverOidc = options.discoverOidc;
  const keySet = options.keySet;
  const codeGrant = options.codeGrant;

  const isProd = config.nodeEnv === 'production';
  const isHttps = config.baseUrl.startsWith('https://');

  /** @type {any} */
  let remoteJwks = null;

  async function getJwks() {
    if (keySet) return keySet;
    if (!remoteJwks) {
      if (!config.oidcIssuer) {
        throw new Error('OIDC_ISSUER is required for backchannel logout');
      }
      const jose = await import('jose');
      const issuerUrl = config.oidcIssuer.replace(/\/+$/, '');
      remoteJwks = jose.createRemoteJWKSet(new URL(`${issuerUrl}/jwks`));
    }
    return remoteJwks;
  }

  /** @type {Promise<any> | null} */
  let oidcConfigPromise = null;

  async function getOidcConfig() {
    if (!config.oidcIssuer || !config.oidcClientId) {
      throw new Error('OIDC_ISSUER and OIDC_CLIENT_ID are required for OIDC authentication');
    }
    if (!oidcConfigPromise) {
      if (discoverOidc) {
        oidcConfigPromise = discoverOidc(
          config.oidcIssuer,
          config.oidcClientId,
          config.oidcClientSecret
        );
      } else {
        const oidc = await import('openid-client');
        const clientAuth = config.oidcClientSecret
          ? oidc.ClientSecretPost(config.oidcClientSecret)
          : undefined;
        oidcConfigPromise = oidc.discovery(
          new URL(config.oidcIssuer),
          config.oidcClientId,
          config.oidcClientSecret,
          clientAuth
        );
      }
    }
    return oidcConfigPromise;
  }

  // GET /api/auth/config — expose auth mode and available login providers
  router.get('/config', (req, res) => {
    const oidcEnabled = config.authMode === 'oidc' || Boolean(config.oidcIssuer && config.oidcClientId);
    res.json({
      authMode: config.authMode,
      oidc: {
        enabled: oidcEnabled,
        buttonLabel: config.oidcButtonLabel || 'Kirjaudu Tunnuksella',
      },
      local: {
        enabled: config.authMode !== 'oidc' || config.allowLocalAdmin,
      },
    });
  });

  // GET /api/auth/login — initiate Authorization Code Flow with PKCE
  router.get('/login', async (req, res, next) => {
    try {
      const returnTo = safeReturnTo(req.query.returnTo, config.subpath);

      if (config.authMode === 'dev' && !isProd && !config.oidcIssuer) {
        return res.redirect(returnTo);
      }

      const oidc = await import('openid-client');
      const oidcConfig = await getOidcConfig();
      const codeVerifier = oidc.randomPKCECodeVerifier();
      const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();

      const stateToken = signToken(
        {
          codeVerifier,
          state,
          nonce,
          returnTo,
        },
        config.sessionSecret,
        { expiresIn: '10m' }
      );

      res.cookie(OIDC_STATE_COOKIE, stateToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: 10 * 60 * 1000,
        path: '/',
      });

      const redirectTo = oidc.buildAuthorizationUrl(oidcConfig, {
        redirect_uri: config.oidcRedirectUri,
        scope: config.oidcScopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        nonce,
      });

      res.redirect(redirectTo.href);
    } catch (err) {
      oidcConfigPromise = null;
      next(err);
    }
  });

  // GET /api/auth/callback — handle authorization code exchange and validate ID token claims
  router.get('/callback', async (req, res, next) => {
    try {
      // Parse state cookie
      let stateCookie = null;
      if (req.headers.cookie) {
        const match = req.headers.cookie.match(new RegExp(`(?:^|;\\s*)${OIDC_STATE_COOKIE}=([^;]+)`));
        stateCookie = match ? decodeURIComponent(match[1]) : null;
      }

      const saved = verifyToken(stateCookie, config.sessionSecret);
      res.clearCookie(OIDC_STATE_COOKIE, { path: '/' });

      if (!saved || !saved.codeVerifier || !saved.state) {
        return res.status(400).json({ error: { message: 'Missing or expired OIDC login state', status: 400 } });
      }

      const oidc = await import('openid-client');
      const oidcConfig = await getOidcConfig();
      const currentUrl = new URL(req.originalUrl, config.baseUrl);
      const grantFn = codeGrant || oidc.authorizationCodeGrant;

      const tokens = await grantFn(oidcConfig, currentUrl, {
        pkceCodeVerifier: saved.codeVerifier,
        expectedState: saved.state,
        expectedNonce: saved.nonce,
      });

      const claims = tokens.claims ? tokens.claims() : {};
      const sub = String(claims.sub || '');
      if (!sub) {
        return res.status(401).json({ error: { message: 'Missing sub claim in ID token', status: 401 } });
      }

      const name = String(claims.name || claims.preferred_username || claims.email || sub);
      const email = claims.email ? String(claims.email) : undefined;
      const groups = Array.isArray(claims.groups) ? claims.groups.map(String) : [];

      const role = mapGroupsToRole(groups, config.oidcGroupRoleMap);
      if (!role) {
        return res.status(403).json({
          error: {
            message: 'No matching role or membership for user groups',
            status: 403,
          },
        });
      }

      // Generate session token (JWT)
      const sessionToken = signToken(
        {
          sub,
          name,
          username: name,
          email,
          role,
          groups,
          iat: Math.floor(Date.now() / 1000),
        },
        config.sessionSecret,
        { expiresIn: '8h' }
      );

      // Set admin session cookie
      res.cookie(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: 8 * 3600 * 1000,
        path: '/',
      });

      // Set CSRF cookie for mutating actions
      const csrfToken = generateCsrfToken();
      setCsrfCookie(res, csrfToken);

      const returnUrl = safeReturnTo(saved.returnTo, config.subpath);
      res.redirect(returnUrl);
    } catch (err) {
      next(err);
    }
  });

  // Logout handler
  const handleLogout = async (req, res) => {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(OIDC_STATE_COOKIE, { path: '/' });
    res.clearCookie('csrfToken', { path: '/' });

    if (req.method === 'POST') {
      return res.json({ success: true, ok: true });
    }

    if (config.authMode === 'oidc' && config.oidcIssuer) {
      try {
        const oidc = await import('openid-client');
        const oidcConfig = await getOidcConfig();
        const endUrl = oidc.buildEndSessionUrl(oidcConfig, {
          post_logout_redirect_uri: config.baseUrl,
        });
        return res.redirect(endUrl.href);
      } catch {
        // Fallback to local admin
      }
    }

    res.redirect(safeReturnTo(req.query.returnTo, config.subpath));
  };

  router.get('/logout', handleLogout);
  router.post('/logout', handleLogout);

  // POST /api/auth/backchannel — OIDC backchannel logout
  router.post('/backchannel', express.urlencoded({ extended: false }), async (req, res) => {
    try {
      const logoutToken = req.body ? req.body.logout_token : undefined;
      if (!logoutToken || typeof logoutToken !== 'string') {
        return res.status(400).json({ error: 'invalid_request', message: 'Missing logout_token' });
      }

      let payload;
      try {
        const jose = await import('jose');
        const keySetInstance = await getJwks();
        const verified = await jose.jwtVerify(logoutToken, keySetInstance, {
          issuer: config.oidcIssuer ? config.oidcIssuer.replace(/\/+$/, '') : undefined,
        });
        payload = verified.payload;
      } catch (err) {
        return res.status(400).json({ error: 'invalid_request', message: err.message || 'Invalid logout token' });
      }

      if (payload.nonce) {
        return res.status(400).json({ error: 'invalid_request', message: 'logout_token must not contain nonce' });
      }

      if (!payload.events || typeof payload.events !== 'object') {
        return res.status(400).json({ error: 'invalid_request', message: 'Missing events claim' });
      }

      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      if (!sub) {
        return res.status(400).json({ error: 'invalid_request', message: 'Missing sub claim' });
      }

      // Record revocation in database
      await recordRevocation(sub, db);

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'server_error', message: err.message });
    }
  });

  return router;
}

const defaultAuthRouter = createAuthRouter();
defaultAuthRouter.createAuthRouter = createAuthRouter;

module.exports = defaultAuthRouter;
