# Setup Guide - Simple Feedback App

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18 or higher
- **PostgreSQL** v13 or higher
- **npm** or **yarn** package manager

## Quick Start

If you use Docker for PostgreSQL, you can start everything from the repository root:

```bash
npm install
npm run install:all
npm run dev:setup
npm run dev
```

Service-specific root commands are also available:

```bash
npm run dev:db
npm run dev:backend
npm run dev:frontend
```

### 1. Clone the Repository

```bash
git clone https://github.com/jsilvanus/simple-feedback.git
cd simple-feedback
```

### 2. Set Up the Database

Create a PostgreSQL database:

```bash
createdb simple_feedback
```

Initialize the database schema:

```bash
cd backend
psql -h localhost -U postgres simple_feedback < src/db/schema.sql
```

Or if you prefer to use the npm script:

```bash
npm run db:init
```

### 3. Configure the Backend

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your database credentials and other settings:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=simple_feedback
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your-super-secret-jwt-key-change-in-production

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### 4. Install Backend Dependencies

```bash
cd backend
npm install
```

### 5. Start the Backend Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The backend API will be available at `http://localhost:3000`

### 6. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### 7. Start the Frontend Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Testing the Application

### Add Sample Data

You can add sample data through the admin interface or directly via SQL:

```sql
-- Add a location
INSERT INTO locations (slug, name, active) 
VALUES ('lobby', 'Main Lobby', true);

-- Add an answer scale
INSERT INTO answer_scales (name, buttons) 
VALUES ('satisfaction', '[
  {"label": "😞", "value": 1, "color": "#e74c3c"},
  {"label": "😐", "value": 2, "color": "#f39c12"},
  {"label": "🙂", "value": 3, "color": "#3498db"},
  {"label": "😀", "value": 4, "color": "#2ecc71"}
]');

-- Add a question
INSERT INTO questions (text, type) 
VALUES ('How satisfied are you with our service?', 'scale');

-- Add a questionnaire
INSERT INTO questionnaires (name, description) 
VALUES ('Lobby Feedback', 'Quick feedback survey for lobby visitors');

-- Link question to questionnaire
INSERT INTO questionnaire_questions (questionnaire_id, question_id, page_number, answer_scale_id, order_index)
VALUES (1, 1, 1, 1, 0);

-- Schedule the questionnaire
INSERT INTO schedules (location_id, questionnaire_id, start_time, end_time)
VALUES (1, 1, NOW(), NOW() + INTERVAL '1 year');
```

### Access the Application

1. **Home Page**: Visit `http://localhost:5173/`
2. **Feedback Interface**: Visit `http://localhost:5173/lobby` (or any location slug)
3. **Admin Dashboard**: Visit `http://localhost:5173/admin` (default credentials: admin/admin123)

## Running Tests

### Backend Tests

```bash
cd backend
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Building for Production

### Build Frontend

```bash
cd frontend
npm run build
```

The built files will be in the `frontend/dist` directory.

### Deploy Backend

Set `NODE_ENV=production` and ensure all production environment variables are configured:

```bash
cd backend
NODE_ENV=production npm start
```

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure the database exists: `psql -l | grep simple_feedback`

### Port Already in Use

If port 3000 or 5173 is already in use, you can change it:

- Backend: Edit `PORT` in `backend/.env`
- Frontend: Edit `server.port` in `frontend/vite.config.js`

### Cannot Access Admin

Default admin credentials are:
- Username: `admin`
- Password: `admin123`

These can be changed in `backend/.env`:
```env
ADMIN_USERNAME=your_username
ADMIN_PASSWORD=your_password
```

## Next Steps

1. Read the [API Documentation](api-spec.yaml) to understand available endpoints
2. Explore the [Development Plan](../PLAN.md) for upcoming features
3. Customize the UI colors and branding in the CSS files
4. Set up proper user authentication (move from hardcoded admin to database)

## Security Notes

⚠️ **Important for Production:**

1. Change the default admin credentials
2. Use a strong `JWT_SECRET`
3. Set up HTTPS/SSL
4. Configure CORS properly
5. Enable rate limiting
6. Set up database backups
7. Use environment-specific configurations

## Support

For issues or questions, please refer to the main [README](../README.md) or create an issue in the repository.
