# Nano LMS

A modern Learning Management System with AI-powered features, built with React, Node.js, and PostgreSQL.

## Features

### Phase 1 - Core MVP
- ✅ User Authentication (Admin, Trainer, Learner roles)
- ✅ Course Authoring with WYSIWYG editor
- ✅ Video player with chapter bookmarks
- ✅ Quiz creation and grading
- ✅ Certificate generation
- ✅ User management dashboard
- ✅ Local file storage

### Phase 2 - Enhancements (Coming Soon)
- 🤖 AI course generation
- 🤖 AI quiz creation
- 📱 Mobile app
- 🔄 HR tool integration
- 📦 Offline access packs

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Node.js + Express + JWT
- **Database**: PostgreSQL
- **Storage**: Local server storage
- **UI Components**: Headless UI + Heroicons

## Quick Start

### Prerequisites

1. **Install Homebrew** (if not already installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. **Install Node.js and PostgreSQL**:
```bash
brew install node
brew install postgresql
brew services start postgresql
```

3. **Create PostgreSQL database**:
```bash
createdb nano_lms
```

### Installation

1. **Clone and install dependencies**:
```bash
git clone <your-repo-url>
cd nano-lms
npm run install:all
```

2. **Environment Setup**:
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials
```

3. **Database Setup**:
```bash
cd backend
npm run db:migrate
npm run db:seed
```

4. **Start Development Servers**:
```bash
npm run dev
```

5. **Access the Application**:
- Frontend: http://localhost:5173
- Backend API: http://localhost:6001

## Default Admin Credentials

- **Email**: admin@nanolms.com
- **Password**: admin123

## Project Structure

```
nano-lms/
├── backend/                 # Node.js + Express API
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Custom middleware
│   │   └── utils/          # Utility functions
│   └── uploads/            # File storage
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API services
│   │   └── utils/         # Utility functions
└── docs/                  # Documentation
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users (Admin only)
- `POST /api/users` - Create new user (Admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Courses
- `GET /api/courses` - Get all courses
- `POST /api/courses` - Create course (Trainer/Admin)
- `GET /api/courses/:id` - Get course details
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course

### Lessons
- `GET /api/courses/:courseId/lessons` - Get course lessons
- `POST /api/courses/:courseId/lessons` - Add lesson
- `PUT /api/lessons/:id` - Update lesson
- `DELETE /api/lessons/:id` - Delete lesson

## Development

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
