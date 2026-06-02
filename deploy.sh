#!/bin/bash

# Deploy script for Replit
set -e

echo "🚀 Deploying application..."

# Install backend dependencies
cd backend
poetry install --no-interaction

# Build frontend
cd ../frontend
npm install
npm run build

echo "✅ Deployment complete!"

