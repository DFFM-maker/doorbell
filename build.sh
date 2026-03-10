#!/bin/bash
# Build frontend and place dist in backend serve path
set -e
echo "Building React frontend..."
cd /opt/doorbell/frontend
npm run build
echo "Build complete. Dist at /opt/doorbell/frontend/dist"
