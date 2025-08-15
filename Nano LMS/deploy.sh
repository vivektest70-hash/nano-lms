#!/bin/bash

echo "🚀 Deploying Nano LMS to Vercel + Supabase"
echo "=========================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "📦 Installing Supabase CLI..."
    npm install -g supabase
fi

# Build the frontend
echo "🔨 Building frontend..."
cd frontend
npm run build
cd ..

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

# Deploy Supabase functions
echo "🗄️ Deploying Supabase functions..."
cd supabase
supabase functions deploy api --project-ref zbuhxdonhlibopcgzmig
cd ..

echo "✅ Deployment complete!"
echo "🌐 Your app is now live at: https://your-vercel-url.vercel.app"
