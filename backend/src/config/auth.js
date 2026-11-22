'use strict';

const DEFAULT_GROUP_ROLE_MAP = {
  admin: 'admin',
  '/admin': 'admin',
  'feedback-admin': 'admin',
  'feedback-manager': 'manager',
};

const WEAK_SECRETS = [
  'your-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-in-production',
  'secret',
  'changeme',
];

/**
 * Load and validate authentication configuration from environment.
 * @param {Record<string, string | undefined>} [env]
 * @returns {object}
 */
function loadAuthConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const authMode = env.AUTH_MODE || 'dev';
  const rawBaseUrl = (env.BASE_URL || 'http://localhost:3000').trim();
  const baseUrl = rawBaseUrl.replace(/\/+$/, '') || rawBaseUrl;
  const oidcIssuer = (env.OIDC_ISSUER || '').trim().replace(/\/+$/, '');
  const oidcClientId = (env.OIDC_CLIENT_ID || '').trim();
  const oidcClientSecret = (env.OIDC_CLIENT_SECRET || '').trim();
  const oidcRedirectUri = (env.OIDC_REDIRECT_URI || `${baseUrl}/api/auth/callback`).trim();
  const oidcScopes = (env.OIDC_SCOPES || 'openid profile email groups').trim();
  const sessionSecret = (env.SESSION_SECRET || env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production').trim();
  const oidcButtonLabel = (env.OIDC_BUTTON_LABEL || 'Kirjaudu Tunnuksella').trim();
  const allowLocalAdmin = env.ALLOW_LOCAL_ADMIN !== undefined ? env.ALLOW_LOCAL_ADMIN === 'true' : authMode !== 'oidc';

  let subpath = '';
  if (env.DOMAIN_PATH && env.DOMAIN_PATH !== '/') {
    subpath = env.DOMAIN_PATH.replace(/\/+$/, '');
  } else if (baseUrl) {
    try {
      subpath = new URL(baseUrl).pathname.replace(/\/+$/, '');
    } catch {}
  }

  let oidcGroupRoleMap = { ...DEFAULT_GROUP_ROLE_MAP };
  if (env.OIDC_GROUP_ROLE_MAP) {
    try {
      oidcGroupRoleMap = typeof env.OIDC_GROUP_ROLE_MAP === 'string'
        ? JSON.parse(env.OIDC_GROUP_ROLE_MAP)
        : env.OIDC_GROUP_ROLE_MAP;
    } catch {
      throw new Error('OIDC_GROUP_ROLE_MAP must be valid JSON');
    }
  }

  if (nodeEnv === 'production') {
    if (authMode === 'oidc') {
      if (!oidcIssuer) {
        throw new Error('OIDC_ISSUER is required in production when AUTH_MODE=oidc');
      }
      if (!oidcClientId) {
        throw new Error('OIDC_CLIENT_ID is required in production when AUTH_MODE=oidc');
      }
      if (WEAK_SECRETS.includes(sessionSecret)) {
        throw new Error('SESSION_SECRET / JWT_SECRET must be set to a strong secret in production');
      }
    }
  }

  return {
    nodeEnv,
    authMode,
    baseUrl,
    oidcIssuer,
    oidcClientId,
    oidcClientSecret,
    oidcRedirectUri,
    oidcScopes,
    sessionSecret,
    oidcGroupRoleMap,
    oidcButtonLabel,
    allowLocalAdmin,
    subpath,
  };
}

let cachedConfig = null;

function getAuthConfig() {
  if (!cachedConfig) {
    cachedConfig = loadAuthConfig();
  }
  return cachedConfig;
}

function resetAuthConfig() {
  cachedConfig = null;
}

module.exports = {
  loadAuthConfig,
  getAuthConfig,
  resetAuthConfig,
  DEFAULT_GROUP_ROLE_MAP,
};
