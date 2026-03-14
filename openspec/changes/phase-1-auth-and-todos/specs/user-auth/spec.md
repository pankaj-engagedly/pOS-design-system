# user-auth

Authentication service handling user registration, login, JWT token lifecycle, and profile management.

## Requirements

### Requirement: User Registration

Users can create an account with email and password.

**Behavior:**
- Accept email (validated format) and password (min 8 chars) and name
- Hash password with bcrypt via passlib
- Store user in `users` table (email unique constraint)
- Return user profile + access token + refresh token
- Publish `auth.user.registered` event to RabbitMQ
- Return 409 if email already exists

### Requirement: User Login

Users can authenticate with email and password.

**Behavior:**
- Accept email and password
- Verify password against stored hash
- Issue JWT access token (15 min expiry) and refresh token (7 days)
- Store refresh token in `refresh_tokens` table
- Publish `auth.user.login` event
- Return 401 for invalid credentials

### Requirement: Token Refresh

Clients can exchange a valid refresh token for a new access token.

**Behavior:**
- Accept refresh token in request body
- Validate token signature and expiry
- Check token exists in `refresh_tokens` table (not revoked)
- Issue new access token
- Rotate refresh token: invalidate old, issue new
- Return 401 if refresh token is invalid or revoked

### Requirement: Logout

Users can invalidate their refresh token.

**Behavior:**
- Accept refresh token in request body
- Mark token as revoked in `refresh_tokens` table
- Return 204 on success

### Requirement: User Profile

Authenticated users can view and update their profile.

**Behavior:**
- GET `/me` returns user profile (id, email, name, created_at)
- PATCH `/me` allows updating name
- POST `/change-password` requires current_password + new_password, verifies current before updating

### Requirement: User Data Model

SQLAlchemy models and Alembic migration for auth tables.

**Tables:**
- `users`: id (UUID PK), email (unique), password_hash, name, created_at, updated_at
- `refresh_tokens`: id (UUID PK), user_id (FK → users), token_hash, expires_at, revoked (boolean), created_at

**Notes:**
- `users` extends `Base` (not `UserScopedBase`) — it IS the identity table
- `refresh_tokens` extends `Base` with explicit user_id FK to users table
- Alembic migration chain at `backend/services/auth/migrations/`
