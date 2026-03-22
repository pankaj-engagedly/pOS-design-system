# Google Photos Integration — Setup Guide

This guide walks you through setting up Google Photos sync for pOS. After setup, pOS will automatically pull your Google Photos library (photos, videos, albums) into your local pOS instance.

**This is a one-time setup per pOS instance.** Once configured, all pOS users can connect their Google accounts.

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown (top-left) → **New Project**
3. Name it **pOS Photos** (or any name you prefer)
4. Click **Create**
5. Make sure the new project is selected in the dropdown

## 2. Enable the Photos Library API

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for **Photos Library API**
3. Click on it, then click **Enable**
4. Wait for it to activate (takes a few seconds)

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Select **External** as the user type, click **Create**
3. Fill in the required fields:
   - **App name**: `pOS Photos`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue** through the Scopes and Test Users pages
5. On the **Test Users** page:
   - Click **Add Users**
   - Enter the Google account email(s) you want to connect to pOS
   - Click **Save**

> **Important**: While the app is in "Testing" mode, only accounts listed as test users can connect. This is fine for personal use — you only need to add your own account(s). You can add up to 100 test users.

## 4. Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Select **Web application** as the application type
4. Set the name to **pOS Photos**
5. Under **Authorized redirect URIs**, click **Add URI** and enter:
   ```
   http://localhost:8000/api/photos/sources/google/callback
   ```
   > If you're running pOS on a different host/port, adjust accordingly.
6. Click **Create**
7. A dialog shows your **Client ID** and **Client Secret** — copy both

## 5. Configure pOS Environment Variables

Set these environment variables for the photos service. You can add them to your shell profile, a `.env` file in the photos service directory, or export them before starting pOS:

```bash
export GOOGLE_CLIENT_ID="your-client-id-here.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret-here"
```

The redirect URI defaults to `http://localhost:8000/api/photos/sources/google/callback`. If you need a different one, also set:

```bash
export GOOGLE_REDIRECT_URI="http://your-host:8000/api/photos/sources/google/callback"
```

### Using a `.env` file

Create or edit `backend/services/photos/.env`:

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

## 6. Verify the Setup

1. Restart the pOS stack: `make stop && make dev`
2. Open pOS Photos in your browser
3. Click the **settings cog** icon in the header
4. You should see a **"Connect Google Photos"** button in the dialog
5. Click it — you'll be redirected to Google's consent screen
6. Authorize access — you'll be redirected back to pOS
7. Your Google Photos will begin syncing automatically (every 5 minutes)

You can also verify programmatically:

```bash
curl http://localhost:8000/api/photos/sources/providers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Look for `"google_photos"` with `"available": true` in the response.

## Troubleshooting

### "Google Photos" option not showing in the UI
- Verify `GOOGLE_CLIENT_ID` is set: check if the env var is loaded by the photos service
- Restart the service after setting env vars
- Check the `/providers` endpoint response

### "redirect_uri_mismatch" error
- The redirect URI in Google Cloud Console must **exactly match** the one pOS sends
- Default is `http://localhost:8000/api/photos/sources/google/callback`
- Check for trailing slashes, protocol (http vs https), and port differences

### "access_denied" error
- Your Google account must be added as a **test user** in the OAuth consent screen
- Go to Google Cloud Console → OAuth consent screen → Test Users → Add your email

### "Google access revoked — reconnect in Settings"
- You (or Google) revoked access. Go to pOS Photos settings and reconnect
- This can also happen if you change your Google password or revoke access at https://myaccount.google.com/permissions

### Sync seems slow / "API quota reached"
- Google Photos API has a limit of ~10,000 requests/day
- For large libraries (10k+ photos), the first sync may take multiple cycles
- Sync progress is saved — it resumes where it left off automatically
- You can see the photo count increasing in the source dialog

### Videos not generating thumbnails
- Make sure `ffmpeg` is installed: `brew install ffmpeg` (macOS)
- The service logs a warning at startup if ffmpeg is missing
