# Deploying VigiLink to Render

This guide will help you deploy your VigiLink application to Render using Docker.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your code pushed to GitHub/GitLab/Bitbucket
3. Your Neon PostgreSQL database credentials (or use Render's PostgreSQL)

## Step 1: Prepare Your Repository

Make sure your code is committed and pushed to your Git repository:

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

## Step 2: Create a PostgreSQL Database on Render (Optional)

If you want to use Render's PostgreSQL instead of Neon:

1. Go to Render Dashboard → New → PostgreSQL
2. Name it `vigilink-db`
3. Choose a plan (Starter is fine for testing)
4. Note the connection details

**OR** continue using your Neon database (recommended if you already have data there).

## Step 3: Deploy Your Web Service

### Option A: Using render.yaml (Recommended)

1. **Update `render.yaml`**:
   - Replace `your-app-name.onrender.com` with your desired app name
   - Update database connection if using Render's PostgreSQL
   - Adjust plan sizes as needed

2. **In Render Dashboard**:
   - Go to Dashboard → New → Blueprint
   - Connect your repository
   - Render will detect `render.yaml` automatically
   - Click "Apply"

### Option B: Manual Setup

1. **Go to Render Dashboard** → New → Web Service
2. **Connect your repository** (GitHub/GitLab/Bitbucket)
3. **Configure the service**:
   - **Name**: `vigilink` (or your preferred name)
   - **Environment**: `Docker`
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.` (root directory)
   - **Plan**: Choose Starter, Standard, or Pro
   - **Branch**: `main` (or your default branch)

4. **Set Environment Variables**:
   Click "Advanced" → "Add Environment Variable" and add:

   **Required:**
   ```
   DJANGO_SECRET_KEY=your-production-secret-key-here
   DJANGO_DEBUG=false
   USE_POSTGRES=true
   ```

   **Database (if using Neon):**
   ```
   POSTGRES_DB=your_neon_db_name
   POSTGRES_USER=your_neon_user
   POSTGRES_PASSWORD=your_neon_password
   POSTGRES_HOST=your_neon_host.neon.tech
   POSTGRES_PORT=5432
   POSTGRES_SSLMODE=require
   ```

   **Database (if using Render PostgreSQL):**
   - Render automatically provides these if you link the database
   - Or manually set them from your Render database connection string

   **Application:**
   ```
   DJANGO_ALLOWED_HOSTS=your-app-name.onrender.com
   CSRF_TRUSTED_ORIGINS=https://your-app-name.onrender.com
   ```

   **Optional (if using):**
   ```
   EMAIL_HOST_USER=your-email@gmail.com
   EMAIL_HOST_PASSWORD=your-app-password
   DROPBOX_ACCESS_TOKEN=your-dropbox-token
   DROPBOX_REFRESH_TOKEN=your-dropbox-refresh-token
   DROPBOX_APP_KEY=your-dropbox-app-key
   DROPBOX_APP_SECRET=your-dropbox-app-secret
   ```

5. **Click "Create Web Service"**

## Step 4: Link Database (if using Render PostgreSQL)

1. In your web service settings
2. Go to "Connections" tab
3. Click "Link" next to your PostgreSQL database
4. Render will automatically set the database environment variables

## Step 5: Verify Deployment

1. **Check Build Logs**:
   - Go to your service → Logs
   - You should see:
     ```
     Running database migrations...
     Operations to perform: Apply all migrations...
     Starting gunicorn server...
     ```

2. **Check Runtime Logs**:
   - Look for "Application is live" message
   - No error messages

3. **Visit Your Site**:
   - Your app will be available at: `https://your-app-name.onrender.com`
   - Test the visitor log features

## Step 6: Update Environment Variables After First Deploy

After your first deployment, Render will give you the actual URL. Update:

1. Go to your service → Environment
2. Update `DJANGO_ALLOWED_HOSTS`:
   ```
   your-app-name.onrender.com
   ```
3. Update `CSRF_TRUSTED_ORIGINS`:
   ```
   https://your-app-name.onrender.com
   ```
4. Click "Save Changes" (this will trigger a redeploy)

## Important Notes

### ✅ What Happens Automatically

- **Migrations run automatically** on every deploy (via `entrypoint.sh`)
- **Static files are collected** during Docker build
- **Database connections** are handled automatically if using Render PostgreSQL
- **HTTPS is enabled** automatically by Render

### 🔧 Manual Steps You May Need

1. **Create a superuser** (first time only):
   - Go to your service → Shell
   - Run: `python manage.py createsuperuser`

2. **Set up your domain** (optional):
   - Go to Settings → Custom Domain
   - Add your domain
   - Update `DJANGO_ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS`

### 🚨 Troubleshooting

**Build Fails:**
- Check that `entrypoint.sh` exists and is executable
- Verify all files are committed to Git
- Check build logs for specific errors

**Migrations Not Running:**
- Check runtime logs for migration output
- Verify database connection is working
- Check environment variables are set correctly

**App Won't Start:**
- Check runtime logs for errors
- Verify `DJANGO_SECRET_KEY` is set
- Check database connection
- Verify `ALLOWED_HOSTS` includes your Render URL

**Static Files Not Loading:**
- Static files are collected during build (check build logs)
- WhiteNoise serves them automatically
- If issues persist, check `STATIC_ROOT` in settings

**Database Connection Issues:**
- Verify all `POSTGRES_*` variables are set
- Check SSL mode is `require` for external databases
- For Render PostgreSQL, ensure database is linked

## Updating Your Deployment

When you make changes:

1. **Commit and push**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Render automatically**:
   - Detects the push
   - Rebuilds the Docker image
   - Runs migrations (via entrypoint.sh)
   - Restarts the service

3. **Monitor the deployment**:
   - Go to your service → Events
   - Watch the build and deploy progress

## Cost Considerations

- **Starter Plan**: Free tier available (with limitations)
- **Standard Plan**: ~$7/month (better performance)
- **Pro Plan**: ~$25/month (production-ready)

PostgreSQL database is separate pricing.

## Security Checklist

- ✅ `DJANGO_DEBUG=false` in production
- ✅ Strong `DJANGO_SECRET_KEY` (use a generator)
- ✅ `ALLOWED_HOSTS` set correctly
- ✅ `CSRF_TRUSTED_ORIGINS` includes your domain
- ✅ Database credentials are secure (not in code)
- ✅ HTTPS enabled (automatic on Render)

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Check your service logs for specific errors

