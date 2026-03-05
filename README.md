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

Build the frontend and serve the `dist/` output with any static web server (Nginx, Caddy, etc.):

```bash
cd frontend
npm install
npm run build
# Serve dist/ directory, or symlink it into your web server's document root
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
- **Node.js** with Express
- **PostgreSQL** database
- **JWT** authentication
- **Jest** for testing

### Frontend
- **React** 19
- **React Router** for routing
- **Vite** for building
- **i18next** for internationalization (English, Finnish, Swedish)

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

### Key Admin Endpoints

- `POST /api/admin/login` - Admin login (rate-limited)
- `GET /api/admin/locations` - List locations
- `GET /api/admin/results` - Get feedback results
- `GET /api/admin/export` - Export results as CSV

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

- Database schema design
- Backend API with all core endpoints
- React frontend with routing
- Feedback UI with multi-page support
- Admin dashboard with authentication
- JWT-based security
- Data export functionality
- OpenAPI specification
- Comprehensive documentation
- Anonymous feedback with privacy notice
- Docker containerization (backend)
- Automated deployment script

### 🚧 In Progress

- Full admin CRUD interfaces
- Advanced analytics and charts
- Word cloud visualization

### 📋 Planned

- Multi-language support enhancements
- QR code generation
- Live dashboard
- Role-based access control

For the complete roadmap, see [PLAN.md](PLAN.md) and [TODO.md](TODO.md).

## 📝 License

ISC
