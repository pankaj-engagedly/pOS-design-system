## 1. Move Design System into Subdirectory

- [x] 1.1 Create `design-system/` directory
- [x] 1.2 Move `src/`, `tokens/`, `test/`, `dist/`, `examples/` into `design-system/` using `git mv`
- [x] 1.3 Move `esbuild.config.js`, `web-test-runner.config.js`, `server.js` into `design-system/`
- [x] 1.4 Move current `package.json` to `design-system/package.json` (keep name `pos-design-system`, update script paths if needed)
- [x] 1.5 Move `package-lock.json` to `design-system/package-lock.json`
- [x] 1.6 Run `cd design-system && npm install` to verify dependencies resolve
- [x] 1.7 Run `cd design-system && npm run build` to verify build works
- [x] 1.8 Run `cd design-system && npm test` to verify all 101 tests pass

## 2. Root-Level Project Setup

- [x] 2.1 Create root `package.json` as orchestrator (`name: "pos"`, `private: true`, `type: "module"`)
- [x] 2.2 Update `.gitignore` to cover Python (`__pycache__/`, `*.pyc`, `.venv/`, `*.egg-info/`), Docker, IDE (`.idea/`, `.vscode/`), env files (`.env`, `.env.local`), and existing Node patterns
- [x] 2.3 Update `openspec/config.yaml` context to reflect the full pOS project scope (not just design system)

## 3. Frontend Shell — Directory Structure

- [x] 3.1 Create `frontend/shell/` directory with `index.html` and `app-shell.js`
- [x] 3.2 Create `frontend/shared/services/` with placeholder files: `api-client.js`, `auth-store.js`, `event-bus.js`, `router.js`, `state-store.js`
- [x] 3.3 Create `frontend/shared/molecules/`, `frontend/shared/organisms/`, `frontend/shared/templates/` directories with `.gitkeep`
- [x] 3.4 Create `frontend/modules/` with subdirectories for each module: `todos`, `notes`, `knowledge-base`, `vault`, `feed-watcher`, `documents`, `photos`, `settings` — each with `molecules/`, `organisms/`, `pages/`, `services/` directories and a `store.js` placeholder
- [x] 3.5 Create `frontend/package.json` (`name: "pos-frontend"`, `private: true`, `type: "module"`)

## 4. Frontend Shell — Core Implementation

- [x] 4.1 Implement `frontend/shared/services/event-bus.js` — singleton `EventTarget` with `emit()` and `on()` helpers
- [x] 4.2 Implement `frontend/shared/services/router.js` — hash-based router that maps route patterns to module names, emits route change events on the event bus
- [x] 4.3 Implement `frontend/shell/app-shell.js` — `<pos-app-shell>` Web Component with Shadow DOM: sidebar nav (links for all 8 modules), content area, theme toggle, integration with router and module loader
- [x] 4.4 Implement dynamic module loader in `app-shell.js` — on route change, dynamically import the module's page component, insert into content area, remove previous
- [x] 4.5 Create placeholder page components for each module (e.g., `frontend/modules/todos/pages/pos-todos-app.js`) that render module name + "Coming soon"
- [x] 4.6 Implement `frontend/shell/index.html` — loads design system bundle + app shell, sets default theme (`data-pos-theme="light"`), renders `<pos-app-shell>`
- [x] 4.7 Create frontend dev server (`frontend/server.js`) — zero-dependency Node HTTP server serving the app shell, design system assets, and frontend source files with SPA hash-routing fallback

## 5. Backend Foundation — Shared Library

- [x] 5.1 Create `backend/shared/pos_common/` package with `__init__.py` and `pyproject.toml` (installable via `pip install -e`)
- [x] 5.2 Implement `pos_common/config.py` — `BaseServiceConfig` extending Pydantic `BaseSettings` with `DATABASE_URL`, `RABBITMQ_URL`, `JWT_SECRET_KEY`, `SERVICE_NAME`, `DEBUG` fields and sensible local dev defaults
- [x] 5.3 Implement `pos_common/database.py` — async SQLAlchemy engine/session factory, `UserScopedBase` declarative base with auto `id` (UUID), `user_id` (UUID, indexed), `created_at`, `updated_at` columns
- [x] 5.4 Implement `pos_common/events.py` — async helpers using aio-pika for `publish_event(routing_key, data)` and `subscribe(pattern, handler)` on a `pos.events` topic exchange
- [x] 5.5 Implement `pos_common/auth.py` — `validate_token(token)` returning `user_id`, RS256 JWT validation, `AuthenticationError` exception
- [x] 5.6 Implement `pos_common/schemas.py` — shared Pydantic schemas for pagination (`PaginatedResponse`), error responses (`ErrorResponse`), health check (`HealthResponse`)
- [x] 5.7 Implement `pos_common/exceptions.py` — `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ValidationError` with HTTP status code mappings
- [x] 5.8 Create `backend/.env.example` with documented entries for all config variables

