# Simple Feedback App

A configurable feedback application for tablets in kiosk mode and mobile browsers.

## Project Structure

```
├── backend/          # Node.js/Express API server
├── frontend/         # Frontend application (to be implemented)
├── docs/            # Documentation
└── PLAN.md          # Architecture and development plan
```

## Backend Setup

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)

### Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a PostgreSQL database:
   ```bash
   createdb simple_feedback
   ```

4. Initialize the database schema:
   ```bash
   npm run db:init
   ```

5. Copy the environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

The API server will start on `http://localhost:3000`

### API Endpoints

#### Public Endpoints

- `GET /health` - Health check
- `GET /api/locations/:slug/questionnaire` - Get active questionnaire for a location
- `POST /api/feedback` - Submit feedback

#### Admin Endpoints (requires authentication)

- `POST /api/admin/login` - Admin login
- `GET /api/admin/locations` - List locations
- `POST /api/admin/locations` - Create location
- `GET /api/admin/questions` - List questions
- `POST /api/admin/questions` - Create question
- `GET /api/admin/answer-scales` - List answer scales
- `POST /api/admin/answer-scales` - Create answer scale
- `GET /api/admin/questionnaires` - List questionnaires
- `POST /api/admin/questionnaires` - Create questionnaire
- `GET /api/admin/schedules` - List schedules
- `POST /api/admin/schedules` - Create schedule
- `GET /api/admin/results` - Get feedback results
- `GET /api/admin/export` - Export results as CSV

### Testing

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Development Status

See [PLAN.md](PLAN.md) for the complete architecture and development roadmap.

### Completed

- ✅ Database schema design
- ✅ Backend API skeleton
- ✅ Core API endpoints
- ✅ Authentication middleware
- ✅ Basic tests

### In Progress

- 🚧 Frontend application
- 🚧 Admin UI
- 🚧 Comprehensive testing

### Planned

- 📋 OpenAPI specification
- 📋 Word cloud features
- 📋 Advanced analytics
- 📋 Production deployment

## License

ISC
