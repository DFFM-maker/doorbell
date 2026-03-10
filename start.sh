#!/bin/bash
# Start Video-Citofono backend
set -e
cd /opt/doorbell/backend
source venv/bin/activate
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
