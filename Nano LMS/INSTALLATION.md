# Nano LMS Installation Guide

This guide will help you set up and run the Nano LMS project on your Mac.

## Prerequisites

Before starting, ensure you have the following installed:
- macOS (tested on macOS 12+)
- Terminal access
- Internet connection

## Quick Installation

### Option 1: Automated Installation (Recommended)

1. **Run the installation script:**
   ```bash
   ./install.sh
   ```

   This script will automatically:
   - Install Homebrew (if not already installed)
   - Install Node.js and PostgreSQL
   - Create the database
   - Install all dependencies
   - Set up environment files

### Option 2: Manual Installation

If you prefer to install manually, follow these steps:

#### 1. Install Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. Install Node.js and PostgreSQL
```bash
brew install node
brew install postgresql
brew services start postgresql
```

#### 3. Create Database
```bash
createdb nano_lms
```

#### 4. Install Dependencies
```bash
npm run install:all
```

#### 5. Set Up Environment
```bash
cp backend/env.example backend/.env
```

## Configuration

### 1. Database Configuration

Edit `backend/.env` and update the database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nano_lms
DB_USER=postgres
DB_PASSWORD=your_password
```

**Note:** If you're using the default PostgreSQL installation on Mac, you might not need a password. In that case, leave `DB_PASSWORD` empty or remove the line.

### 2. JWT Secret

Generate a secure JWT secret and update it in `backend/.env`:

```env
JWT_SECRET=your_super_secret_jwt_key_here
```

You can generate a secure key using:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Database Setup

### 1. Run Migrations
```bash
cd backend
npm run db:migrate
```

### 2. Seed Initial Data
```bash
npm run db:seed
```

This will create:
- Default admin user
- Sample trainer and learner accounts
- Sample courses and lessons

## Running the Application

### 1. Start Both Servers
```bash
npm run dev
```

This will start:
- Backend API server on http://localhost:6001
- Frontend development server on http://localhost:5173

### 2. Access the Application

Open your browser and navigate to:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:6001

## Default Login Credentials

After running the seed script, you can log in with these accounts:

### Admin Account
- **Email:** admin@nanolms.com
- **Password:** admin123
- **Permissions:** Full system access, user management, course management

### Trainer Account
- **Email:** trainer@nanolms.com
- **Password:** trainer123
- **Permissions:** Course creation, lesson management, quiz creation

### Learner Account
- **Email:** learner@nanolms.com
- **Password:** learner123
- **Permissions:** Course enrollment, lesson viewing, quiz taking

## Project Structure

```
nano-lms/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   ├── database/       # Database connection & migrations
│   │   └── utils/          # Utility functions
│   ├── uploads/            # File storage
│   └── package.json        # Backend dependencies
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── contexts/      # React contexts
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
│   └── package.json        # Frontend dependencies
├── package.json            # Root package.json
├── install.sh             # Installation script
└── README.md              # Project documentation
```

## Development Commands

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data
npm test            # Run tests
```

### Frontend Development
```bash
cd frontend
npm run dev         # Start development server
npm run build       # Build for production
npm test           # Run tests
```

### Root Commands
```bash
npm run dev         # Start both frontend and backend
npm run install:all # Install all dependencies
npm run build       # Build frontend for production
```

## Troubleshooting

### Common Issues

#### 1. PostgreSQL Connection Error
**Error:** `connection to server at "localhost" (127.0.0.1), port 5432 failed`
**Solution:**
```bash
brew services restart postgresql
```

#### 2. Port Already in Use
**Error:** `EADDRINUSE: address already in use :::6001`
**Solution:**
```bash
# Find and kill the process using the port
lsof -ti:6001 | xargs kill -9
```

#### 3. Database Migration Fails
**Error:** `relation "users" already exists`
**Solution:**
```bash
# Drop and recreate the database
dropdb nano_lms
createdb nano_lms
npm run db:migrate
npm run db:seed
```

#### 4. Node Modules Issues
**Error:** `Cannot find module`
**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
npm run install:all
```

### Getting Help

If you encounter any issues not covered in this guide:

1. Check the console output for error messages
2. Verify all prerequisites are installed correctly
3. Ensure PostgreSQL is running: `brew services list | grep postgresql`
4. Check that the database exists: `psql -l | grep nano_lms`

## Next Steps

Once the application is running successfully:

1. **Explore the Features:**
   - Log in as different user types to see role-based access
   - Browse courses and lessons
   - Try the quiz functionality
   - Generate certificates

2. **Customize the Application:**
   - Modify the database schema in `backend/src/database/migrate.js`
   - Add new API endpoints in `backend/src/routes/`
   - Update the UI components in `frontend/src/components/`

3. **Production Deployment:**
   - Set up environment variables for production
   - Configure a production database
   - Set up proper SSL certificates
   - Configure a reverse proxy (nginx)

## Support

For additional support or questions:
- Check the project documentation in `README.md`
- Review the API documentation in the backend routes
- Examine the database schema in the migration files
