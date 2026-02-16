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

## 📋 Quick Start

For detailed setup instructions, see the [Setup Guide](docs/SETUP.md).

### Prerequisites

- Node.js v18+
- PostgreSQL v13+

### Installation

1. Clone the repository
2. Set up PostgreSQL database
3. Configure backend `.env` file
4. Install dependencies and start servers

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (in another terminal)
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` to see the application.

## 📚 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration
- **[API Specification](docs/api-spec.yaml)** - OpenAPI 3.0 specification
- **[Development Plan](PLAN.md)** - Architecture and roadmap

## 🏗️ Project Structure

```
├── backend/          # Node.js/Express API server
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── db/       # Database connection and schema
│   │   └── app.js    # Express application
│   └── tests/        # Backend tests
├── frontend/         # React frontend application
│   ├── src/
│   │   ├── pages/    # Page components
│   │   ├── api/      # API client
│   │   └── App.jsx   # Main app component
│   └── index.html    # HTML entry point
├── docs/             # Documentation
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
- Vanilla CSS with modern features

## 🔧 Development

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
- `POST /api/feedback` - Submit feedback

### Key Admin Endpoints

- `POST /api/admin/login` - Admin login
- `GET /api/admin/locations` - List locations
- `GET /api/admin/results` - Get feedback results
- `GET /api/admin/export` - Export results as CSV

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

### 🚧 In Progress

- Full admin CRUD interfaces
- Advanced analytics and charts
- Word cloud visualization

### 📋 Planned

- Multi-language support
- QR code generation
- Live dashboard
- Role-based access control
- Production deployment guides

For the complete roadmap, see [PLAN.md](PLAN.md).

## 🔒 Security Notes

⚠️ **Important for Production:**

- Change default admin credentials
- Use strong JWT secret
- Enable HTTPS/SSL
- Configure CORS properly
- Set up rate limiting
- Enable database backups

## 📝 License

ISC
