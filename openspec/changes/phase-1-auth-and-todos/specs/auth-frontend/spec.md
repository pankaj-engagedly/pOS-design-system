# auth-frontend

Frontend authentication UI — login page, registration page, and auth state management.

## Requirements

### Requirement: Login Page

A full-page login form for unauthenticated users.

**Behavior:**
- Route: `#/login` (not shown in sidebar navigation)
- Form fields: email (ui-input), password (ui-input type=password)
- Submit button (ui-button) calls POST `/api/auth/login`
- On success: store tokens, redirect to `#/todos`
- On error: show error message below form (invalid credentials)
- Link to registration page: "Don't have an account? Register"
- Uses design system atoms: ui-input, ui-button, ui-card
- Component: `pos-auth-login` in `frontend/modules/auth/pages/`

### Requirement: Registration Page

A full-page registration form.

**Behavior:**
- Route: `#/register` (not shown in sidebar)
- Form fields: name, email, password, confirm password
- Client-side validation: email format, password min 8 chars, passwords match
- Submit calls POST `/api/auth/register`
- On success: store tokens, redirect to `#/todos`
- On error: show API error (email already exists, validation errors)
- Link to login page: "Already have an account? Log in"
- Component: `pos-auth-register` in `frontend/modules/auth/pages/`

### Requirement: Auth Store Upgrade

Upgrade `auth-store.js` from placeholder to full token management.

**Behavior:**
- Store access token in memory (variable)
- Store refresh token in localStorage
- On page load: check localStorage for refresh token, attempt silent refresh
- `login(email, password)` — call API, store tokens, emit `auth:changed`
- `register(name, email, password)` — call API, store tokens, emit `auth:changed`
- `logout()` — call API logout, clear tokens, emit `auth:changed`
- `refreshAccessToken()` — call refresh endpoint, update access token
- `isAuthenticated()` — returns boolean based on access token presence
- `getUser()` — returns stored user profile
- Emit events on `event-bus` for auth state changes

### Requirement: Route Guards

Protect authenticated routes from unauthenticated access.

**Behavior:**
- Before loading any module (except auth), check `isAuthenticated()`
- If not authenticated: redirect to `#/login`
- Login/register pages redirect to `#/todos` if already authenticated
- On 401 API response: attempt token refresh, if refresh fails: logout and redirect to login
