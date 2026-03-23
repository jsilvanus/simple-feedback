# Code Review — Simple Feedback Application

Reviewed: 2026-03-23

---

## Summary

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 8 |
| Medium | 11 |
| Low | 9 |

---

## Critical Issues

### C1 — Hardcoded default admin credentials
**File**: `backend/src/routes/admin.js:19-20`

```js
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
```

If `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars are not set, the app silently falls back to
`admin`/`admin123`. Any attacker who reaches the login endpoint can immediately compromise the
admin panel.

**Fix**: Validate at startup and exit if env vars are missing or contain default values.
**Status**: ✅ Fixed in `backend/src/server.js` — startup validation added.

---

### C2 — Weak JWT secret continues running
**File**: `backend/src/middleware/auth.js:10-18`

The code logs a `console.warn` for a missing, too-short, or known-weak `JWT_SECRET` but then
continues with a fallback weak secret. An attacker who knows the default can forge admin JWTs.

**Fix**: Treat weak/missing secret as a fatal error in production.
**Status**: ✅ Fixed in `backend/src/middleware/auth.js` — throws in production, warns in dev.

---

### C3 — Rate limiting disabled on all admin routes
**File**: `backend/src/routes/admin.js:44`

```js
// router.use(apiLimiter);
// Deactivated in development to avoid hitting limits during testing, but should be enabled in production
```

`apiLimiter` is commented out unconditionally, leaving all admin CRUD endpoints with no rate
limiting in any environment. This enables unbounded enumeration and abuse.

**Fix**: Re-enable and gate with `NODE_ENV`.
**Status**: ✅ Fixed in `backend/src/routes/admin.js` — enabled in non-development environments.

---

### C4 — No server-side enforcement of location password authentication
**File**: `backend/src/routes/feedback.js`

Password-protected locations require a client login via `POST /api/locations/:slug/login`, but
that endpoint returns only `{ success: true }` — it issues no token. The feedback submission
endpoint performs no check that the location was authenticated. Any client can skip the login
and POST feedback directly to any password-protected location.

**Fix**: Issue a signed JWT on successful location login; require and verify that token in
the feedback endpoint when the location has `password_required = true`.
**Status**: ✅ Fixed — location login now returns a signed `locationToken`; feedback endpoint
validates it against the location's ID.

---

## High Issues

### H1 — Null dereference crash on malformed weekday_pattern
**File**: `backend/src/routes/locations.js:56`

```js
const isTimeActive = currentTime >= pattern.start_hour && currentTime <= pattern.end_hour;
```

`pattern.start_hour` and `pattern.end_hour` are not null-checked. A schedule row with
`weekday_pattern = {"days": [1]}` (missing time fields) causes an uncaught comparison that
produces `false` rather than crashing—but any access on `undefined` in a stricter variant
or future refactor can throw a 500 on the public questionnaire endpoint.

**Fix**: Guard both fields before comparison.
**Status**: ✅ Fixed in `backend/src/routes/locations.js`.

---

### H2 — JWT tokens stored in localStorage (XSS risk)
**File**: `frontend/src/pages/AdminPage.jsx:30`

```js
localStorage.setItem('adminToken', result.token);
```

`localStorage` is accessible by any JavaScript running in the page. An XSS vulnerability
anywhere in the app (or a third-party script) can steal the admin token. `httpOnly` cookies
would prevent this.

**Recommendation**: Migrate to `httpOnly` + `Secure` + `SameSite=Strict` cookies for the
admin JWT.

---

### H3 — No CSRF protection
**Scope**: All `POST`/`PUT`/`DELETE` admin endpoints.

There are no CSRF tokens on state-changing operations. Combined with H2 (localStorage token),
the risk is moderate—CSRF attacks require the token to be in a cookie. If tokens are ever
migrated to cookies, CSRF protection becomes critical.

**Recommendation**: Implement `csurf` or the double-submit cookie pattern once tokens move to
cookies.

---

### H4 — No validation that feedback answers belong to the questionnaire
**File**: `backend/src/routes/feedback.js:49-70`

The feedback endpoint inserts answers without checking that each `questionId` belongs to the
submitted `questionnaireId`, or that numeric `value` is within the question's defined scale
range. This allows submission of arbitrary question IDs and values.

**Recommendation**: Before inserting, query `questionnaire_questions` to validate that all
submitted `questionId`s are part of the questionnaire, and optionally validate value bounds.

---

### H5 — Unvalidated `startDate`/`endDate` in results endpoint
**File**: `backend/src/routes/admin.js` (results section)

Date filter params are passed directly to PostgreSQL without ISO format validation. Invalid
values produce unclear DB errors rather than a 400.

**Recommendation**: Validate date strings with a regex or `Date.parse()` before use.

---

### H6 — `multiScaleLayout` not validated against allowed enum values
**File**: `backend/src/routes/admin.js:849-852`

Any string is accepted and stored. The DB `CHECK` constraint (`'stacked'`, `'matrix'`,
`'compact'`) will reject invalid values at the DB level, producing a cryptic 500 rather
than a clean 400.

**Recommendation**: Validate before the query:
```js
const VALID_LAYOUTS = ['stacked', 'matrix', 'compact'];
if (!VALID_LAYOUTS.includes(multiScaleLayout)) return res.status(400)...
```

---

### H7 — Stack traces leaked in production error responses
**File**: `backend/src/app.js:43-49`

The error handler always includes `err.message` in the response. For unhandled DB errors or
internal exceptions, this can expose table names, column names, or query fragments.

**Recommendation**: In production, return a generic message; log the full error server-side only.

---

### H8 — No startup validation of critical environment variables
**File**: `backend/src/server.js`

The server starts without checking `DATABASE_URL`/`DB_*`, `JWT_SECRET`, or admin credentials.
Missing config surfaces as a cryptic runtime error on first request.

**Status**: Partially addressed by C1 fix (admin credentials + JWT secret). Full DB config
validation is still recommended.

---

## Medium Issues

### M1 — N+1 queries on schedules list
**File**: `backend/src/routes/admin.js` (schedules GET)

Each schedule row triggers 2 additional queries (questionnaires + locations). 100 schedules
= 201 queries. Should be replaced with JOINs or a single aggregation query.

---

### M2 — No pagination on results and export endpoints
**File**: `backend/src/routes/admin.js` (results/export sections)

Both endpoints return all rows with no `LIMIT`/`OFFSET`. A large deployment will cause
memory exhaustion and slow responses.

**Recommendation**: Add `limit`/`offset` query params (default limit 1000).

---

### M3 — Per-axis AVG queries in answer views
**File**: `backend/src/routes/admin.js` (answer views results section)

A separate `AVG()` query is issued per axis per view. 10 views × 5 axes = 50+ queries per
results page. Should be a single `GROUP BY` aggregate.

---

### M4 — Timezone-dependent schedule time comparison
**File**: `backend/src/routes/locations.js:30`

```js
const currentTime = now.toTimeString().substring(0, 5); // server timezone
```

`toTimeString()` uses the server's local timezone. Schedules defined by admins in a different
timezone will activate at the wrong times. Consider storing timezone in the schedule or
using UTC throughout.

---

### M5 — `continuous_scale` exclusion from public UI undocumented in code
**File**: `backend/src/routes/locations.js:110`

```sql
AND q.type IN ('scale', 'text', 'wordcloud')
```

The intentional exclusion of `continuous_scale` from public feedback has no inline comment.
A future developer will likely "fix" this inadvertently.

**Recommendation**: Add a comment: `-- continuous_scale is excluded; shown only in admin radar views`.

---

### M6 — Silent zero-row UPDATE in scale items loop
**File**: `backend/src/routes/admin.js` (scale items update section)

When updating scale items within a transaction, the result's `rowCount` is never checked.
An UPDATE that matches 0 rows (e.g., wrong `question_id`) silently succeeds.

---

### M7 — JSON field structure not validated (buttons, words arrays)
**File**: `backend/src/routes/admin.js` (question update section)

`Array.isArray()` is checked for `buttons` and `words` but individual element structure is
not validated. Malformed objects get stored and can break client rendering.

---

### M8 — `feedbackLimiter` can be trivially bypassed
**File**: `backend/src/middleware/rateLimiter.js`

The feedback rate limiter uses IP-based tracking. In environments behind a proxy without
`trust proxy` set, all requests appear to come from the same IP (the proxy). Check that
`app.set('trust proxy', 1)` is configured for production.

---

### M9 — `scaleItemId` parsed with `parseInt` but no NaN guard in feedback
**File**: `backend/src/routes/feedback.js:62-64`

```js
const scaleItemId = answer.scaleItemId !== undefined && answer.scaleItemId !== null
  ? parseInt(answer.scaleItemId, 10)
  : null;
