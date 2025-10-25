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

Create a `.env` in the project root. Settings reads from environment, with safe defaults for local dev. Common variables:

```env
DJANGO_SECRET_KEY=change-me
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost

# Database: by default, settings uses SQLite for local dev.
# To use Postgres, set:
USE_POSTGRES=true
POSTGRES_DB=vigilink
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

# Email (optional for verification flows)
EMAIL_HOST=smtp.example.com
EMAIL_HOST_USER=user@example.com
EMAIL_HOST_PASSWORD=app-password
EMAIL_PORT=587
EMAIL_USE_TLS=true

# Dropbox (optional; used by user_panel Dropbox utilities)
DROPBOX_ACCESS_TOKEN=
DROPBOX_REFRESH_TOKEN=
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
```

Notes:

- If `USE_POSTGRES` is not set or false, the project will default to SQLite (`db.sqlite3`).
- Static files are served via Django in dev; production uses WhiteNoise (see `Dockerfile`).

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

- Migration conflicts or duplicate tables
  - Use `showmigrations` and optionally `--fake` for already-existing schema.
- Static files not loading in production
  - Verify `collectstatic` ran and WhiteNoise is enabled (see `settings.py`).
- Email delivery
  - Use console backend in dev or configure SMTP creds via `.env`.
