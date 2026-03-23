# Rollback Procedures

This document describes how to roll back a failed deployment of Simple Feedback.

---

## Quick reference

```bash
# Roll back application code to the previous commit
git -C /path/to/simple-feedback revert HEAD --no-edit
git -C /path/to/simple-feedback push origin main

# OR reset to a known good commit (destructive — only if revert is impractical)
git -C /path/to/simple-feedback reset --hard <good-commit-sha>
git -C /path/to/simple-feedback push --force-with-lease origin main
```

---

## Scenarios

### 1. Code rollback (no schema change)

If the deployment pulled bad code but ran no new migration:

```bash
# Find the last known good commit
git log --oneline -10

# Revert the bad commit (creates a new commit, safe for shared repos)
git revert HEAD
git push origin main

# Re-run the deploy script to pick up the revert
./scripts/deploy.sh
```

### 2. Code rollback after a failed migration

Migrations are append-only and tracked in `schema_migrations`. If a migration
ran and left the schema in a broken state:

#### Step 1 — Restore a database snapshot

Always take a snapshot immediately before deploying:

```bash
# Before deploying (add this to deploy.sh or your CI pipeline)
pg_dump "$DATABASE_URL" > "/backups/feedback_$(date +%Y%m%d_%H%M%S).sql"

# Restore from a snapshot
psql "$DATABASE_URL" < /backups/feedback_<timestamp>.sql
```

#### Step 2 — Roll back the code

```bash
git revert HEAD   # revert the commit that introduced the bad migration
git push origin main
./scripts/deploy.sh
```

#### Step 3 — Remove the migration tracking entry (if needed)

If the snapshot pre-dates the migration but the `schema_migrations` row was
already inserted, remove it so the migration can run again after it is fixed:

```sql
DELETE FROM schema_migrations WHERE version = '011_schedule_timezone';
```

---

## Adding pre-deployment backups to deploy.sh

Edit `scripts/deploy.sh` and insert the following block after step 1 (git fetch)
and before step 2 (git pull):

```bash
# ── 1b. Database snapshot ──────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/simple-feedback}"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre-deploy_$(date +%Y%m%d_%H%M%S).sql"
if command -v pg_dump &>/dev/null && [ -n "${DATABASE_URL:-}" ]; then
  log "Taking database snapshot → $BACKUP_FILE"
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  log "Snapshot saved."
else
  log "WARNING: pg_dump not available or DATABASE_URL not set. Skipping snapshot."
fi
```

Keep at least the last 5 snapshots:

```bash
# Prune old backups (keep 5 most recent)
ls -t "$BACKUP_DIR"/pre-deploy_*.sql | tail -n +6 | xargs -r rm --
```

---

## Migration rollback scripts

Each migration should have a corresponding down-migration. File them alongside
the up-migration for reference:

| Migration | Down script |
|---|---|
| `011_schedule_timezone.sql` | `ALTER TABLE schedules DROP COLUMN IF EXISTS timezone;` |

These are intentionally not run automatically. Apply them manually after
restoring a snapshot if the snapshot approach is not available.

---

## Verifying a successful rollback

```bash
# 1. Confirm the running code version
git -C /path/to/simple-feedback log --oneline -1

# 2. Health check
curl -s https://<your-domain>/health | jq .

# 3. Confirm schema version
psql "$DATABASE_URL" -c "SELECT version FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;"

# 4. Smoke test the public API
curl -s https://<your-domain>/api/locations/<slug>/questionnaire | jq .location.name
```
