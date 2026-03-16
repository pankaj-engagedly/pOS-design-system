# Phase 1: Auth + Todos — Tasks

## Auth Service Backend

- [x] Create `backend/services/auth/` directory structure following sample service pattern (app/main.py, app/models.py, app/schemas.py, app/routes.py, app/service.py, requirements.txt)
- [x] Create User model in `app/models.py` extending `Base` (not UserScopedBase) with id, email (unique), password_hash, name, created_at, updated_at
- [x] Create RefreshToken model in `app/models.py` extending `Base` with id, user_id (FK→users), token_hash, expires_at, revoked, created_at
- [x] Create Pydantic schemas in `app/schemas.py`: RegisterRequest, LoginRequest, AuthResponse (user + tokens), TokenRefreshRequest, TokenRefreshResponse, UserResponse, UserUpdateRequest, ChangePasswordRequest
- [x] Create auth service layer in `app/service.py`: register_user, authenticate_user, refresh_token, revoke_token, get_user, update_user, change_password (password hashing via passlib bcrypt)
- [x] Create auth routes in `app/routes.py`: POST /register, POST /login, POST /refresh, POST /logout, GET /me, PATCH /me, POST /change-password
- [x] Create FastAPI app in `app/main.py` with lifespan (init_db/close_db), health check, routes under `/api/auth` prefix, running on port 8001
- [x] Create `requirements.txt` with fastapi, uvicorn, email-validator, and comment for pos_common
- [x] Set up Alembic: create `alembic.ini` and `migrations/env.py` (async) following sample service pattern
- [x] Create initial Alembic migration for users and refresh_tokens tables

## Todo Service Backend

- [x] Create `backend/services/todos/` directory structure following sample service pattern
- [x] Create TodoList model extending UserScopedBase with name, position
- [x] Create Task model extending UserScopedBase with list_id (FK→todo_lists), title, description, status (String enum), priority (String enum), due_date, is_important, is_urgent, position
- [x] Create Subtask model extending UserScopedBase with task_id (FK→tasks, cascade delete), title, is_completed, position
- [x] Create Pydantic schemas: ListCreate, ListUpdate, ListResponse, TaskCreate, TaskUpdate, TaskResponse (includes subtasks), SubtaskCreate, SubtaskUpdate, SubtaskResponse, ReorderRequest
- [x] Create todo service layer in `app/service.py`: CRUD for lists, tasks, subtasks with user_id scoping. Lazy-create default "Inbox" list on first list access.
- [x] Create todo routes in `app/routes.py`: lists CRUD + reorder, tasks CRUD + reorder, subtasks CRUD (all endpoints per design doc)
- [x] Create event publishers in `app/events.py`: publish todo.task.created, todo.task.updated, todo.task.completed to RabbitMQ
- [x] Create FastAPI app in `app/main.py` with lifespan, health check, routes under `/api/todos` prefix, running on port 8002
- [x] Create `requirements.txt` with fastapi, uvicorn, alembic, and comment for pos_common
- [x] Set up Alembic: create `alembic.ini` and `migrations/env.py` (async)
- [x] Create initial Alembic migration for todo_lists, tasks, subtasks tables

## Gateway Updates

- [x] Add `httpx` to `backend/gateway/requirements.txt`
- [x] Create proxy utility function in `backend/gateway/app/proxy.py`: async function that forwards request to downstream service (method, headers, body, query params), injects X-User-Id header
- [x] Update `backend/gateway/app/routes.py`: add catch-all routes for `/api/auth/{path}` → auth service and `/api/todos/{path}` → todo service using proxy utility
- [x] Add gateway config: AUTH_SERVICE_URL and TODO_SERVICE_URL environment variables (defaults to localhost:8001/8002)
- [x] Add `/api/auth/refresh` to PUBLIC_PATHS in `backend/gateway/app/middleware/auth.py`

## Frontend Auth Module

- [x] Create `frontend/modules/auth/pages/pos-auth-login.js`: login form using ui-input, ui-button, ui-card. Calls auth-store login(), redirects to #/todos on success, shows error on failure
- [x] Create `frontend/modules/auth/pages/pos-auth-register.js`: registration form with name, email, password, confirm password. Client-side validation (email format, password length, match). Calls auth-store register()
- [x] Upgrade `frontend/shared/services/auth-store.js`: add login(), register(), logout(), refreshAccessToken() functions. Store access token in memory, refresh token in localStorage. Emit auth:changed events. On page load attempt silent refresh
- [x] Upgrade `frontend/shared/services/api-client.js`: inject Authorization header from auth-store, handle 401 with auto-refresh retry, prevent concurrent refresh requests

## Frontend Todo Module

- [x] Create `frontend/modules/todos/services/todo-api.js`: API service wrapping all todo endpoints using apiFetch
- [x] Create `frontend/modules/todos/store.js`: module-local state store for lists (selected list, all lists) and tasks (current tasks, loading state)
- [x] Create `frontend/shared/molecules/pos-task-item.js`: task row with checkbox, title, priority badge, due date, important/urgent indicators
- [x] Create `frontend/shared/molecules/pos-task-form.js`: create/edit form with title, description, priority select, due date, importance/urgency checkboxes
- [x] Create `frontend/shared/molecules/pos-subtask-list.js`: checklist rendering subtasks with toggle, add, delete
- [x] Create `frontend/shared/molecules/pos-list-item.js`: single list row showing name, active task count, click to select (reusable for note folders, KB categories, etc.)
- [x] Create `frontend/shared/organisms/pos-task-list.js`: scrollable task list with header, filters (status/sort), renders pos-task-item, empty state, inline add via pos-task-form
- [x] Create `frontend/shared/organisms/pos-list-sidebar.js`: sidebar with list items, selected highlight, new list button, inline rename, delete with confirmation
- [x] Replace `frontend/modules/todos/pages/pos-todos-app.js`: compose pos-list-sidebar + pos-task-list, fetch data on load, handle list selection, coordinate between sidebar and task list

## App Shell & Router Updates

- [x] Update `frontend/shared/services/router.js`: register #/login and #/register routes (hidden from nav, no icon)
- [x] Update `frontend/shell/app-shell.js`: listen to auth:changed events, show/hide sidebar based on auth state, add user menu (name + logout) in sidebar header, implement route guards (check isAuthenticated before loading modules)
- [x] Update default route: unauthenticated → #/login, authenticated → #/todos

## Dev Tooling

- [x] Update Makefile: add `dev-backend` target that starts gateway + auth + todos services (background processes), add `stop` target to kill them
- [x] Update `infra/scripts/setup-dev.sh`: install auth and todos service dependencies in addition to sample service (already handled by existing for-loop)
- [x] Add `backend/.env` file (gitignored) with default dev values matching docker-compose (DATABASE_URL, RABBITMQ_URL, JWT_SECRET_KEY)

## Testing

- [x] Create `backend/services/auth/tests/test_auth.py`: test registration, login, token refresh, logout, profile endpoints (using httpx TestClient)
- [x] Create `backend/services/todos/tests/test_todos.py`: test lists CRUD, tasks CRUD, subtasks, reorder endpoints
- [x] Create `frontend/modules/todos/tests/` with basic component rendering tests for pos-task-item and pos-task-list
