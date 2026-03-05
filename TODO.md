# TODO for this project

## Security & Operations
- [ ] Generate and store a strong `JWT_SECRET` in production (see README security notes)
- [ ] Change default admin credentials before first production deploy
- [ ] Set `CORS_ORIGIN` env var on the backend to restrict allowed origins
- [ ] Set up HTTPS via reverse proxy (Nginx / Caddy) in production
- [ ] Enable automated PostgreSQL backups (e.g. pg_dump via cron or cloud snapshot)
- [ ] Set up log rotation for the backend process
- [ ] Consider moving admin credentials from env vars to a hashed DB record
- [ ] Add input length validation on feedback text answers (prevent DB bloat)

## Deployment
- [ ] Document cron/systemd setup for `scripts/deploy.sh` for unattended deploys
- [ ] Add health check endpoint monitoring (e.g. UptimeRobot, Grafana)
- [ ] Provide Nginx/Caddy example config for serving frontend + reverse-proxying API
- [ ] Document symlink-based frontend deployment workflow

## The looks!
- [ ] Questions also with i18n
- [ ] Everything with multiple language support / required stuff (Finnish as fallback)
- [ ] Make buttons colorful when not clicked, surround with accent color when chosen
- [ ] Emojis bigger inside the buttons, maybe move to material ui icons

## Results parsing
- [ ] Group questions
- [ ] Same scales?
- [ ] Fix results parsing edge cases

## Features
- [ ] QR code generation for location URLs
- [ ] Live dashboard with auto-refresh
- [ ] Role-based access control (read-only admin, etc.)
- [ ] Multi-language questionnaire content (question text per language)
- [ ] Export analytics as PDF/charts
