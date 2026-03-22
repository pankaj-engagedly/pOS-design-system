## 1. OAuth2 Backend Infrastructure

- [x] 1.1 Add Google OAuth config to photos service config (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI from env vars with defaults)
- [x] 1.2 Create `google_oauth.py` — helper functions: `build_auth_url(user_id)` (generates authorize URL with scopes, state=HMAC-signed user_id, access_type=offline, prompt=consent), `exchange_code(code)` (POST to token endpoint, returns tokens), `refresh_access_token(refresh_token)` (POST to token endpoint with grant_type=refresh_token), `revoke_token(token)` (POST to revocation endpoint, best-effort), `verify_state(state)` (validates HMAC signature, extracts user_id)
- [x] 1.3 Create `google_oauth.py` — `get_user_email(access_token)` function that calls Google userinfo endpoint to fetch the connected account's email
- [x] 1.4 Create `routes_google_oauth.py` — `GET /google/auth` endpoint: validates Google config exists (503 if not), calls build_auth_url with authenticated user_id, returns `{ auth_url }`
- [x] 1.5 Create `routes_google_oauth.py` — `GET /google/callback` endpoint: validates state param (400 if invalid HMAC), handles error param (redirect to `/#/photos?google_error={error}`), exchanges code for tokens, fetches user email, encrypts refresh_token with Fernet (HKDF with info=b"pos-google-oauth-token"), creates or updates PhotoSource (provider="google_photos", source_path=email, config={access_token, encrypted refresh_token, token_expiry, google_email}), redirects to `/#/photos?google_connected=1`
- [x] 1.6 Mount google oauth router in main.py at `/api/photos/sources/google` (before the sources CRUD router)
- [x] 1.7 Create token refresh helper in `google_oauth.py` — `ensure_fresh_token(session, source)` that checks token_expiry, refreshes if within 5 minutes of expiry, decrypts/re-encrypts refresh token, updates source config, returns valid access_token. On invalid_grant error, sets source to error status with "Google access revoked — reconnect in Settings"

## 2. Google Photos API Client

- [x] 2.1 Create `google_photos_client.py` — async httpx client wrapper with methods: `list_media_items(access_token, page_token=None, page_size=100)` → returns items + nextPageToken, `get_media_item(access_token, item_id)` → returns single item (for baseUrl refresh), `list_albums(access_token, page_token=None)` → returns albums + nextPageToken, `search_album_media(access_token, album_id, page_token=None)` → POST to mediaItems:search
- [x] 2.2 Add rate limit handling — detect 429 responses, exponential backoff (1s, 2s, 4s), max 3 retries, log quota warnings
- [x] 2.3 Add `download_media_item(access_token, base_url, is_video=False)` — appends `=d` or `=dv` suffix, downloads bytes, returns content + content_type. On 403 (expired baseUrl), returns None to signal caller to re-fetch

## 3. Google Photos Sync Provider

- [x] 3.1 Create `service_sync_google.py` — main `sync_google_photos_source(session, source)` function: calls ensure_fresh_token, runs media item sync, runs album sync, returns imported count
- [x] 3.2 Implement media item sync loop — page through mediaItems.list using page_token from source config (resume interrupted sync), for each item: check if source_id already exists (skip if so = incremental), download media, compute SHA-256, check cross-source dedup by file_hash, copy to storage (or reuse path if hash match), create Photo record with source_type="google_photos"
- [x] 3.3 Implement metadata mapping — map Google mediaMetadata to Photo fields: creationTime→taken_at, width/height, description→caption, photo.cameraMake→exif_data.Make, photo.cameraModel→exif_data.Model, photo.focalLength→exif_data.FocalLength, photo.apertureFNumber→exif_data.FNumber, photo.isoEquivalent→exif_data.ISOSpeedRatings
- [x] 3.4 Implement video handling — detect mimeType starting with "video/", use `=dv` download suffix, process through existing video_processor pipeline (ffmpeg thumbnail + ffprobe duration), set Photo.duration
- [x] 3.5 Implement page-token checkpointing — after each page is fully processed, save nextPageToken to source.config and commit. On final page (no nextPageToken), set next_page_token=null and last_sync_marker to most recent item's creationTime
- [x] 3.6 Implement baseUrl refresh — when download returns None (403), call get_media_item to get fresh baseUrl, retry download once
- [x] 3.7 Implement album sync — after media sync: page through all Google albums, for each album create/update pOS Album (album_type="google_sync", match by name), then search album's mediaItems and create album_photo links for photos that exist in pOS
- [x] 3.8 Handle album rename detection — if a google_sync album exists with the same source but different title, update the pOS album name
- [x] 3.9 Add 100ms delay between download requests to stay within rate limits

## 4. Scheduler Integration

- [x] 4.1 Add `google_photos` provider case in scheduler.py `_sync_single_source` — import and call `sync_google_photos_source`, handle ImportError gracefully (log warning)
- [x] 4.2 Handle token-revoked scenario in scheduler — if sync raises a token-revoked error, set source status to "error" without retrying

## 5. Provider Endpoint Update

- [x] 5.1 Update `/providers` endpoint in routes_sources.py — add google_photos entry with `available` based on GOOGLE_CLIENT_ID being set
- [x] 5.2 Add `connected` and `email` fields to google_photos provider response — query user's PhotoSource for provider="google_photos" to determine connection status

## 6. Token Revocation on Disconnect

- [x] 6.1 Update source deletion logic — when deleting a google_photos source, call revoke_token with the stored access_token (best-effort, catch errors). Imported photos remain untouched (existing behavior)

## 7. Frontend — Source Dialog Updates

- [x] 7.1 Update source dialog to show "Connect Google Photos" button when provider is available and not connected — clicking triggers `window.location.href` to the auth URL fetched from `GET /api/photos/sources/google/auth`
- [x] 7.2 Show connected Google account state — when google_photos provider has `connected: true`, display the email and "Connected" status instead of the connect button
- [x] 7.3 Handle `?google_connected=1` query param in photos app — show a brief success notification or refresh source list after OAuth redirect back
- [x] 7.4 Handle `?google_error=` query param — show error message to user when OAuth fails

## 8. Setup Documentation

- [x] 8.1 Create `docs/google-photos-setup.md` — step-by-step guide: create GCP project, enable Photos Library API, configure OAuth consent screen (External, Testing mode, add test user), create OAuth credentials (Web application, redirect URI http://localhost:8000/api/photos/sources/google/callback), copy client ID and secret
- [x] 8.2 Add environment variables section — document GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI (with default), where to set them (.env or shell export)
- [x] 8.3 Add verification section — restart service, check /providers endpoint, connect via UI
- [x] 8.4 Add troubleshooting section — redirect_uri_mismatch (exact URI match required), access_denied (test user not added), Google Photos option not showing (env var not set), quota exceeded (10k/day limit, resumes automatically)
