# TODO for this project

## Production Readiness & Operations
- [x] Generate and store a strong `JWT_SECRET` in production (documented in README security notes)
- [x] Change default admin credentials before first production deploy (env var validation added)
- [x] Set `CORS_ORIGIN` env var on the backend to restrict allowed origins (configured & validated at startup)
- [ ] Set up HTTPS via reverse proxy (Nginx / Caddy) in production (see docs/ROLLBACK.md for example)
- [ ] Enable automated PostgreSQL backups (e.g. pg_dump via cron or cloud snapshot)
- [ ] Set up log rotation for the backend process
- [ ] Add input length validation on feedback text answers to prevent DB bloat
- [x] Security hardening completed (see REVIEW.md for all fixes: CSRF, httpOnly cookies, rate limiting, input validation)

## Deployment & Monitoring
- [ ] Document cron/systemd setup for `scripts/deploy.sh` for unattended deploys
- [ ] Add health check endpoint monitoring (e.g. UptimeRobot, Grafana)
- [ ] Provide Nginx/Caddy example config for serving frontend + reverse-proxying API
- [ ] Document symlink-based frontend deployment workflow
- [x] Rollback guide completed (see docs/ROLLBACK.md)

## UI/UX & Internationalization
- [x] Multi-language support (English, Finnish, Swedish) — fully implemented
- [x] Question text with i18n — JSONB fields support language-keyed content
- [x] Button styling with colors and accent highlighting — Material UI + Emotion components
- [x] Material UI icons throughout feedback & admin interfaces
- [x] Accessibility features (high-contrast mode, adjustable UI scaling 50–200%)
- [x] Privacy notice on kiosk UI before/after submission

## Analytics & Results
- [x] Radar chart visualizations for multi-scale questions (continuous_scale type)
- [x] Answer views for composite visualizations across multiple questions
- [x] Results parsing with proper aggregation (json_agg, GROUP BY optimization)
- [x] CSV export with pagination support
- [ ] PDF/chart export option (planned)
- [ ] Live dashboard with auto-refresh (planned)

## Advanced Features
- [ ] QR code generation for location URLs
- [ ] Role-based access control (read-only admin, etc.)
- [ ] Pre-migrated questionnaires template library
- [ ] Webhook triggers for external systems

## Known Issues & Improvements
- [ ] M7 — JSON field structure validation (buttons, words arrays) for malformed objects
- [ ] M10 — React error boundaries for better error UI
- [ ] M11 — RadarChart redraw optimization (debouncing/requestAnimationFrame)
- [ ] L2 — Inline SQL comments standardization
- [ ] L7 — XSS protection for future dangerouslySetInnerHTML usage
