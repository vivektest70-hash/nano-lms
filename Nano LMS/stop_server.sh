#!/bin/bash

echo "🛑 Stopping Animaker Nano LMS Servers..."
echo "========================================"

# Kill backend processes
echo "🔧 Stopping Backend Server..."
pkill -f "node.*server.js" 2>/dev/null || true

# Kill frontend processes
echo "🎨 Stopping Frontend Server..."
pkill -f "vite" 2>/dev/null || true

# Kill any remaining Node.js processes on our ports
echo "🧹 Cleaning up processes..."
lsof -ti:6001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Remove PID file
rm -f .server-pids

echo "✅ All servers stopped successfully!"
echo "🔄 You can restart them anytime with: ./start-servers.sh"
