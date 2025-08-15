#!/bin/bash

echo "🚀 Nano LMS Installation Script"
echo "================================"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew is already installed"
fi

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    brew install node
else
    echo "✅ Node.js is already installed"
fi

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "📦 Installing PostgreSQL..."
    brew install postgresql
    brew services start postgresql
else
    echo "✅ PostgreSQL is already installed"
fi

# Create database
echo "🗄️  Creating database..."
createdb nano_lms 2>/dev/null || echo "Database 'nano_lms' already exists"

# Install dependencies
echo "📦 Installing dependencies..."
npm run install:all

# Copy environment file
echo "⚙️  Setting up environment..."
cp backend/env.example backend/.env

echo ""
echo "🎉 Installation complete!"
echo ""
echo "Next steps:"
echo "1. Edit backend/.env with your database credentials"
echo "2. Run: npm run db:migrate"
echo "3. Run: npm run db:seed"
echo "4. Run: npm run dev"
echo ""
echo "Default credentials:"
echo "- Admin: admin@nanolms.com / admin123"
echo "- Trainer: trainer@nanolms.com / trainer123"
echo "- Learner: learner@nanolms.com / learner123"
echo ""
echo "Access the application at:"
echo "- Frontend: http://localhost:5173"
echo "- Backend API: http://localhost:6001"
