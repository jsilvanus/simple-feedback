#!/usr/bin/env bash
# deploy.sh — Pull latest code and restart the backend service.
#
# Configuration via environment variables:
#   DEPLOY_BRANCH    Git branch to deploy (default: main)
#   DEPLOY_DIR       Absolute path to the repository root (default: directory of this script's parent)
#   ENVIRONMENT      Deployment environment: staging or production (auto-detected from DEPLOY_BRANCH if omitted)
#
# Environment auto-detection:
#   DEPLOY_BRANCH=develop  → ENVIRONMENT=staging
#   DEPLOY_BRANCH=main     → ENVIRONMENT=production
#
# Usage:
#   ./scripts/deploy.sh                           # Production (main branch)
#   DEPLOY_BRANCH=develop ./scripts/deploy.sh     # Staging (develop branch)
#   ENVIRONMENT=staging ./scripts/deploy.sh       # Explicit staging override
#
# The script is self-updating: if deploy.sh itself changed after the pull,
# it re-executes itself so the latest version of the deployment logic runs.

set -euo pipefail

SCRIPT_PATH="$(realpath "$0")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

# Auto-detect environment from branch if not explicitly set
if [ -z "${ENVIRONMENT:-}" ]; then
  case "$DEPLOY_BRANCH" in
    develop) ENVIRONMENT="staging" ;;
    main)    ENVIRONMENT="production" ;;
    *)       ENVIRONMENT="production" ;;
  esac
fi

# Select compose file based on environment
case "$ENVIRONMENT" in
  staging)     COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.staging.yml}" ;;
  production)  COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.prod.yml}" ;;
  *)           log "ERROR: Unknown ENVIRONMENT '$ENVIRONMENT'. Use 'staging' or 'production'."; exit 1 ;;
esac

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# Portable checksum: prefer sha256sum (Linux), fall back to shasum (macOS)
file_hash() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

cd "$DEPLOY_DIR"

log "=== Simple Feedback Deployment ==="
log "Repository:  $DEPLOY_DIR"
log "Branch:      $DEPLOY_BRANCH"
log "Environment: $ENVIRONMENT"
log "Compose:     $COMPOSE_FILE"

# ── 1. Stash any local changes (safety measure) ─────────────────────────────
git fetch origin "$DEPLOY_BRANCH"

CURRENT_COMMIT="$(git rev-parse HEAD)"
REMOTE_COMMIT="$(git rev-parse "origin/$DEPLOY_BRANCH")"

if [ "$CURRENT_COMMIT" = "$REMOTE_COMMIT" ]; then
  log "Already up to date (commit: ${CURRENT_COMMIT:0:8}). Nothing to do."
  exit 0
fi

log "Updating from ${CURRENT_COMMIT:0:8} → ${REMOTE_COMMIT:0:8} ..."

# Record the checksum of this script before pulling
SCRIPT_HASH_BEFORE="$(file_hash "$SCRIPT_PATH")"

# ── 2. Pull the latest code ──────────────────────────────────────────────────
git checkout "$DEPLOY_BRANCH"
git pull --ff-only origin "$DEPLOY_BRANCH"

log "Repository updated."

# ── 3. Self-update check ─────────────────────────────────────────────────────
SCRIPT_HASH_AFTER="$(file_hash "$SCRIPT_PATH")"

if [ "$SCRIPT_HASH_BEFORE" != "$SCRIPT_HASH_AFTER" ]; then
  log "deploy.sh has changed — re-executing updated script..."
  exec "$SCRIPT_PATH" "$@"
fi

# ── 4. Ensure Docker and compose file exist ──────────────────────────────────
if ! command -v docker &>/dev/null; then
  log "ERROR: docker not found. Deployment requires Docker."
  exit 1
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  log "ERROR: Compose file not found at $COMPOSE_FILE"
  exit 1
fi

# ── 5. Pull latest image from GHCR ───────────────────────────────────────────
log "Pulling latest image from GHCR..."
docker compose -f "$COMPOSE_FILE" pull backend || {
  log "WARNING: Failed to pull image. Continuing with existing image..."
}

# ── 6. Start/migrate database (staging only) ────────────────────────────────
if [ "$ENVIRONMENT" = "staging" ]; then
  log "Starting database service..."
  docker compose -f "$COMPOSE_FILE" up -d db
  docker compose -f "$COMPOSE_FILE" exec -T db sh -c 'pg_isready -U postgres' || {
    log "Waiting for database to be ready..."
    sleep 5
  }

  log "Running database migrations..."
  docker compose -f "$COMPOSE_FILE" run --rm backend node src/db/migrate.js
fi

# ── 7. Restart backend service ───────────────────────────────────────────────
log "Restarting backend service..."
docker compose -f "$COMPOSE_FILE" up -d backend
log "Backend service restarted."

log "=== Deployment complete (commit: ${REMOTE_COMMIT:0:8}) ==="