## 6. Backend Foundation — API Gateway

- [x] 6.1 Create `backend/gateway/app/main.py` — FastAPI app with CORS middleware, health check endpoint (`GET /health`)
- [x] 6.2 Create `backend/gateway/app/middleware/auth.py` — JWT auth middleware that extracts `user_id` from token and injects into `request.state.user_id`, skips public endpoints (health, login, register)
- [x] 6.3 Create `backend/gateway/app/routes.py` — route definitions with path prefix mapping to services (stubs for now)
- [x] 6.4 Create `backend/gateway/requirements.txt` with FastAPI, uvicorn, and pos_common dependency
- [x] 6.5 Create `backend/gateway/Dockerfile` (multi-stage, Python 3.12 slim base)

## 7. Backend Foundation — Sample Service Skeleton

- [x] 7.1 Create `backend/services/sample/app/main.py` — FastAPI app factory with health check
- [x] 7.2 Create `backend/services/sample/app/models.py` — example model extending `UserScopedBase`
- [x] 7.3 Create `backend/services/sample/app/schemas.py` — example Pydantic request/response schemas
- [x] 7.4 Create `backend/services/sample/app/routes.py` — example CRUD endpoints
- [x] 7.5 Create `backend/services/sample/app/service.py` — example business logic layer
- [x] 7.6 Create `backend/services/sample/app/events.py` — example event publisher
- [x] 7.7 Set up Alembic for the sample service: `alembic.ini`, `migrations/env.py`, initial migration
- [x] 7.8 Create `backend/services/sample/requirements.txt` and `Dockerfile`
- [x] 7.9 Create `backend/services/sample/tests/` with a basic test for the health endpoint

## 8. Infrastructure — Docker Compose

- [x] 8.1 Create `backend/docker-compose.yml` with PostgreSQL 16 service (port 5432, named volume `pos-pgdata`, init database `pos`, user `pos`, password `pos`)
- [x] 8.2 Add RabbitMQ 3.13 service with management plugin (ports 5672 + 15672, named volume `pos-rabbitmq-data`, default guest credentials for dev)
- [x] 8.3 Verify `docker compose -f backend/docker-compose.yml up -d` starts both services and they're accessible

## 9. Dev Tooling — Makefile and Setup

- [x] 9.1 Create root `Makefile` with `setup` target (delegates to `infra/scripts/setup-dev.sh`)
- [x] 9.2 Add `dev` target — starts Docker infra, backend gateway, frontend dev server
- [x] 9.3 Add `dev-ds`, `dev-frontend`, `dev-backend` scoped targets
- [x] 9.4 Add `stop` target — stops all running processes and Docker containers
- [x] 9.5 Add `test`, `test-ds`, `test-frontend`, `test-backend` targets
- [x] 9.6 Add `build`, `build-ds` targets
- [x] 9.7 Add `db-migrate`, `db-seed`, `db-reset` targets
- [x] 9.8 Create `infra/scripts/setup-dev.sh` — check prerequisites (Python 3.12+, Node 18+, Docker), create venv, install Python deps, install Node deps, pull Docker images, init DB
- [x] 9.9 Make `setup-dev.sh` executable and verify idempotency (run twice without errors)

## 10. Infra Placeholders

- [x] 10.1 Create `infra/docker/` directory with placeholder `Dockerfile.frontend` and `nginx.conf`
- [x] 10.2 Create `infra/k8s/` directory with `.gitkeep`

## 11. Verification

- [x] 11.1 Run `cd design-system && npm test` — all 101 tests pass
- [x] 11.2 Run `cd design-system && npm run preview` — showcase page loads in browser
- [x] 11.3 Run `make setup` from a clean state — completes without errors (requires Python 3.10+ to be installed)
- [x] 11.4 Run `make dev` — all services start (Docker infra + gateway + frontend shell)
- [x] 11.5 Navigate to frontend shell in browser — sidebar visible, theme toggle works, routes switch between placeholder modules
- [x] 11.6 Hit gateway health check (`curl localhost:8000/health`) — returns OK
- [x] 11.7 Verify `make test-ds` runs design system tests successfully
