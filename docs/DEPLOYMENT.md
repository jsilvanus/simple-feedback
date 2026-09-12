# Deployment Guide

This document describes the three-environment deployment architecture for Simple Feedback.

---

## Environments

All environments use a **single image** that contains both backend API and frontend React build.

### Development (Local)
- **PostgreSQL**: Container (via `docker-compose.yml`)
- **Backend + Frontend**: Built locally from source
- **Usage**: Local development with `npm run dev` or `npm run dev:backend` + `npm run dev:db`
- **Compose file**: `docker-compose.yml`
- **Image**: Built on-the-fly from `./backend/Dockerfile` (multi-stage: builds frontend, then backend)
- **URL**: `http://localhost:3000` (both API and UI)

### Staging
- **PostgreSQL**: Container (via `docker-compose.staging.yml`)
- **Backend + Frontend**: Pre-built image from GHCR
- **Usage**: Test deployments, feature validation
- **Compose file**: `docker-compose.staging.yml`
- **Image**: `ghcr.io/jsilvanus/simple-feedback:v{version}`
- **URL**: `http://localhost:3000` (both API and UI)
- **Deploy command**: `IMAGE_TAG=v1.0.0 ENVIRONMENT=staging ./scripts/deploy.sh`

### Production
- **PostgreSQL**: External (connection URL provided via `DATABASE_URL` env var)
- **Backend + Frontend**: Pre-built image from GHCR
- **Usage**: Live production deployment
- **Compose file**: `docker-compose.prod.yml`
- **Image**: `ghcr.io/jsilvanus/simple-feedback:v{version}`
- **Reverse Proxy**: Traefik (external infrastructure project)
- **URL**: `https://your-domain.com` (both API and UI via Traefik)
- **Deploy command**: `IMAGE_TAG=v1.0.0 ENVIRONMENT=production ./scripts/deploy.sh`

---

## Image Publishing (GHCR)

Images are built and pushed to GitHub Container Registry **only on git tags**:
- Push of git tags (v1.0.0, v2.1.0, etc.) → tags: `v1.0.0`, `v2.1.0`, etc.

**Workflow**: `.github/workflows/publish.yml`

**Authentication**: Uses GitHub Actions `GITHUB_TOKEN` (automatic)

**Registry**: `ghcr.io/jsilvanus/simple-feedback`

### Publishing a Release

To publish a new image:

```bash
# Tag on main branch
git tag v1.0.0
git push origin v1.0.0
```

The GitHub Actions workflow automatically:
1. Builds the backend image
2. Pushes to `ghcr.io/jsilvanus/simple-feedback:v1.0.0`

### Pulling Images

Ensure your deployment machine can pull from GHCR:
```bash
# If private repository, authenticate first:
echo $GH_PAT | docker login ghcr.io -u USERNAME --password-stdin
```

---

## Deployment Script

### Overview

`scripts/deploy.sh` handles:
1. Fetch latest code from Git
2. Auto-detect environment from branch (or explicit `ENVIRONMENT` env var)
3. Pull latest image from GHCR
4. Start/migrate database (staging only)
5. Restart backend service

### Usage

**Production (explicit image tag)**:
```bash
IMAGE_TAG=v1.0.0 ENVIRONMENT=production ./scripts/deploy.sh
```

**Staging (explicit image tag)**:
```bash
IMAGE_TAG=v1.0.0 ENVIRONMENT=staging ./scripts/deploy.sh
```

**Custom repository directory**:
```bash
DEPLOY_DIR=/srv/simple-feedback IMAGE_TAG=v1.0.0 ENVIRONMENT=production ./scripts/deploy.sh
```

### Configuration

| Variable | Default | Required | Example |
|----------|---------|----------|---------|
| `IMAGE_TAG` | `latest` | ✅ Yes | `v1.0.0`, `v2.1.0` |
| `ENVIRONMENT` | (none) | ✅ Yes | `staging`, `production` |
| `DEPLOY_DIR` | Script's parent dir | ❌ No | `/srv/simple-feedback` |
| `COMPOSE_FILE` | Auto-selected | ❌ No | Override: `/etc/simple-feedback/docker-compose.prod.yml` |

### Image Tag Format

Tags must match Git tags from the repository:
```bash
# List available tags
git tag -l

# Create and push a new tag
git tag v1.0.0
git push origin v1.0.0

# Deploy that tag
IMAGE_TAG=v1.0.0 ENVIRONMENT=production ./scripts/deploy.sh
```

### Self-Updating

If `deploy.sh` itself changes after a pull, it automatically re-executes the new version. This ensures deployment logic stays in sync with the repo.

---

## Production Deployment with Traefik

### Traefik Setup (External)

Traefik runs in a separate infrastructure project and exposes:
- Reverse proxy on port 80/443
- External network: `traefik_public`

The `docker-compose.prod.yml` assumes:
1. Traefik is already running with its own network
2. Backend container connects to `traefik_public` network
3. Traefik labels direct traffic to backend

### Configuration

Set these environment variables before deploying:

