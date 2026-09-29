#!/usr/bin/env bash
# Deploys or redeploys simple-feedback on this server:
#   clone (first run) or pull, create .env.server with fresh secrets (first run), build the image,
#   start PostgreSQL, run the migrations, (re)start the app on 127.0.0.1:4101 for the host's nginx.
#
#   bash /home/deploy/deploy/simple-feedback/scripts/server-deploy.sh
#   (or a copy of this file from anywhere: it clones the repository on the first run)
#
# Environment (all optional):
#   BASE_DIR       /home/deploy/deploy        the checkout goes to $BASE_DIR/simple-feedback
#   DEPLOY_BRANCH  main                       branch to deploy
#   REPO_URL       https://github.com/jsilvanus/simple-feedback.git
#   DOMAIN         asked on the first run     public domain (only used when .env.server is created)
#   HOST_PORT      4101                       127.0.0.1 port nginx proxies to (first run only)
#
# Secrets live in $BASE_DIR/simple-feedback/.env.server (mode 600, gitignored). It is never overwritten;
# edit it and run this script again to apply changes.
set -euo pipefail

NAME=simple-feedback
DEFAULT_DOMAIN=feedback.italeino.fi
BASE_DIR=${BASE_DIR:-/home/deploy/deploy}
APP_DIR=$BASE_DIR/$NAME
BRANCH=${DEPLOY_BRANCH:-main}
REPO_URL=${REPO_URL:-https://github.com/jsilvanus/$NAME.git}
ENV_FILE=$APP_DIR/.env.server
KEPT_ENV=$BASE_DIR/.kept/$NAME.env
SELF=scripts/server-deploy.sh

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }
secret() { openssl rand -hex 32; }

command -v git >/dev/null || die "git is not installed"
command -v openssl >/dev/null || die "openssl is not installed"
docker compose version >/dev/null 2>&1 || die "docker compose (v2) is not available for $(id -un)"

# --- 1. Code ------------------------------------------------------------------------------------
# After updating the checkout, re-run the checkout's own copy of this script (once), so a changed
# script takes effect in the same deployment.
if [ -z "${SERVER_DEPLOY_REEXEC:-}" ]; then
  if [ -d "$APP_DIR/.git" ]; then
    log "Updating $APP_DIR ($BRANCH)"
    git -C "$APP_DIR" fetch --prune origin "$BRANCH"
    git -C "$APP_DIR" checkout -q "$BRANCH"
    git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
  else
    [ -e "$APP_DIR" ] && die "$APP_DIR exists but is not a git checkout"
    log "Cloning $REPO_URL ($BRANCH) into $APP_DIR"
    mkdir -p "$BASE_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  fi
  if [ -f "$APP_DIR/$SELF" ]; then
    SERVER_DEPLOY_REEXEC=1 exec bash "$APP_DIR/$SELF" "$@"
  fi
fi
cd "$APP_DIR"
log "Deploying $NAME at commit $(git rev-parse --short HEAD)"

# --- 2. Settings and secrets (first run only) ----------------------------------------------------
if [ ! -f "$ENV_FILE" ] && [ -f "$KEPT_ENV" ]; then
  log "Restoring settings kept by server-remove.sh ($KEPT_ENV)"
  mv "$KEPT_ENV" "$ENV_FILE"
fi
if [ ! -f "$ENV_FILE" ]; then
  if [ -z "${DOMAIN:-}" ] && [ -t 0 ]; then
    read -r -p "Public domain for $NAME [$DEFAULT_DOMAIN]: " DOMAIN
  fi
  DOMAIN=${DOMAIN:-$DEFAULT_DOMAIN}
  ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=')
  umask 077
  cat > "$ENV_FILE" <<EOF
# simple-feedback server settings (scripts/server-deploy.sh). Never commit this file.
DOMAIN=$DOMAIN
HOST_PORT=${HOST_PORT:-4101}

# Bundled PostgreSQL (docker-compose.server.yml). The password only applies when the volume is created.
DB_NAME=simple_feedback
DB_USER=simple_feedback
DB_PASSWORD=$(secret)

JWT_SECRET=$(secret)
ADMIN_USERNAME=feedback-admin
ADMIN_PASSWORD=$ADMIN_PASSWORD
CORS_ORIGIN=https://$DOMAIN
# nginx on this host is the only proxy in front of the app.
TRUST_PROXY=1

STORAGE_DRIVER=local
# BREVO_API_KEY=
EOF
  chmod 600 "$ENV_FILE"
  log "Created $ENV_FILE"
  log "Admin login: feedback-admin / $ADMIN_PASSWORD   (also in $ENV_FILE)"
fi

dc() { docker compose -p "$NAME" --project-directory "$APP_DIR" -f docker-compose.server.yml --env-file "$ENV_FILE" "$@"; }
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1; }

# --- 3. Build, database, migrations, start -------------------------------------------------------
log "Building image"
dc build --pull

log "Starting database"
dc up -d --wait db

DB_USER=$(env_value DB_USER); DB_NAME=$(env_value DB_NAME)
if [ "$(dc exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "SELECT to_regclass('public.locations') IS NOT NULL")" != t ]; then
  log "Empty database: loading backend/src/db/schema.sql"
  dc exec -T db psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" < backend/src/db/schema.sql
fi

log "Running migrations"
dc run --rm --no-deps backend node src/db/migrate.js

log "Starting app"
dc up -d --remove-orphans

# --- 4. Check ------------------------------------------------------------------------------------
PORT=$(env_value HOST_PORT)
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/health"; then
    docker image prune -f >/dev/null
    log "OK: $NAME is up on 127.0.0.1:$PORT (https://$(env_value DOMAIN) once nginx is set up)"
    exit 0
  fi
  sleep 2
done
dc logs --tail 50 backend
die "$NAME did not answer on http://127.0.0.1:$PORT/health"
