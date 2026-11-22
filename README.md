# Simple Feedback App

A configurable feedback application for tablets in kiosk mode and mobile browsers.

## 🎯 Features

- **Multi-Location Support**: Configure feedback for multiple physical locations
- **Flexible Questionnaires**: Create custom questionnaires with various question types
- **Question Types**: Scale buttons, free text, and word cloud inputs
- **Scheduling**: Schedule different questionnaires for specific time periods
- **Admin Dashboard**: Manage locations, questions, and view results
- **Data Export**: Export feedback data as CSV
- **Touch-Optimized UI**: Perfect for tablet kiosks
- **Auto-Reset**: Automatic reset after submission for kiosk mode
- **Anonymous by Design**: All feedback is anonymous — no personal data is collected
- **Tunnus OIDC Single Sign-On**: Full OpenID Connect integration with Authorization Code Flow + PKCE, group-to-role mapping, and backchannel logout

## 🔒 Privacy & Anonymity

Feedback collected through this application is **completely anonymous**:

- No IP addresses, device identifiers, or personal information are stored with submissions
- Feedback sessions record only the location, questionnaire, timestamp, and answers
- A privacy notice is shown to users in the kiosk UI before and after submission
- No cookies or tracking scripts are used on the feedback page

## 📋 Quick Start

For detailed setup instructions, see the [Setup Guide](docs/SETUP.md).

### Prerequisites

- Node.js v18+
- Docker & Docker Compose (for PostgreSQL and backend container)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/jsilvanus/simple-feedback.git
cd simple-feedback

# Install dependencies
npm run install:all

# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env — set a strong JWT_SECRET and change admin credentials

# Start database and run schema migration
npm run dev:setup

# Start full development stack (DB + backend + frontend)
npm run dev
```

Visit `http://localhost:5173` to see the application.

### Production Deployment (Docker)

The backend is containerized. The frontend is built separately and served via a web server or symbolic link.

```bash
# Copy and configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values (strong JWT_SECRET, real DB password, CORS_ORIGIN)

# Build and start backend + database
docker compose up -d --build

# Run database migrations
docker compose exec backend node src/db/migrate.js
```

#### Frontend Deployment

Frontend is now built into the Docker image automatically:

```bash
# Frontend is built as part of the backend Docker image (multi-stage build)
# No separate frontend deployment needed — served by backend at /
# See backend/Dockerfile for build configuration
```

#### Automated Deployment with `scripts/deploy.sh`

The `scripts/deploy.sh` script pulls the latest code and restarts services automatically.
It is **self-updating**: if the script itself changed after the pull, it re-executes the new version.

```bash
# Basic usage (deploys from the 'main' branch)
./scripts/deploy.sh

# Deploy a specific branch
DEPLOY_BRANCH=develop ./scripts/deploy.sh

# Override repository directory
DEPLOY_DIR=/srv/simple-feedback ./scripts/deploy.sh
```

**Configuration via environment variables:**

| Variable        | Default                      | Description                        |
|-----------------|------------------------------|------------------------------------|
| `DEPLOY_BRANCH` | `main`                       | Git branch to pull and deploy      |
| `DEPLOY_DIR`    | Parent of `scripts/`         | Absolute path to repository root   |
| `COMPOSE_FILE`  | `$DEPLOY_DIR/docker-compose.yml` | Path to Docker Compose file    |

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration
- **[API Specification](docs/api-spec.yaml)** - OpenAPI 3.0 specification
- **[Development Plan](PLAN.md)** - Architecture and roadmap
- **[TODO](TODO.md)** - Pending tasks and known issues

## 🏗️ Project Structure

```
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── db/       # Database connection and schema
│   │   └── app.js    # Express application
│   ├── tests/        # Backend tests
│   └── Dockerfile    # Backend container image
├── frontend/         # React frontend (deployed separately)
│   ├── src/
│   │   ├── pages/    # Page components
│   │   ├── api/      # API client
│   │   └── App.jsx   # Main app component
│   └── index.html    # HTML entry point
├── scripts/          # Deployment and maintenance scripts
│   └── deploy.sh     # Self-updating deploy script
├── docs/             # Documentation
├── docker-compose.yml # Backend + database services
└── PLAN.md           # Architecture and development plan
```

## 🎨 Technology Stack

### Backend
- **Node.js** with Express (v18+)
- **PostgreSQL** database (v16)
- **JWT** authentication with `httpOnly` cookie storage
- **CSRF** protection via double-submit cookie pattern
- **Jest** + **Supertest** for testing

### Frontend
- **React** 19 with Vite build tool
- **React Router** 7 for routing
- **Emotion** + **Material UI** for component styling
- **i18next** for internationalization (English, Finnish, Swedish as default fallback)

## 🔧 Development

### Root Scripts (Recommended)

```bash
npm run dev:setup     # Start DB + run schema migration (first time / after schema changes)
npm run dev           # Start DB + backend + Vite
npm run dev:db        # Start only PostgreSQL (Docker)
npm run dev:backend   # Start only backend (nodemon)
npm run dev:frontend  # Start only frontend (Vite)
npm run db:down       # Stop DB container
```

### Backend Development

```bash
cd backend
npm run dev  # Start with nodemon (auto-reload)
npm test     # Run tests
```

### Frontend Development

