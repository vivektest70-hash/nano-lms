#!/usr/bin/env bash
set -Eeuo pipefail

echo "⚡ Quick Start - Animaker Nano LMS"
echo "=================================="

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# --- config ---
BACKEND_DIR="backend"
FRONTEND_DIR="frontend"
BACKEND_PORT="${PORT:-6001}"   # honors PORT if you set it
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:${BACKEND_PORT}"

# --- preflight checks ---
[[ -d "$BACKEND_DIR" ]] || { echo "❌ '$BACKEND_DIR' directory not found"; exit 1; }
if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "⚠️  '$FRONTEND_DIR' directory not found. I'll start only the backend."
  START_FRONTEND=false
else
  START_FRONTEND=true
fi

# --- free the backend port if something is already listening ---
if lsof -t -i:"$BACKEND_PORT" >/dev/null 2>&1; then
  echo "🔪 Killing processes on :$BACKEND_PORT"
  lsof -t -i:"$BACKEND_PORT" | xargs -r kill -9 || true
fi

# Ensure child processes die with this script
cleanup() {
  echo -e "\n🧹 Stopping children..."
  pkill -P $$ || true
}
trap cleanup EXIT

# --- start backend ---
echo "🔧 Starting backend on :$BACKEND_PORT..."
(
  cd "$BACKEND_DIR"
  # if your backend uses PORT env, pass it here:
  PORT="$BACKEND_PORT" npm run start
) &

# --- wait until backend is actually listening ---
echo "⏳ Waiting for backend to listen on :$BACKEND_PORT ..."
for i in {1..40}; do
  if lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✅ Backend is listening on $BACKEND_URL"
    break
  fi
  sleep 0.5
  if [[ $i -eq 40 ]]; then
    echo "❌ Backend failed to start on :$BACKEND_PORT"
    exit 1
  fi
done

# --- start frontend (optional) ---
if $START_FRONTEND; then
  echo "🎨 Starting frontend..."
  ( cd "$FRONTEND_DIR" && npm run dev ) &
else
  echo "🎨 Skipping frontend (folder missing)"
fi

echo ""
echo "🎉 Servers starting..."
echo "🔧 Backend:  $BACKEND_URL"
$START_FRONTEND && echo "🌐 Frontend: $FRONTEND_URL"
echo ""
echo "👤 Login: admin@animaker.com / password123"
echo "🛑 Press Ctrl+C to stop"
echo ""

# keep the script alive while children run
wait

