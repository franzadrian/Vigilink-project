# Vigilink

Vigilink is a neighborhood safety watch system that helps subdivisions and communities coordinate residents, owners, and security. It offers resident alerts, incident reporting, community owner tools, messaging, and an admin view to review reports and communications.

This repository contains a Django 5 project with multiple apps:

- `accounts` — custom user model and onboarding
- `user_panel` — resident-facing dashboard, communication
- `communityowner_panel` — tools for community owners (members, emergency contacts, code)
- `resident_panel` — residents list and alerts
- `admin_panel` — admin views and contact messages

## Quick Start

Prerequisites:

- Python 3.11+ (3.13 supported)
- Pip / venv
- Git

Clone and set up a virtual environment:

```bash
git clone <your-repo-url>
cd Vigilink-project
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt  # if present; otherwise install Django and psycopg/psycopg2-binary as needed
```

If you don’t have `requirements.txt`, install the minimums:

```bash
pip install django==5.2.* psycopg[binary] pillow
```

## Configuration (.env)

**⚠️ CRITICAL**: The project uses environment variables for configuration. On a new machine, you MUST create a `.env` file to connect to the Neon database. **Without a `.env` file, the project will default to SQLite and use a local database instead of the shared Neon database.**

### Setup Steps:

1. **Copy the example file:**
   ```bash
   # Windows (PowerShell)
   Copy-Item .env.example .env
   
   # Linux/Mac
   cp .env.example .env
   ```

2. **Edit `.env` and fill in your actual values:**
   - **MOST IMPORTANT**: Make sure `USE_POSTGRES=true` is set (this is already in the example)
   - Update `POSTGRES_PASSWORD` with your actual Neon database password
   - Update other credentials as needed

The `.env` file is gitignored and won't be committed to the repository. Each developer needs to create their own `.env` file from `.env.example`.

### Environment Variables:

```env
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost

# Database: Set USE_POSTGRES=true to use Neon PostgreSQL
# If not set or false, defaults to SQLite (db.sqlite3)
USE_POSTGRES=true

# Neon PostgreSQL Database Connection
POSTGRES_DB=neondb
POSTGRES_USER=neondb_owner
POSTGRES_PASSWORD=your-password-here
POSTGRES_HOST=ep-shy-fire-a1ozash8-pooler.ap-southeast-1.aws.neon.tech
POSTGRES_PORT=5432
POSTGRES_SSLMODE=require

# Email Configuration (SendGrid recommended for production/Render)
# For local development, you can use Gmail or SendGrid
# SendGrid works on Render free tier (Gmail SMTP is blocked)
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG.your-sendgrid-api-key-here
# Note: EMAIL_HOST, EMAIL_PORT, EMAIL_USE_TLS are set in settings.py
# For Gmail (local dev only): EMAIL_HOST_USER=your-email@gmail.com, EMAIL_HOST_PASSWORD=app-password

# Dropbox (optional; used for file storage)
DROPBOX_ACCESS_TOKEN=
DROPBOX_REFRESH_TOKEN=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
```

**Important Notes:**

- **Without `.env` file OR if `USE_POSTGRES` is not set to `true`**: The project will default to SQLite (`db.sqlite3`) - you'll have a separate local database that won't sync with other developers
- **With `.env` file and `USE_POSTGRES=true`**: Connects to the shared Neon PostgreSQL database
- **Database credentials**: Get these from your Neon console at https://console.neon.tech
- The `.env` file is gitignored for security - each developer needs their own copy
- **After creating `.env`**: Restart your Django development server for changes to take effect

## Database Migrations

Create and apply migrations:

```bash
py manage.py makemigrations
py manage.py migrate
```

If you encounter duplicate-table errors when switching databases or states (e.g., Postgres already has a table), you can fake a specific migration:

```bash
py manage.py showmigrations app_label
py manage.py migrate communityowner_panel 0003_communitymembership --fake
py manage.py migrate
```

## Running the App

Start the development server:

```bash
py manage.py runserver
```

Open http://127.0.0.1:8000/

Create a superuser for admin access:

```bash
py manage.py createsuperuser
```

## Project Structure & Key Flows

- Resident Alerts (`resident_panel`)
  - Alerts page shows live counts: total residents (based on community membership), incident reports (ContactMessage with subject starting with "Report:"), upcoming events (static for now), and emergency contacts (owner-managed).
- Community Owner Panel (`communityowner_panel`)
  - Manage members (roles, block/lot), community profile, and emergency contacts via a modal.
  - Emergency Calls card highlights in yellow if no contacts exist and updates live when contacts are added/removed.
- Admin Panel (`admin_panel`)
  - Stores ContactMessage entries for incident reports and communications.

## Common Commands

Run tests (if added):

```bash
py manage.py test
```

Collect static files (production):

```bash
py manage.py collectstatic --noinput
```

Shell for debugging:

```bash
py manage.py shell
```

## Deployment (Docker Example)

The included `Dockerfile` builds a production image using gunicorn + WhiteNoise:

```bash
docker build -t vigilink:prod .
docker run -p 8080:8080 --env-file .env vigilink:prod
```

Ensure your `.env` contains production-safe values (secret key, database, email, allowed hosts).

## Troubleshooting

- **Using SQLite instead of Neon PostgreSQL after cloning**
  - **Problem**: After cloning the project, it's using `db.sqlite3` instead of your Neon database.
  - **Solution**: 
    1. Make sure you have a `.env` file in the project root (copy from `.env.example` if needed)
    2. Verify `USE_POSTGRES=true` is set in your `.env` file
    3. Check that all `POSTGRES_*` variables are filled in with correct values
    4. Restart your Django development server (`python manage.py runserver`)
    5. Verify connection by checking if you see your data from the Neon database
- Migration conflicts or duplicate tables
  - Use `showmigrations` and optionally `--fake` for already-existing schema.
- Static files not loading in production
  - Verify `collectstatic` ran and WhiteNoise is enabled (see `settings.py`).
- Email delivery
  - Use console backend in dev or configure SMTP creds via `.env`.
