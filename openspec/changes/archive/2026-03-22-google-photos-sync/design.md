## Context

pOS Photos already supports two sync providers: folder watcher (local directory polling) and Apple Photos Library (via osxphotos). Both follow the same pattern: a `PhotoSource` record tracks the provider config, `scheduler.py` polls every 5 minutes, and each provider's sync function discovers files → deduplicates → imports into pOS storage.

Google Photos is the first cloud provider, which introduces new concerns: OAuth2 authentication, HTTP-based media downloads (vs. local file copies), API rate limits, and token lifecycle management. The Google Photos Library API provides read-only access to media items, albums, and metadata.

The existing infrastructure — `PhotoSource` model with JSONB `config` column, provider dispatch in `scheduler.py`, source CRUD routes, and the frontend source dialog — was designed to accommodate new providers. This change slots in as a new provider without schema migration.

## Goals / Non-Goals

**Goals:**
- OAuth2 flow to connect a Google account (authorize → callback → token storage)
- Incremental sync of all media items (photos + videos) from Google Photos
- Map Google Photos albums to pOS albums (with `album_type="google_sync"`)
- Preserve metadata: dates, descriptions, camera info, GPS coordinates
- Auto-refresh expired access tokens using stored refresh token
- Secure token storage (encrypted in `photo_sources.config`)
- User-facing setup guide for Google Cloud Console configuration

**Non-Goals:**
- Two-way sync (writing back to Google Photos) — pOS is read-only consumer
- Google Photos sharing/partner features
- Google Photos "smart" albums (these are not accessible via the API)
- Real-time push notifications (Google Photos has no webhook support) — poll-based only
- Batch downloading optimization (parallel downloads) — sequential is fine for v1
- Migration from Google Takeout export files

## Decisions

### 1. OAuth2 flow: server-side redirect (not popup)

The backend generates an authorization URL, the frontend redirects there, Google redirects back to a backend callback endpoint that exchanges the code for tokens, then redirects the frontend to a success page.

**Why not popup:** The source dialog runs inside shadow DOM with no ability to receive `postMessage` from a popup reliably. A full-page redirect is simpler, and we redirect back to `/photos` after success.

**Flow:**
1. Frontend calls `GET /api/photos/sources/google/auth` → gets `{ auth_url }`
2. Frontend does `window.location.href = auth_url`
3. Google redirects to `GET /api/photos/sources/google/callback?code=...&state=...`
4. Backend exchanges code for tokens, creates PhotoSource, redirects to `/#/photos?google_connected=1`

**State parameter:** Encodes `user_id` (signed with HMAC to prevent CSRF). The callback validates the signature before proceeding.

### 2. Token storage in `photo_sources.config` JSONB (encrypted)

OAuth tokens (access_token, refresh_token, expiry) are stored in the existing `config` JSONB column on `PhotoSource`. The refresh token is encrypted using the same Fernet/HKDF pattern as vault (`info=b"pos-google-oauth-token"` to keep key derivation separate).

```python
config = {
    "access_token": "ya29.xxx",           # plaintext (short-lived, 1hr)
    "refresh_token": "encrypted:gAAA...", # Fernet-encrypted
    "token_expiry": "2026-03-20T14:00:00Z",
    "google_email": "user@gmail.com",
    "next_page_token": null,              # for incremental sync
}
```

**Why encrypt only refresh_token:** Access tokens expire in 1 hour and are useless after. The refresh token is the long-lived secret that grants ongoing access — it's the one worth protecting at rest.

**Alternative considered:** Separate `oauth_tokens` table. Rejected because it adds a migration and the `config` column was designed exactly for this — provider-specific settings.

### 3. Token refresh: inline during sync

When the sync job runs, it checks `token_expiry`. If expired (or within 5 minutes of expiry), it refreshes the access token using the refresh token via Google's token endpoint before making API calls. The updated tokens are written back to `config`.

**No background refresh job.** Tokens only need to be fresh when we're about to use them. The scheduler already runs every 5 minutes, so checking/refreshing at sync time is sufficient.

### 4. Google Photos API client: httpx (not google-api-python-client)

Use `httpx` (already a project dependency) to call the Google Photos Library API directly via REST endpoints. The API surface we need is small:

- `GET /v1/mediaItems` — list all media items (paginated)
- `GET /v1/mediaItems/{id}` — get single item
- `GET /v1/albums` — list albums
- `GET /v1/albums/{id}/mediaItems` — search by album (via `POST /v1/mediaItems:search`)
- `POST /oauth2/v4/token` — refresh access token