```bash
cd frontend
npm run dev    # Start Vite dev server
npm run build  # Build for production
```

## API Endpoints

See the [API Specification](docs/api-spec.yaml) for complete documentation.

### Key Public Endpoints

- `GET /health` - Health check
- `GET /api/locations/:slug/questionnaire` - Get active questionnaire
- `POST /api/feedback` - Submit feedback (rate-limited)

### Authentication & OIDC Endpoints

- `GET /api/auth/config` - Expose auth mode and login provider availability
- `GET /api/auth/login` - Initiate OIDC Authorization Code Flow with PKCE
- `GET /api/auth/callback` - OIDC callback: token exchange, role mapping & session cookie
- `GET/POST /api/auth/logout` - Clear session cookies and redirect to OIDC end session URL
- `POST /api/auth/backchannel` - OIDC backchannel logout notification (records user revocation)

### Key Admin Endpoints

- `POST /api/admin/login` - Admin password login (dev mode / optional fallback)
- `GET /api/admin/me` - Authenticated user details, groups, and role
- `GET /api/admin/locations` - List locations
- `GET /api/admin/results` - Get feedback results
- `GET /api/admin/export` - Export results as CSV

## 🔐 Authentication Modes

Simple Feedback supports two authentication modes:

1. **Development / Local Mode (`AUTH_MODE=dev`)** (default):
   - Admin login uses local username and password (`ADMIN_USERNAME` and `ADMIN_PASSWORD`).
   - Sessions are signed JWT tokens stored in `httpOnly` secure cookies.

2. **OpenID Connect Mode (`AUTH_MODE=oidc`)**:
   - Integrates with Tunnus (or any OIDC compliant provider) via standard Authorization Code Flow with PKCE.
   - Configurable group-to-role mapping via `OIDC_GROUP_ROLE_MAP` maps user groups from `claims.groups` to app roles (`admin`, `manager`, `viewer`).
   - Full support for single sign-on (SSO), single logout, and backchannel logout (`POST /api/auth/backchannel`) with token signature verification against the provider's JWKS.

### OIDC Environment Variables

| Variable | Description | Default |
|---|---|---|
| `AUTH_MODE` | Auth mode: `dev` or `oidc` | `dev` |
| `OIDC_ISSUER` | OIDC Issuer URL (e.g. `https://id.example.com/tunnus`) | `""` |
| `OIDC_CLIENT_ID` | OIDC client ID registered with provider | `""` |
| `OIDC_CLIENT_SECRET` | OIDC client secret | `""` |
| `OIDC_REDIRECT_URI` | Full callback URL (e.g. `https://.../api/auth/callback`) | `${BASE_URL}/api/auth/callback` |
| `OIDC_SCOPES` | Requested OAuth scopes | `openid profile email groups` |
| `OIDC_BUTTON_LABEL` | Label for the OIDC login button | `Kirjaudu Tunnuksella` |
| `OIDC_GROUP_ROLE_MAP` | JSON mapping of group names to roles | `{"admin":"admin","/admin":"admin"}` |
| `ALLOW_LOCAL_ADMIN` | Allow password login when `AUTH_MODE=oidc` | `false` |

## 🔒 Security Notes

⚠️ **Important for Production:**

- **Set a strong `JWT_SECRET`** (at least 32 random characters). Generate with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- **Change default admin credentials** (`ADMIN_USERNAME`, `ADMIN_PASSWORD`)
- **Set `CORS_ORIGIN`** to your frontend's URL to restrict cross-origin access
- **Use a strong database password** — do not use the default `postgres/postgres`
- Enable HTTPS/SSL (via a reverse proxy like Nginx or Caddy)
- Enable regular database backups

## 📊 Development Status

### ✅ Completed

- Database schema design with 11 migrations
- Backend API with all core endpoints (public & admin)
- React 19 frontend with routing and component library
- Multi-page questionnaire support with auto-reset
- Admin dashboard with full CRUD interfaces (locations, questions, questionnaires, schedules, scales, word sets, answer views)
- Location-based password authentication with JWT tokens
- Admin authentication via `httpOnly` cookies with CSRF protection
- Schedule timezone support for global deployments
- Analytics dashboard with radar chart visualizations for multi-scale questions
- Data export (CSV) with pagination
- OpenAPI 3.0 specification
- Comprehensive documentation (CLAUDE.md, SETUP.md, TESTING.md, ROLLBACK.md)
- Anonymous feedback collection with privacy notice
- Docker containerization (backend + database)
- Automated deployment script with rollback guide
- Multi-language UI (English, Finnish, Swedish)
- Accessibility features (high-contrast mode, adjustable UI scaling)
- Security hardening (CSRF, CORS, rate limiting, input validation)
- Comprehensive test suite (auth, feedback, location groups, continuous scale)

### 🚧 In Progress / Planned

- QR code generation for location URLs
- Live dashboard with auto-refresh
- Role-based access control (read-only admins, etc.)
- Input length validation for text answers
- Cron/systemd setup documentation for automated deploys

For issues and detailed roadmap, see [PLAN.md](PLAN.md) and [TODO.md](TODO.md). Security review findings and fixes documented in [REVIEW.md](REVIEW.md).

## 📝 License

European Union Public Licence (EUPL-1.2). See [LICENSE](LICENSE) for details.
