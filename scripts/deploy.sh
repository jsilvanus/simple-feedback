#!/usr/bin/env bash
# deploy.sh — Pull latest code and restart the backend service.
#
# Configuration via environment variables:
#   DEPLOY_BRANCH   Git branch to deploy (default: main)
#   DEPLOY_DIR      Absolute path to the repository root (default: directory of this script's parent)
#   COMPOSE_FILE    Path to docker-compose file (default: docker-compose.yml inside DEPLOY_DIR)
#
# Usage:
#   ./scripts/deploy.sh
#   DEPLOY_BRANCH=develop ./scripts/deploy.sh
#
# The script is self-updating: if deploy.sh itself changed after the pull,
# it re-executes itself so the latest version of the deployment logic runs.

set -euo pipefail

SCRIPT_PATH="$(realpath "$0")"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/docker-compose.yml}"

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
log "Repository: $DEPLOY_DIR"
log "Branch:     $DEPLOY_BRANCH"

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

# ── 4. Install/update backend dependencies ──────────────────────────────────
log "Installing backend dependencies..."
(cd "$DEPLOY_DIR/backend" && npm ci --omit=dev)

# ── 5. Run database migrations ───────────────────────────────────────────────
if [ -f "$DEPLOY_DIR/backend/src/db/migrate.js" ]; then
  log "Running database migrations..."
  (cd "$DEPLOY_DIR/backend" && node src/db/migrate.js)
fi

# ── 6. Rebuild and restart Docker services ───────────────────────────────────
if command -v docker &>/dev/null && [ -f "$COMPOSE_FILE" ]; then
  log "Building and restarting Docker services..."
  docker compose -f "$COMPOSE_FILE" build backend
  docker compose -f "$COMPOSE_FILE" up -d --no-deps backend
  log "Services restarted."
else
  log "WARNING: docker not found or compose file missing. Skipping container restart."
  log "Compose file expected at: $COMPOSE_FILE"
fi

log "=== Deployment complete (commit: ${REMOTE_COMMIT:0:8}) ==="
