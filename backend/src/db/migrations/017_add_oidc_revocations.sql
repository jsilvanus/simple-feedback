-- 017_add_oidc_revocations.sql
-- Store revoked OIDC user sessions (e.g. from backchannel logout)

CREATE TABLE IF NOT EXISTS user_revocations (
    sub VARCHAR(255) PRIMARY KEY,
    revoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_revocations_sub ON user_revocations(sub);
