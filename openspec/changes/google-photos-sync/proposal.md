## Why

pOS Photos currently supports local folder watching and Apple Photos Library as sync sources. Google Photos is the most widely used cloud photo service, and many users have years of photo history stored there. Adding Google Photos as a sync provider lets users pull their entire cloud library into pOS with album mapping, metadata preservation, and incremental sync — completing the trifecta of photo sources (local, Apple, cloud).

## What Changes

- Add Google OAuth2 flow to the photos service (authorize → callback → token storage with auto-refresh)
- New `google_photos` sync provider that pulls media items via the Google Photos Library API
- Map Google Photos albums to pOS albums, preserve metadata (dates, descriptions, camera info)
- Incremental sync using Google Photos API pagination and `nextPageToken` tracking
- Store OAuth tokens securely in the `photo_sources` config JSONB column (encrypted refresh token)
- Add `google_photos` to the `/providers` endpoint with connection status
- Frontend: "Connect Google Photos" flow in the source dialog (OAuth redirect → callback → connected state)
- Setup documentation: how to create a Google Cloud project, enable Photos Library API, and configure OAuth credentials

## Capabilities

### New Capabilities
- `google-oauth`: OAuth2 authorization flow for Google — authorize URL generation, callback handling, token storage and refresh, disconnect/revoke
- `google-photos-provider`: Google Photos sync provider — media item discovery, download, album mapping, metadata extraction, incremental sync via page tokens
- `google-photos-setup-guide`: User-facing documentation for Google Cloud project setup, OAuth credentials configuration, and environment variables

### Modified Capabilities

_(none — the existing source CRUD, scheduler, and provider infrastructure already support adding new providers without spec-level changes)_

## Impact

- **Backend photos service**: New OAuth routes (`/api/photos/sources/google/auth`, `/api/photos/sources/google/callback`), new sync module (`service_sync_google.py`), provider entry in routes_sources
- **Dependencies**: `google-auth`, `google-auth-oauthlib`, `httpx` (for API calls — already available)
- **Configuration**: New env vars `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Database**: No schema changes — OAuth tokens stored in existing `photo_sources.config` JSONB column
- **Frontend source dialog**: New "Connect Google Photos" button with OAuth flow, connected account display
- **Security**: Refresh tokens encrypted at rest using existing Fernet encryption pattern (HKDF from APP_SECRET_KEY)
- **Documentation**: New `docs/google-photos-setup.md` with step-by-step Google Cloud Console instructions
