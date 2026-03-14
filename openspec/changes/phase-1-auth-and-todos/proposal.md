## Why

Phase 0 established the monorepo structure with scaffolds for all layers. Now we need to prove the entire stack works end-to-end: a user can register, log in, create todos, and persist them to the database. This is the first vertical slice — touching auth, API gateway, a domain service, event-driven messaging, and a full frontend module with Atomic Design. Everything after this phase builds on patterns established here.

## What Changes

- **Auth service** (new): User registration, login, JWT token issuance (access + refresh), password hashing, token refresh endpoint. SQLAlchemy User model with Alembic migrations.
- **Auth frontend** (new): Login and registration pages. `auth-store.js` upgraded with token persistence, auto-refresh, and logout. Route guards redirecting unauthenticated users.
- **API gateway wiring** (modify): Connect JWT validation middleware to the real auth service. Proxy routes to auth and todo services. Add token refresh to public paths.
- **Todo service** (new): Lists CRUD, Tasks CRUD with priority, status, due date, important/urgent flags, subtasks. Alembic migrations. Domain events on RabbitMQ.
- **Todo frontend module** (new): Atomic Design hierarchy — `pos-task-item` (molecule), `pos-task-list` (organism), `pos-todos-app` (page). List sidebar, task CRUD UI, status/priority controls.
- **API client upgrade** (modify): Auth token injection, 401 auto-retry with refresh, error handling.
- **App shell auth integration** (modify): Show/hide sidebar based on auth state. User menu with logout. Route guards.

## Capabilities

### New Capabilities
- `user-auth`: User registration, login, JWT token lifecycle (access + refresh), password hashing, token validation, logout
- `todo-service`: Todo lists and tasks CRUD, priorities, statuses, due dates, important/urgent flags, subtasks, ordering
- `todo-frontend`: Todo UI module with Atomic Design — task molecules, list organisms, page entry point, list management
- `auth-frontend`: Login page, registration page, auth state management, token persistence, route guards

### Modified Capabilities
- `frontend-shell`: Add auth integration — route guards, user menu, show/hide nav based on auth state
- `backend-foundation`: Gateway route proxying to real services, public path updates for token refresh

## Impact

- **Backend**: New `backend/services/auth/` and `backend/services/todos/` directories following the sample service pattern. Alembic migrations creating `users`, `todo_lists`, `tasks`, `subtasks` tables. Gateway `routes.py` and `middleware/auth.py` updated.
- **Frontend**: New `frontend/modules/todos/` with molecules/organisms/pages structure. Login/register pages in `frontend/modules/auth/`. Updated `auth-store.js`, `api-client.js`, `app-shell.js`.
- **Shared library**: May need minor additions to `pos_common` (e.g., password hashing utilities).
- **Infrastructure**: Docker Compose already has PostgreSQL + RabbitMQ. No infra changes needed.
- **Dependencies**: `passlib[bcrypt]` already in pos_common deps. May add `email-validator` for registration.
