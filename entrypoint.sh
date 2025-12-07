#!/bin/sh
set -e

echo "Running database migrations..."
python manage.py migrate --noinput
# Note: Warnings about "changes that are not yet reflected" for DropboxStorage fields are harmless
# These are storage configuration changes, not database schema changes

echo "Checking if cities need to be populated..."
python -c "
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vigilink.settings')
django.setup()
from accounts.models import City
if City.objects.count() == 0:
    from django.core.management import call_command
    call_command('populate_locations')
    print('Cities populated successfully')
else:
    print('Cities already exist, skipping population')
" || echo "City population check failed (this is OK if cities already exist)"

echo "Starting gunicorn server..."
exec gunicorn vigilink.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 3 --timeout 120