```bash
# backend/.env
DATABASE_URL=postgresql://user:password@postgres.example.com:5432/feedback_db
JWT_SECRET=<strong-random-secret>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>
CORS_ORIGIN=https://your-domain.com,https://www.your-domain.com
NODE_ENV=production

# .env (for docker-compose.prod.yml)
DOMAIN=feedback.your-domain.com
```

### Traefik Labels Explained

```yaml
traefik.enable=true                          # Enable routing for this container
traefik.http.routers.simple-feedback.rule=Host(`domain.com`)
  → Only route requests to domain.com

traefik.http.routers.simple-feedback.entrypoints=websecure
  → Use HTTPS only (port 443)

traefik.http.routers.simple-feedback.tls.certresolver=letsencrypt
  → Use Let's Encrypt for SSL certificates

traefik.http.services.simple-feedback.loadbalancer.server.port=3000
  → Backend service listens on port 3000
```

### SSL/TLS

Certificates are managed by Traefik's Let's Encrypt resolver. No additional setup needed.

### Health Check

Monitor the backend health:
```bash
curl https://feedback.your-domain.com/health
```

---

## Database Migration Strategy

### Development & Staging

Migrations run automatically on deployment:
```bash
docker compose -f docker-compose.staging.yml run --rm backend node src/db/migrate.js
```

### Production (External Database)

If database migrations fail to run automatically:

1. Connect to production server
2. Run migrations manually:
```bash
cd /path/to/simple-feedback
docker compose -f docker-compose.prod.yml exec backend node src/db/migrate.js
```

Or remotely via SSH:
```bash
ssh deploy@production.example.com \
  "cd /srv/simple-feedback && docker compose -f docker-compose.prod.yml exec backend node src/db/migrate.js"
```

---

## Rollback

If a deployment fails:

1. **Code rollback** (revert to previous commit):
```bash
cd /srv/simple-feedback
git reset --hard HEAD~1
DEPLOY_BRANCH=main ./scripts/deploy.sh
```

2. **Database rollback** (see `docs/ROLLBACK.md`):
   - Restore from backup
   - Run down-migrations
   - Verify schema integrity

---

## Monitoring

### Health Check Endpoint

Both staging and production expose `/health`:
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-09-12T10:30:45.123Z"
}
```

### Logs

**Development**:
```bash
docker compose logs -f backend
docker compose logs -f db
```

**Staging/Production**:
```bash
docker compose -f docker-compose.staging.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f backend
```

### Metrics

Consider setting up:
- Uptime monitoring (e.g., UptimeRobot)
- Log aggregation (e.g., ELK stack, Datadog)
- Performance monitoring (e.g., Prometheus + Grafana)

---

## Troubleshooting

### Image Pull Fails

**Error**: `Error response from daemon: pull access denied`

**Solution**: Authenticate with GHCR:
```bash
echo $GH_PAT | docker login ghcr.io -u jsilvanus --password-stdin
docker pull ghcr.io/jsilvanus/simple-feedback:main
```

### Database Connection Fails (Production)

**Error**: `ERROR: connect ECONNREFUSED 127.0.0.1:5432`

**Cause**: `DATABASE_URL` env var not set or incorrect

**Solution**: 
```bash
# Check backend/.env
cat backend/.env | grep DATABASE_URL

# If using connection string, ensure format:
DATABASE_URL=postgresql://username:password@host:port/dbname
```

### Migrations Fail

**Solution**: Check migration logs:
```bash
docker compose -f docker-compose.staging.yml logs backend
docker compose -f docker-compose.staging.yml exec backend ls src/db/migrations/
```

### Traefik Not Routing Traffic

**Checks**:
1. Is Traefik's `traefik_public` network running? `docker network ls | grep traefik`
2. Is backend container connected? `docker network inspect traefik_public`
3. Are labels correct? `docker inspect simple_feedback_backend | grep traefik`
4. Is Traefik dashboard accessible? (usually http://localhost:8080)

---

## Scheduled Deployments (Cron)

To deploy automatically on a schedule (e.g., after manual image publish):

```bash
# /etc/cron.d/simple-feedback-deploy
# Production: daily at 2 AM with latest tag
0 2 * * * deploy IMAGE_TAG=v1.0.0 ENVIRONMENT=production /home/deploy/simple-feedback/scripts/deploy.sh >> /var/log/simple-feedback-deploy.log 2>&1

# Staging: hourly with specific test tag
0 * * * * deploy IMAGE_TAG=v1.0.0-rc1 ENVIRONMENT=staging /home/deploy/simple-feedback/scripts/deploy.sh >> /var/log/simple-feedback-staging.log 2>&1
```

Note: Update `IMAGE_TAG` as needed when deploying new versions. This must match a published tag in GHCR.

---

## See Also

- `SETUP.md` — Local development setup
- `ROLLBACK.md` — Database rollback procedures
- `.github/workflows/publish.yml` — Image publishing workflow
- `docker-compose.yml` — Development environment
- `docker-compose.staging.yml` — Staging environment
- `docker-compose.prod.yml` — Production environment
