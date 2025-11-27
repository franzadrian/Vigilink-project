FROM python:3.13-slim

# Ensure Python output is unbuffered and no .pyc files
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Collect static files (served by WhiteNoise in production)
# Set DEBUG=False and a dummy SECRET_KEY during build to ensure proper static file collection
# These env vars are only for the collectstatic command
RUN DJANGO_DEBUG=false SECRET_KEY=dummy-key-for-static-collection-only python manage.py collectstatic --noinput

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Render/Platform provides PORT; default to 8080 for local Docker runs
ENV PORT=8080

# Run migrations and start server via entrypoint script
CMD ["/app/entrypoint.sh"]
