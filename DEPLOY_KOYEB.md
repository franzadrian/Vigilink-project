# Deploying to Koyeb with Neon Postgres

This project is containerized (Dockerfile) and production-ready (Postgres via env vars, WhiteNoise for static files). Follow these steps to deploy on Koyeb using a free Neon database.

## 1) Create a Neon database
1. Go to https://neon.tech → Create Project
2. Choose Postgres 16 (or latest), AWS, a nearby region
3. In Connection Details, copy:
   - Host (use the pooler host: `...-pooler.neon.tech`)
   - Database (default: `neondb`)
   - User (default: `neondb_owner`)
   - Password
   - Port: `5432`
4. Neon requires SSL. We’ll set `PGSSLMODE=require` in env vars.

> Optional: create your own DB/user
```sql
CREATE ROLE vigilink_user LOGIN PASSWORD 'strong-password';
CREATE DATABASE vigilink_db OWNER vigilink_user;
GRANT ALL PRIVILEGES ON DATABASE vigilink_db TO vigilink_user;
```

## 2) Prepare env vars
Copy `.env.example` to `.env` and fill in your Neon values for local testing, or use these keys on Koyeb:

Required
- `DJANGO_DEBUG=False`
- `SECRET_KEY=<long random string>`
- `ALLOWED_HOSTS=<your-app>.koyeb.app`
- `CSRF_TRUSTED_ORIGINS=https://<your-app>.koyeb.app`
- `POSTGRES_DB=...` (e.g., `neondb`)
- `POSTGRES_USER=...` (e.g., `neondb_owner`)
- `POSTGRES_PASSWORD=...`
- `POSTGRES_HOST=...-pooler.neon.tech`
- `POSTGRES_PORT=5432`
- `POSTGRES_CONN_MAX_AGE=60`
- `PGSSLMODE=require`

Optional
- `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` (production email)
- `DROPBOX_ACCESS_TOKEN` (if sending images to Dropbox)

## 3) Deploy on Koyeb
1. Push your repo (with Dockerfile) to GitHub
2. In Koyeb: Create Service → GitHub → select repo/branch
3. Koyeb detects the Dockerfile and builds the image
4. Add the env vars above
5. Deploy the service

## 4) Initialize the database (one-time)
In Koyeb → your service → Exec (shell):
```
python manage.py migrate
python manage.py populate_locations
python manage.py createsuperuser  # optional
```

## 5) Verify
Open `https://<your-app>.koyeb.app` and test:
- Register/login and `/admin`
- Chat (send/delete messages) — deleted should show immediately
- Image uploads (Dropbox)

## Local Docker (optional)
```
docker build -t vigilink .
docker run --rm --env-file .env vigilink python manage.py migrate
docker run -p 8080:8080 --env-file .env vigilink
# open http://localhost:8080
```

