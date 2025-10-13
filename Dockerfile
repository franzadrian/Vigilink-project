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
RUN python manage.py collectstatic --noinput

# Koyeb provides PORT; default to 8080 for local Docker runs
ENV PORT=8080

# Run via gunicorn (expand $PORT at runtime; default to 8080 locally)
CMD ["sh", "-c", "gunicorn vigilink.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 3 --timeout 120"]
