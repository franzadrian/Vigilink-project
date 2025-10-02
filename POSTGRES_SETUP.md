# PostgreSQL Setup Guide for Vigilink

## Installation

1. Download and install PostgreSQL from the [official website](https://www.postgresql.org/download/windows/)
2. During installation:
   - Set password to: `vigilink`
   - Keep the default port: `5432`
   - Complete the installation

## Database Setup

After installation, set up the database:

1. Open pgAdmin (installed with PostgreSQL)
2. Create a new login role:
   - Name: `vigilink_user`
   - Password: `vigilink`
   - Privileges: Can login, Create database

3. Create a new database:
   - Name: `vigilink_db`
   - Owner: `vigilink_user`

## Connecting Django to PostgreSQL

The project is already configured to use PostgreSQL when the `USE_POSTGRES` environment variable is set.

### To use PostgreSQL:

1. Set the environment variable before running the server:
   ```
   # Windows PowerShell
   $env:USE_POSTGRES = "True"
   python manage.py runserver
   
   # Windows Command Prompt
   set USE_POSTGRES=True
   python manage.py runserver
   ```

2. Migrate your database:
   ```
   # With USE_POSTGRES environment variable set
   python manage.py migrate
   ```

### To switch back to SQLite:

Simply run the server without setting the `USE_POSTGRES` environment variable.

## Troubleshooting

- If you encounter connection issues, verify PostgreSQL service is running
- Check that the database and user were created correctly
- Ensure the password matches what's in settings.py