#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting SourceTable..."

# Check if Poetry is installed
if ! command -v poetry &> /dev/null; then
    echo "❌ Poetry is not installed. Run to install: curl -sSL https://install.python-poetry.org | python3 -"
    exit 1
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
if [ ! -f "poetry.lock" ]; then
    poetry install --no-interaction
else
    poetry install --no-interaction --no-root
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
if [ ! -d "node_modules" ]; then
    npm install
fi

# Start FastAPI backend in background
echo "🔧 Starting FastAPI backend on port 8008..."
cd ../backend
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8008 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start Next.js frontend
echo "🎨 Starting Next.js frontend on port 3000..."
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo "✅ Application started!"
echo "📡 Backend API: http://localhost:8008"
echo "🌐 Frontend: http://localhost:3000"
echo "📚 API Docs: http://localhost:8008/docs"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
