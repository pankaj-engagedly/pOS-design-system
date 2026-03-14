# Session Log: Phase 1 — Auth & Todos Implementation

**Date:** 2026-03-05
**Scope:** Full Phase 1 implementation — from OpenSpec artifacts through working end-to-end stack

---

## Session Overview

This session took the pOS project from a design-system-only repo to a full-stack application with authentication, a todo service, an API gateway, and a frontend app shell. We went from zero backend code to a working app you can use in the browser.

---

## Part 1: OpenSpec Artifacts

### What happened
Created the `phase-1-auth-and-todos` change via OpenSpec with 4 artifacts:

1. **proposal.md** — Why auth + todos first (core infrastructure, proves the architecture)
2. **specs/** — 6 capability specs:
   - `user-auth` — registration, login, JWT tokens, profile management
   - `todo-service` — lists, tasks, subtasks, priorities, statuses
   - `auth-frontend` — login/register pages
   - `todo-frontend` — todo app with sidebar, task list, forms
   - `frontend-shell` (delta) — auth-aware routing, session restore
   - `backend-foundation` (delta) — gateway proxy, shared library
3. **design.md** — Technical architecture, data models, API design (28 endpoints), component hierarchy
4. **tasks.md** — 49 implementation tasks across 8 sections

### Key design decision: Frontend structure
User pointed out that molecules/organisms should be shared across modules, not duplicated per module. Updated design to:
- `frontend/shared/molecules/` — reusable UI pieces (task-item, task-form, etc.)
- `frontend/shared/organisms/` — composed UI (task-list, list-sidebar)
- `frontend/modules/<name>/pages/` — module-specific pages only
- `frontend/modules/<name>/services/` — module-specific API wrappers
- `frontend/modules/<name>/store.js` — module-local state

**Files:** `openspec/changes/phase-1-auth-and-todos/` (proposal.md, design.md, tasks.md, specs/)

---

## Part 2: Backend Implementation

### Shared Library (`backend/shared/pos_common/`)
A pip-installable package providing common infrastructure to all services:

- **`database.py`** — Async SQLAlchemy engine, `Base` and `UserScopedBase` (auto `user_id` column), `get_async_session` dependency
- **`auth.py`** — `create_access_token()`, `create_refresh_token()`, `validate_token()` using PyJWT
- **`config.py`** — `BaseServiceConfig` with Pydantic settings (DATABASE_URL, JWT_*, RABBITMQ_URL)
- **`events.py`** — RabbitMQ publisher (aio-pika), best-effort, non-blocking
- **`exceptions.py`** — `AuthenticationError`, `NotFoundError`, `ValidationError`
- **`schemas.py`** — `HealthResponse` shared schema

### Auth Service (`backend/services/auth/`, port 8001)

**Models** (`app/models.py`):
```python
class User(Base):           # NOT UserScopedBase — users don't belong to users
    id, email, password_hash, name, is_active, created_at, updated_at

class RefreshToken(Base):
    id, user_id (FK), token_hash, expires_at, revoked, created_at
```

**Endpoints** (`app/routes.py`):
- `POST /api/auth/register` — create user, return tokens
- `POST /api/auth/login` — verify credentials, return tokens
- `POST /api/auth/refresh` — rotate refresh token
- `POST /api/auth/logout` — revoke refresh token
- `GET /api/auth/me` — get current user profile
- `PATCH /api/auth/me` — update profile
- `POST /api/auth/change-password` — change password

**Service layer** (`app/service.py`):
- Password hashing with `bcrypt` directly (not passlib — see Bug #1 below)
- Refresh tokens stored as SHA-256 hashes
- Token rotation on refresh (old token revoked, new one issued)

**Alembic migration**: Creates `users` and `refresh_tokens` tables with version table `alembic_version_auth`.

### Todo Service (`backend/services/todos/`, port 8002)

**Models** (`app/models.py`):
```python
class TodoList(UserScopedBase):   # auto user_id scoping
    id, user_id, name, position, created_at, updated_at
    tasks: relationship

class Task(UserScopedBase):
    id, user_id, list_id (FK), title, description, status (enum),
    priority (enum), position, due_date, is_important, is_urgent,
    created_at, updated_at
    subtasks: relationship

class Subtask(UserScopedBase):
    id, user_id, task_id (FK), title, is_done, position, created_at
```

**Endpoints** (`app/routes.py`): 14+ endpoints for full CRUD on lists, tasks, subtasks + reorder.

All queries are scoped by `user_id` from the `X-User-Id` header (injected by gateway).

**Events** (`app/events.py`): Publishes domain events to RabbitMQ (task.created, task.completed, etc.). Best-effort — logs warning if RabbitMQ unavailable.

**Alembic migration**: Creates `todo_lists`, `tasks`, `subtasks` with version table `alembic_version_todos`.

### API Gateway (`backend/gateway/`, port 8000)

**Proxy** (`app/proxy.py`):
```python
async def proxy_request(request, service_url, path):
    # Forwards method, headers, body, query params
    # Injects X-User-Id from request.state (set by auth middleware)
    # Returns 502 on ConnectError
```

**Auth Middleware** (`app/middleware/auth.py`):
- Skips auth for public paths: `/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`
- Validates JWT from `Authorization: Bearer <token>` header
- Sets `request.state.user_id` for downstream use

**Routes** (`app/routes.py`):
- `/api/auth/{path:path}` → proxy to `localhost:8001`
- `/api/todos/{path:path}` → proxy to `localhost:8002`

---

## Part 3: Frontend Implementation

### App Shell (`frontend/shell/`)

**`index.html`** — Entry point, loads design system CSS/JS + app shell component.

**`app-shell.js`** — `<pos-app-shell>` custom element:
- Auth-aware sidebar (hidden on login/register pages)
- Theme toggle (light/dark)
- Route guards (redirect to login if not authenticated)
- Session restore on load (`tryRestoreSession()`)
- Lazy module loading via dynamic `import()`
- Placeholder components for future modules

### Shared Services (`frontend/shared/services/`)

**`auth-store.js`**:
- `login(email, password)` / `register(name, email, password)` / `logout()`
- Access token kept in memory (not localStorage — more secure)
- Refresh token in localStorage
- `tryRestoreSession()` — attempts token refresh on page load
- `refreshAccessToken()` — deduplicates concurrent refresh calls
- Emits `auth:changed` events via event bus

**`api-client.js`**:
- `apiFetch(path, options)` — wrapper around `fetch()`
- Injects `Authorization: Bearer <token>` header
- On 401: automatically tries token refresh, retries request once
- On failed refresh: logs out, redirects to login
- Handles 204 No Content responses

**`router.js`** — Hash-based client-side router:
- `registerRoute(path, config)` / `navigate(path)` / `initRouter()`
- Emits `route:changed` events
- Routes defined: `/login`, `/register` (public, hidden), `/todos`, `/notes`, `/knowledge-base`, `/vault`, `/feeds`, `/documents`, `/photos`, `/settings`

**`event-bus.js`** — Simple pub/sub: `emit(event, detail)` / `on(event, callback)` / `off(event, callback)`

**`state-store.js`** — Minimal reactive store: `setState(partial)` / `getState()` / `subscribe(callback)`

### Auth Module (`frontend/modules/auth/pages/`)

**`pos-auth-login.js`** — Login form with email/password, calls `login()` from auth-store, redirects to `#/todos` on success.

**`pos-auth-register.js`** — Register form with name/email/password/confirm. Client-side validation (password match, min length). Calls `register()`, redirects to `#/todos`.

### Todo Module (`frontend/modules/todos/`)

**`pages/pos-todos-app.js`** — Main page composing `<pos-list-sidebar>` + `<pos-task-list>`. Manages state via `todoStore`, handles events (list-select, list-create, task-create, toggle-status).

**`services/todo-api.js`** — API wrapper for all todo endpoints (getLists, createList, getTasks, createTask, updateTask, etc.)

**`store.js`** — Module-local state store (lists, tasks, selectedListId, loading, error).

### Shared Molecules (`frontend/shared/molecules/`)

**`pos-task-item.js`** — Task row with checkbox, title, priority badge, due date, important/urgent flags.

**`pos-task-form.js`** — Create/edit form with expandable details (priority, due date, flags).

**`pos-subtask-list.js`** — Checklist with toggle, add, delete.

**`pos-list-item.js`** — Sidebar list row with name, count, selected state.

### Shared Organisms (`frontend/shared/organisms/`)

**`pos-task-list.js`** — Task list with header, filters (all/active/done), inline add form. Uses event delegation (bound once) to avoid duplicate event listeners.

**`pos-list-sidebar.js`** — List sidebar with new list creation input. Also uses event delegation pattern.

### Frontend Dev Server (`frontend/server.js`)

Simple Node.js HTTP server:
- Serves static files from project root
- Proxies `/api/*` requests to gateway at `localhost:8000`
- SPA fallback (serves `index.html` for unmatched routes)

---

## Part 4: Infrastructure & Dev Tooling

### Database Setup
- Using local Homebrew PostgreSQL 17 (not Docker) on port 5432
- Created `pos` user and `pos` database
- Each service has its own Alembic version table to avoid conflicts

### Docker
- Only RabbitMQ runs in Docker (`docker-compose.yml`)
- PostgreSQL commented out (using local install)

### Dev Scripts (`infra/scripts/`)

**`dev-start.sh`** — Smart start script:
1. Checks PostgreSQL is running (starts via Homebrew if not)
2. Verifies `pos` database exists (creates if not)
3. Starts Docker/RabbitMQ (with health check)
4. Runs Alembic migrations for all services
5. Kills stale processes
6. Starts all 4 services (auth, todos, gateway, frontend)
7. Waits for health check on each service
8. Prints summary with URLs

**`dev-stop.sh`** — Stops all services, frontend, and Docker containers.

**`setup-dev.sh`** — First-time setup (venv, deps, Docker images, design system build).

### Makefile
- `make dev` → `dev-start.sh`
- `make stop` → `dev-stop.sh`
- `make setup` → `setup-dev.sh`
- `make test`, `make db-migrate`, etc.

---

## Bugs Found & Fixed

### Bug 1: passlib + bcrypt 5.x Incompatibility

**Symptom:** 500 error on `POST /api/auth/register` — `ValueError: password cannot be longer than 72 bytes, truncate manually`

**Cause:** `passlib 1.7.4` is incompatible with `bcrypt 5.0.0`. passlib's bcrypt backend detection code tries to hash a long test string, which bcrypt 5.x rejects.

**Fix:** Replaced `passlib.CryptContext` with direct `bcrypt` calls:
```python
# Before (broken)
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
pwd_context.hash(password)
pwd_context.verify(password, hash)

# After (working)
import bcrypt
bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
bcrypt.checkpw(password.encode(), hash.encode())
```

**Lesson:** passlib is effectively abandoned. Use `bcrypt` directly for new projects.

### Bug 2: Missing UserIdMiddleware in Services

**Symptom:** 500 error on `GET /api/auth/me` — `AttributeError: 'State' object has no attribute 'user_id'`

**Cause:** The gateway validates JWT and sets `X-User-Id` header when proxying. But the downstream services (auth, todos) had no middleware to read this header into `request.state.user_id`.

**Fix:** Added `UserIdMiddleware` to both auth and todos services:
```python
class UserIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)
```

**Lesson:** In a gateway architecture, downstream services need middleware to extract headers the gateway injects.

### Bug 3: Alembic Shared Version Table

**Symptom:** Second service migration thinks it's already up to date.

**Cause:** Both auth and todos services used the default `alembic_version` table with revision `001`. After auth migrated, todos saw the existing version and skipped.

**Fix:** Each service gets its own version table:
- `alembic.ini`: `version_table = alembic_version_auth` / `alembic_version_todos`
- `migrations/env.py`: `version_table="alembic_version_auth"` in `context.configure()`

**Lesson:** When multiple services share a database, always use per-service Alembic version tables.

### Bug 4: Alembic Can't Find App Module

**Symptom:** `ModuleNotFoundError: No module named 'app'` when running migrations.

**Cause:** Alembic's `env.py` imports `from app.models import ...` but the service's `app/` directory isn't on `sys.path` when running from the migrations directory.

**Fix:** Added to the top of each `env.py`:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
```

### Bug 5: Duplicate Event Listeners (Frontend)

**Symptom:** Clicking "Add task" creates multiple tasks.

**Cause:** `pos-task-list` and `pos-list-sidebar` called `bindEvents()` on every property setter (`set tasks()`, `set lists()`). Each call added **new** event listeners to the shadow root without removing old ones. Since the store triggers multiple `setState` calls, listeners stacked up.

**Fix:** Replaced `bindEvents()` pattern with event delegation bound once in `connectedCallback()`:
```javascript
// Before (broken — called on every render)
bindEvents() {
    this.shadow.addEventListener('task-submit', (e) => { ... });
}

// After (fixed — bound once, delegates via event bubbling)
connectedCallback() {
    this._bindShadowEvents();  // once
    this.render();
}
_bindShadowEvents() {
    this.shadow.addEventListener('click', (e) => {
        if (e.target.closest('#add-btn')) { ... }
        if (e.target.closest('.filter-btn')) { ... }
    });
}
```

**Lesson:** In Web Components that re-render via innerHTML, use event delegation on the shadow root (bound once) instead of binding listeners to specific elements after each render.

### Bug 6: Frontend Server Port Conflict

**Symptom:** `EADDRINUSE: address already in use :::3001`

**Cause:** Old server process still running from earlier manual start.

**Fix:** `lsof -ti:3001 | xargs kill -9` before starting. The `dev-start.sh` script now always kills stale processes before starting new ones.

---

## How the Auth Flow Works

### Registration
1. User fills form at `#/register`
2. `pos-auth-register` calls `authStore.register(name, email, password)`
3. `auth-store.js` calls `apiFetch('/api/auth/register', { method: 'POST', body })`
4. `api-client.js` sends to `localhost:3001/api/auth/register` (same origin)
5. Frontend server proxies to gateway at `localhost:8000/api/auth/register`
6. Gateway sees `/api/auth/register` in PUBLIC_PATHS, skips JWT check
7. Gateway proxies to auth service at `localhost:8001/api/auth/register`
8. Auth service hashes password with bcrypt, creates user, generates JWT tokens
9. Response flows back: auth → gateway → frontend server → browser
10. `auth-store.js` stores access token in memory, refresh token in localStorage
11. Emits `auth:changed` event, app shell shows sidebar
12. Navigates to `#/todos`

### Authenticated Request (e.g., Create Task)
1. `todo-api.js` calls `apiFetch('/api/todos/tasks', { method: 'POST', body })`
2. `api-client.js` adds `Authorization: Bearer <access_token>` header
3. Request proxied through frontend server → gateway
4. Gateway's `AuthMiddleware` validates JWT, sets `request.state.user_id`
5. Gateway proxies to todo service, adding `X-User-Id` header
6. Todo service's `UserIdMiddleware` reads header into `request.state.user_id`
7. Route handler creates task scoped to that user_id
8. Response flows back to browser

### Token Refresh
1. Access token expires (15 min)
2. Next API call gets 401
3. `api-client.js` catches 401, calls `refreshAccessToken()`
4. `auth-store.js` sends refresh token to `/api/auth/refresh`
5. Auth service validates refresh token, revokes it, issues new pair
6. `api-client.js` retries original request with new access token
7. If refresh fails → logout, redirect to `#/login`

---

## Files Created/Modified (Complete List)

### New Files
```
backend/shared/pos_common/__init__.py
backend/shared/pos_common/auth.py
backend/shared/pos_common/config.py
backend/shared/pos_common/database.py
backend/shared/pos_common/events.py
backend/shared/pos_common/exceptions.py
backend/shared/pos_common/schemas.py
backend/shared/pyproject.toml

backend/gateway/app/proxy.py

backend/services/auth/app/__init__.py
backend/services/auth/app/main.py
backend/services/auth/app/models.py
backend/services/auth/app/routes.py
backend/services/auth/app/schemas.py
backend/services/auth/app/service.py
backend/services/auth/alembic.ini
backend/services/auth/migrations/env.py
backend/services/auth/migrations/script.py.mako
backend/services/auth/migrations/versions/001_create_auth_tables.py
backend/services/auth/requirements.txt
backend/services/auth/tests/test_auth.py

backend/services/todos/app/__init__.py
backend/services/todos/app/main.py
backend/services/todos/app/models.py
backend/services/todos/app/routes.py
backend/services/todos/app/schemas.py
backend/services/todos/app/service.py
backend/services/todos/app/events.py
backend/services/todos/alembic.ini
backend/services/todos/migrations/env.py
backend/services/todos/migrations/script.py.mako
backend/services/todos/migrations/versions/001_create_todo_tables.py
backend/services/todos/requirements.txt
backend/services/todos/tests/test_todos.py

frontend/modules/auth/pages/pos-auth-login.js
frontend/modules/auth/pages/pos-auth-register.js
frontend/modules/todos/pages/pos-todos-app.js
frontend/modules/todos/services/todo-api.js
frontend/modules/todos/store.js
frontend/modules/todos/tests/pos-task-item.test.js
frontend/shared/molecules/pos-task-item.js
frontend/shared/molecules/pos-task-form.js
frontend/shared/molecules/pos-subtask-list.js
frontend/shared/molecules/pos-list-item.js
frontend/shared/organisms/pos-task-list.js
frontend/shared/organisms/pos-list-sidebar.js

infra/scripts/dev-start.sh
infra/scripts/dev-stop.sh

backend/.env
```

### Modified Files
```
backend/gateway/app/routes.py        — added proxy routes
backend/gateway/app/main.py          — added GatewayConfig, lifespan
backend/gateway/app/middleware/auth.py — added public paths
backend/gateway/requirements.txt     — added httpx

frontend/shared/services/auth-store.js  — full rewrite with JWT management
frontend/shared/services/api-client.js  — full rewrite with auth + retry
frontend/shared/services/router.js      — added auth routes
frontend/shell/app-shell.js             — full rewrite with auth integration
frontend/server.js                      — added API proxy

backend/docker-compose.yml           — commented out Postgres
backend/.env.example                 — created
Makefile                             — updated dev/stop targets
README.md                            — full rewrite

openspec/changes/phase-1-auth-and-todos/  — all artifacts
```

---

## What's Next

Before adding more features (notes, knowledge base, etc.), the plan is to:
1. **Fix UX issues** — the current UI is functional but rough
2. **Improve UI polish** — better styling, responsiveness, error states, loading states
3. Then continue to Phase 2 features
