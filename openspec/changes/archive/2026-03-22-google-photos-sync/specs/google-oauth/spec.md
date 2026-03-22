## ADDED Requirements

### Requirement: Authorization URL generation
The system SHALL expose `GET /api/photos/sources/google/auth` which generates a Google OAuth2 authorization URL and returns it as `{ auth_url }`. The URL SHALL include the scopes `https://www.googleapis.com/auth/photoslibrary.readonly` and `https://www.googleapis.com/auth/userinfo.email`. The state parameter SHALL encode the user_id signed with HMAC-SHA256 using APP_SECRET_KEY to prevent CSRF.

#### Scenario: User initiates Google connection
- **WHEN** an authenticated user calls `GET /api/photos/sources/google/auth`
- **THEN** the system returns `{ auth_url }` pointing to `https://accounts.google.com/o/oauth2/v2/auth` with correct client_id, redirect_uri, scopes, state, and `access_type=offline` with `prompt=consent`

#### Scenario: Missing Google credentials configuration
- **WHEN** `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` environment variables are not set
- **THEN** the endpoint returns 503 with `{ detail: "Google Photos not configured" }`

### Requirement: OAuth callback handling
The system SHALL expose `GET /api/photos/sources/google/callback` which receives the authorization code from Google, exchanges it for tokens, creates a PhotoSource record, and redirects the user back to the frontend.

#### Scenario: Successful authorization callback
- **WHEN** Google redirects to the callback with a valid `code` and `state` parameter
- **THEN** the system exchanges the code for access_token and refresh_token, fetches the user's email via Google userinfo API, creates a PhotoSource with `provider="google_photos"` and `source_path` set to the Google email, stores tokens in `config` JSONB (refresh_token encrypted with Fernet), and redirects to `/#/photos?google_connected=1`

#### Scenario: Invalid state parameter (CSRF protection)
- **WHEN** the callback receives a state parameter with an invalid HMAC signature
- **THEN** the system returns 400 with `{ detail: "Invalid state parameter" }` and does not exchange the code

#### Scenario: Google returns an error
- **WHEN** the callback receives an `error` query parameter instead of `code`
- **THEN** the system redirects to `/#/photos?google_error={error}` without creating any records

#### Scenario: Duplicate connection
- **WHEN** a PhotoSource already exists for this user with `provider="google_photos"` and the same Google email
- **THEN** the system updates the existing source's tokens instead of creating a duplicate

### Requirement: Token refresh
The system SHALL automatically refresh expired access tokens using the stored refresh token before making Google API calls. Token refresh SHALL use `POST https://oauth2.googleapis.com/token` with grant_type=refresh_token.

#### Scenario: Access token expired during sync
- **WHEN** a sync job starts and the stored `token_expiry` is within 5 minutes of current time or already past
- **THEN** the system refreshes the access token, updates the stored access_token and token_expiry in the PhotoSource config, and proceeds with sync

#### Scenario: Refresh token revoked
- **WHEN** a token refresh request returns 400/401 (invalid_grant)
- **THEN** the system sets the source's sync_status to "error" with last_error "Google access revoked — reconnect in Settings" and stops the sync

### Requirement: Disconnect / revoke
The system SHALL support disconnecting a Google Photos source which revokes the access token with Google and deletes the PhotoSource record. Imported photos SHALL NOT be deleted.

#### Scenario: User disconnects Google Photos
- **WHEN** user deletes the Google Photos source via `DELETE /api/photos/sources/{id}`
- **THEN** the system revokes the token with Google's revocation endpoint (best-effort, don't fail if revocation fails), deletes the PhotoSource record, but keeps all previously imported photos

### Requirement: Provider availability
The `/providers` endpoint SHALL include `google_photos` in the provider list with `available: true` only when `GOOGLE_CLIENT_ID` environment variable is configured. When available, it SHALL also include `connected: true` and the connected email if the user already has an active Google Photos source.

#### Scenario: Google credentials configured
- **WHEN** `GOOGLE_CLIENT_ID` is set and user has no Google source
- **THEN** `/providers` returns `{ id: "google_photos", name: "Google Photos", available: true, connected: false }`

#### Scenario: Google credentials not configured
- **WHEN** `GOOGLE_CLIENT_ID` is not set
- **THEN** `/providers` returns `{ id: "google_photos", name: "Google Photos", available: false }`

#### Scenario: User already connected
- **WHEN** `GOOGLE_CLIENT_ID` is set and user has an active Google Photos source
- **THEN** `/providers` returns `{ id: "google_photos", name: "Google Photos", available: true, connected: true, email: "user@gmail.com" }`
