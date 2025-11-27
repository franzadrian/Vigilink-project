#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput
# Note: Warnings about "changes that are not yet reflected" for DropboxStorage fields are harmless
# These are storage configuration changes, not database schema changes

echo "Starting gunicorn server..."
exec gunicorn vigilink.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 3 --timeout 120

