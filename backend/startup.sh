#!/bin/bash
# Azure App Service (Linux, Python) startup command.
# Configure this as the App Service "Startup Command":
#   bash startup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[startup] Applying database migrations..."
python manage.py migrate --noinput

echo "[startup] Collecting static files..."
python manage.py collectstatic --noinput

echo "[startup] Starting gunicorn on port ${PORT:-8000}..."
exec gunicorn config.wsgi:application \
  --bind="0.0.0.0:${PORT:-8000}" \
  --workers "${GUNICORN_WORKERS:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-600}" \
  --access-logfile "-" \
  --error-logfile "-"
