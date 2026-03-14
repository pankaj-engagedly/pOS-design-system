# backend-foundation (delta)

Gateway modifications to proxy to real services and support auth token refresh.

## Requirements

### Requirement: Gateway Service Proxying

Gateway forwards API requests to individual backend services.

**Behavior:**
- Add `httpx` as gateway dependency for async HTTP proxying
- Route pattern: `/api/auth/*` → auth service (localhost:8001)
- Route pattern: `/api/todos/*` → todo service (localhost:8002)
- Proxy preserves: method, headers (including Authorization), body, query params
- Proxy injects `X-User-Id` header from `request.state.user_id` (set by auth middleware)
- Service URLs configurable via environment variables (`AUTH_SERVICE_URL`, `TODO_SERVICE_URL`)
- Error handling: return 502 if downstream service is unreachable

### Requirement: Updated Public Paths

Auth middleware allows unauthenticated access to additional paths.

**Behavior:**
- Add `/api/auth/register` to public paths (already listed)
- Add `/api/auth/login` to public paths (already listed)
- Add `/api/auth/refresh` to public paths
- All other `/api/*` paths require valid JWT
