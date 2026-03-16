# frontend-shell (delta)

Modifications to the app shell for auth integration.

## Requirements

### Requirement: Auth-Aware Navigation

App shell shows/hides navigation based on authentication state.

**Behavior:**
- Listen to `auth:changed` events from auth-store
- When authenticated: show sidebar with nav links, show user menu in sidebar header
- When not authenticated: hide sidebar entirely, show full-width content area (for login/register pages)
- User menu in sidebar header: shows user name, logout button
- Logout button calls `auth-store.logout()`, redirects to `#/login`

### Requirement: Auth Route Integration

Router handles auth routes and guards.

**Behavior:**
- Register `#/login` and `#/register` routes (no sidebar icon, hidden from nav)
- Before loading any non-auth module: check `isAuthenticated()` from auth-store
- If not authenticated: `navigate('#/login')` instead of loading the module
- Default route changes: unauthenticated → `#/login`, authenticated → `#/todos`

### Requirement: API Client Auth Integration

Upgrade `api-client.js` with auth token injection and refresh handling.

**Behavior:**
- Before each request: inject `Authorization: Bearer <token>` from auth-store
- On 401 response: attempt `refreshAccessToken()` once
- If refresh succeeds: retry original request with new token
- If refresh fails: call `logout()`, redirect to login
- Prevent concurrent refresh attempts (queue requests during refresh)