**Why not google-api-python-client:** It's a heavyweight dependency (brings in `google-auth`, `google-api-core`, `uritemplate`, etc.), and we only need 4-5 REST endpoints. httpx keeps it lean and consistent with the rest of the codebase.

**Dependency additions:** `google-auth-oauthlib` for the initial OAuth2 flow (authorization URL + code exchange). After that, token refresh is a simple HTTP POST.

Actually, even simpler: we can handle the entire OAuth2 flow with httpx too. Google's OAuth2 is standard — authorize URL is just a parameterized redirect, and code exchange is a POST to `https://oauth2.googleapis.com/token`. **Zero new dependencies.**

### 5. Sync strategy: paginated full-scan with page token checkpoint

Google Photos API returns media items in reverse chronological order (newest first), paginated with `nextPageToken`. Our sync strategy:

- **First sync:** Page through ALL media items, importing each. Store the last `nextPageToken` as `null` (completed) and the most-recent mediaItem's `creationTime` as `last_sync_marker`.
- **Subsequent syncs:** Call `mediaItems.list` and page through results until we hit items we've already imported (matched by `source_id` = Google's `mediaItem.id`). Stop early once we see known items.

**Source ID mapping:** `Photo.source_id` = Google mediaItem ID, `Photo.source_account` = PhotoSource UUID (same pattern as folder/Apple sync).

**Album sync:** After media sync, fetch all Google albums and map them. For each album, search its mediaItems and create `album_photo` links. Albums use `album_type="google_sync"` to distinguish from manual albums.

### 6. Media download: baseUrl with dimension parameters

Google Photos serves media via `baseUrl` which is a temporary URL (valid ~60 minutes). To download the original:
- Photos: `{baseUrl}=d` (download original)
- Videos: `{baseUrl}=dv` (download video)

Downloaded files are saved to `data/photos/{user_id}/originals/` with the same SHA-256 dedup pipeline as other providers. Thumbnails are generated by pOS (not using Google's thumbnails) for consistency.

### 7. Rate limiting: conservative sequential processing

Google Photos API has a quota of 10,000 requests/day for most projects. Our approach:
- Process items sequentially (no parallel downloads)
- Batch size: 100 items per page (API maximum)
- Add 100ms delay between download requests to be courteous
- If rate-limited (429), wait and retry with exponential backoff (3 attempts)
- Log remaining quota if provided in response headers

### 8. Frontend: OAuth connect button in source dialog

The source dialog's "Add Source" section gets a "Connect Google Photos" option (alongside folder and Apple Photos). Clicking it triggers the OAuth redirect flow. After connection, the source appears in the source list like any other provider, showing Google email and sync status.

**Provider availability:** The `/providers` endpoint returns `google_photos` with `available: true` only if `GOOGLE_CLIENT_ID` is configured. If not set, the option is hidden — same pattern as Apple Photos availability.

## Risks / Trade-offs

**[API quota exhaustion]** → 10,000 requests/day could be hit during first sync of large libraries. Mitigation: page-level checkpointing (save `nextPageToken` after each page), so sync resumes where it left off. First sync may take multiple scheduler cycles.

**[baseUrl expiration]** → URLs expire ~60 minutes after retrieval. Mitigation: download immediately after listing, don't cache URLs. If a download fails, re-fetch the mediaItem to get a fresh URL.

**[Token revocation]** → User could revoke access in Google settings. Mitigation: detect 401 responses, set source status to "error" with clear message ("Google access revoked — reconnect"), and stop syncing until re-authorized.

**[Large libraries]** → Users with 100k+ photos will have slow initial sync. Mitigation: page-token checkpointing means it's resumable across multiple scheduler runs. Progress is visible in the UI via photo_count updates.

**[Google Cloud setup friction]** → Users must create a GCP project + OAuth credentials. Mitigation: detailed step-by-step setup guide with screenshots. This is a one-time setup per pOS instance, and the credentials work for all users.

## Open Questions

1. **Should we sync Google Photos "descriptions"?** → Map to pOS `caption` field (yes, straightforward)
2. **Video handling?** → Google Photos serves videos similarly. Use `=dv` suffix for download. Process through existing video pipeline (ffmpeg thumbnails). Already supported by our sync infrastructure.