```

If `scaleItemId` is a non-numeric string, `parseInt` returns `NaN`, which PostgreSQL will
reject with a cryptic type error rather than a clean 400.

**Recommendation**: Check `isNaN()` after parsing and return 400.

---

### M10 — No React error boundaries
**Scope**: All React components

No error boundaries exist. A rendering error in any leaf component crashes the entire app
UI with a blank screen.

**Recommendation**: Wrap route-level components in an `ErrorBoundary`.

---

### M11 — RadarChart redraws on every render without debouncing
**File**: `frontend/src/components/RadarChart.jsx`

`drawChart()` is called without `requestAnimationFrame` or debouncing. Rapid state changes
cause redundant synchronous canvas redraws.

---

## Low Issues

### L1 — Magic numbers for bcrypt rounds, rate limits, token expiry
Hardcoded values (`10` salt rounds, `100/15min`, `5/15min`, `10/min`, `24h`) scattered
across files. Centralise as named constants.

### L2 — Inline comment should be `--` not code: `continuous_scale` filter (see M5)

### L3 — API URL resolution in frontend is fragile
**File**: `frontend/src/api/index.js`
Multiple env var combinations + hostname detection make it difficult to trace the active
base URL at runtime. Log the resolved URL on init.

### L4 — Insufficient test coverage
No tests for auth/authorization, transaction error paths, or invalid input edge cases.

### L5 — Inconsistent error response shapes
Some routes return `{ error: { message } }`, others return `{ error: "message" }`. Should
be standardised.

### L6 — `console.warn` security alerts not surfaced to operators
Security warnings in `auth.js` only appear in stdout. In containerised deployments with
log aggregation, these may go unnoticed unless severity is elevated (e.g., `console.error`).

### L7 — XSS in JSONB rendered question text
React escapes strings by default, but if question text is ever rendered via `dangerouslySetInnerHTML`
(currently not the case), stored text would become an XSS vector. Worth noting for future work.

### L8 — No pagination indicators in admin list views
Large datasets silently render all rows in the frontend tables. Likely to become a usability
and performance issue at scale.

### L9 — Deploy script (`scripts/deploy.sh`) has no rollback mechanism
If a deployment fails mid-migration, there is no documented rollback path.

---

## Work Log

| Date | Issue | Action |
|---|---|---|
| 2026-03-23 | C1 | Added startup validation in `backend/src/server.js`; exits if `ADMIN_PASSWORD` / `ADMIN_USERNAME` are unset or default in production |
| 2026-03-23 | C2 | `backend/src/middleware/auth.js` — weak/missing JWT secret now causes `process.exit(1)` in production instead of a warning |
| 2026-03-23 | C3 | `backend/src/routes/admin.js` — re-enabled `apiLimiter` for non-development environments |
| 2026-03-23 | C4 | `backend/src/routes/locations.js` — location login now issues a signed JWT; `backend/src/routes/feedback.js` — validates location token when `password_required`; `frontend/src/api/index.js` — `submitFeedback` accepts and sends `X-Location-Token`; `frontend/src/pages/FeedbackPage.jsx` — stores token from login response in sessionStorage, passes it on submit, clears on logout |
| 2026-03-23 | H1 | `backend/src/routes/locations.js:56` — null-guarded `pattern.start_hour` / `pattern.end_hour` |
| 2026-03-23 | H2 | Admin JWT migrated to `httpOnly; Secure; SameSite=Strict` cookie. `auth.js` middleware reads cookie as fallback to Bearer header. `admin.js` sets cookie on login, adds `POST /logout` and `GET /me`. `api/index.js` uses `credentials: 'include'`, removes `localStorage` token usage. `AdminPage.jsx` verifies session via `/me` on mount, uses `sessionStorage` as hint, calls logout endpoint. |
| 2026-03-23 | H4 | `backend/src/routes/feedback.js` — validates all submitted `questionId`s belong to the questionnaire before inserting |
| 2026-03-23 | H5 | `backend/src/routes/admin.js` — `startDate`/`endDate` validated with `isValidDate()` on results and export endpoints |
| 2026-03-23 | H6 | `backend/src/routes/admin.js` — `multiScaleLayout` validated against `VALID_MULTI_SCALE_LAYOUTS` constant before storing |
| 2026-03-23 | H7 | `backend/src/app.js` — error handler returns generic message for 5xx in production; detail only in development |
| 2026-03-23 | H8 | `backend/src/server.js` — startup exits if no database config present in production |
| 2026-03-23 | M1 | `backend/src/routes/admin.js` — schedules list replaced with single `json_agg` query; eliminates 2N+1 queries |
| 2026-03-23 | M2 | `backend/src/routes/admin.js` — results (max 5000) and export (max 50000) endpoints accept `limit`/`offset` params |
| 2026-03-23 | M3 | `backend/src/routes/admin.js` — answer view AVG aggregation replaced with single `GROUP BY` query across all views |
| 2026-03-23 | M5 | `backend/src/routes/locations.js` — added SQL comment explaining intentional `continuous_scale` exclusion |
| 2026-03-23 | M6 | `backend/src/routes/admin.js` — scale item UPDATE loop now checks `rowCount` and throws 404 if item not found |
| 2026-03-23 | M9 | `backend/src/routes/feedback.js` — `scaleItemId` `parseInt` NaN validated before transaction begins |
| 2026-03-23 | L1 | `backend/src/routes/admin.js` — `BCRYPT_ROUNDS`, `VALID_MULTI_SCALE_LAYOUTS`, `isValidDate` extracted as named constants |
| 2026-03-23 | L3 | `frontend/src/api/index.js` — resolved API base URL logged via `console.debug` on init |
| 2026-03-23 | L6 | `backend/src/app.js` — CORS_ORIGIN warning elevated to `console.error` |
| 2026-03-23 | H3 | `backend/src/middleware/csrf.js` — double-submit cookie CSRF middleware created; `admin.js` login sets non-httpOnly `csrfToken` cookie; router applies `verifyCsrf` on all mutating admin routes; `frontend/src/api/index.js` — `getCsrfToken()` reads cookie, `adminRequest` sends `X-CSRF-Token` header |
| 2026-03-23 | M4 | `backend/src/db/migrations/011_schedule_timezone.sql` — adds `timezone TEXT NOT NULL DEFAULT 'UTC'` to `schedules`; `locations.js` — recurring schedule matching uses `Intl.toLocaleString` with schedule's IANA timezone; `admin.js` — POST/PUT schedules accept and store `timezone`; `frontend/src/components/AdminSchedules.jsx` — timezone selector added to schedule form |
| 2026-03-23 | L4 | `backend/tests/helpers/adminAgent.js` — shared helper for cookie+CSRF agent; `backend/tests/auth.test.js` — auth flow tests (login cookie, CSRF enforcement, `/me`, logout); `backend/tests/feedback.test.js` — input validation and location auth tests; existing `continuous_scale.test.js` and `location-groups.test.js` updated to use cookie+CSRF pattern |
| 2026-03-23 | L5 | `backend/src/middleware/rateLimiter.js` — all three limiters now return `{ error: { message } }` JSON shape consistent with the rest of the API |
| 2026-03-23 | L8 | `frontend/src/components/Pagination.jsx` — reusable pagination component created; `AdminLocations.jsx` — imports `Pagination`, slices rows to `PAGE_SIZE = 20`; `AdminCrud.css` — pagination styles added |
| 2026-03-23 | L9 | `docs/ROLLBACK.md` — comprehensive rollback guide: code-only rollback, schema rollback with pg_dump snapshot, adding pre-deploy backups to deploy.sh, down-migration reference table, verification checklist |
