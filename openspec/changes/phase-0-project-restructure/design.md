## Context

The repo currently has a flat structure where all design system files (src/, tokens/, test/, dist/, etc.) live at the root alongside package.json, esbuild.config.js, and server.js. This worked for Phase 0 of the design system but cannot accommodate the full pOS application which adds: a frontend app shell with micro-frontend modules (vanilla JS + Web Components + Atomic Design), a Python backend (FastAPI microservices), infrastructure configs (Docker Compose, Kubernetes), and cross-cutting tooling.

Current root-level files that must move into `design-system/`:
- `src/` (17 components, core, plugins, styles)
- `tokens/` (raw + semantic + build script)
- `test/` (101 tests)
- `dist/` (built output)
- `examples/` (showcase, demos)
- `esbuild.config.js`, `web-test-runner.config.js`, `server.js`
- `package.json` (becomes design-system-specific; root gets a new orchestrator package.json)

Files that stay at root: `openspec/`, `docs/`, `.claude/`, `.gitignore`, `README.md`.

**Constraints:**
- All 101 design system tests must pass after the move
- No changes to component source code — only config paths update
- Python environment must be isolated (venv), not pollute Node setup
- Docker Compose for infrastructure only (PostgreSQL, RabbitMQ) — services run natively during dev for faster iteration
- OpenSpec config needs updating to reflect the broader project scope

## Goals / Non-Goals

**Goals:**
- Establish the monorepo directory structure for the full pOS project
- Move design system into a self-contained subdirectory with its own package.json and scripts
- Create a working frontend app shell that loads the design system and renders a sidebar + content area
- Create a Python backend foundation: shared library, API gateway scaffold, one sample service skeleton
- Set up Docker Compose for PostgreSQL 16 and RabbitMQ (dev infrastructure)
- Create a Makefile that provides a consistent interface for all dev operations
- Ensure the design system continues to work independently (`cd design-system && npm test`)

**Non-Goals:**
- Implementing any application features (auth, todos, etc.) — that's Phase 1
- Setting up CI/CD pipelines — that's Phase 5
- Kubernetes manifests — just placeholder directories
- Production Docker images for services — just infrastructure containers
- Database migrations or schemas — just the migration tooling (Alembic setup)
- Frontend module implementations — just the module loader and empty slots

## Decisions

### 1. Design system gets its own package.json

The `design-system/` directory becomes a standalone Node package. It keeps its own `package.json` with all current devDependencies (esbuild, @web/test-runner, etc.). The root `package.json` becomes a lightweight orchestrator — no npm workspaces (adds complexity for two packages), just Makefile targets that `cd` into subdirectories.

**Alternative considered:** npm workspaces. Rejected because we only have two JS packages (design-system and frontend), and workspaces add hoisting complexity. A Makefile is simpler and also handles the Python backend, which npm workspaces cannot.

### 2. Frontend app shell: minimal vanilla JS router

The app shell is a single `index.html` + `app-shell.js` that provides:
- Hash-based routing (`#/todos`, `#/notes`, etc.) — simpler than History API, no server-side fallback needed
- A layout with sidebar navigation and content area
- A dynamic module loader: when a route activates, it imports the corresponding module's entry JS file, which registers a Web Component (e.g., `<pos-todos-app>`), and the shell places it in the content area
- Design system loaded via `<script type="module" src="/design-system/dist/pos-design-system.js">`

Hash routing chosen over History API because: no server config needed, works with static file servers, simpler for a dev setup. Can switch to History API later if needed.

### 3. Backend: FastAPI with async SQLAlchemy

Each service follows a consistent pattern:
```
services/<name>/
├── app/
│   ├── main.py        # FastAPI app factory
│   ├── models.py      # SQLAlchemy models (all include user_id FK)
│   ├── schemas.py     # Pydantic request/response schemas
│   ├── routes.py      # API endpoints
│   ├── service.py     # Business logic (separated from routes)
│   └── events.py      # RabbitMQ event publishers
├── migrations/         # Alembic (per-service migration chain)
├── tests/
├── requirements.txt
└── Dockerfile
```

The shared library (`backend/shared/pos_common/`) provides:
- `database.py`: Async SQLAlchemy session factory, `UserScopedBase` model mixin (auto-adds `user_id` column + query filtering)
- `config.py`: Pydantic Settings-based config from environment variables
- `events.py`: aio-pika helpers for publishing/subscribing to RabbitMQ
- `auth.py`: JWT token validation, `user_id` extraction helper
- `schemas.py`: Shared Pydantic schemas (pagination, error responses)
- `exceptions.py`: Common HTTP exception classes

**Alternative considered:** Django. Rejected because FastAPI is async-native, lighter weight, auto-generates OpenAPI docs, and is a better learning target. Django's ORM doesn't support async well, and its "batteries included" approach would fight with the microservice architecture.

### 4. Docker Compose: infrastructure only, services run natively

For local development, Docker Compose runs only infrastructure:
- PostgreSQL 16 (port 5432, persistent volume)
- RabbitMQ 3.13 with management plugin (ports 5672 + 15672, persistent volume)

Python services run natively (not in containers) during development for:
- Faster iteration (no container rebuild on code change)
- Easier debugging (attach debugger directly)
- Simpler log viewing

**Alternative considered:** All services in Docker Compose. Rejected for dev speed. Containers for services are Phase 5 (production deployment).

### 5. Makefile as the universal entry point

The Makefile is the single interface for all operations:

```makefile
# Infrastructure
setup          # One-time: Python venv, Node deps, Docker pull, DB init
dev            # Start everything: Docker infra + backend services + frontend dev server
dev-ds         # Just design system (cd design-system && npm run preview)
dev-frontend   # Just frontend dev server
dev-backend    # Docker infra + all Python services
stop           # Stop all running services and Docker containers

# Testing
test           # All tests (design system + frontend + backend)
test-ds        # cd design-system && npm test
test-frontend  # cd frontend && npm test
test-backend   # cd backend && pytest

# Build
build          # Production build (design system + frontend)
build-ds       # cd design-system && npm run build

# Database
db-migrate     # Run pending Alembic migrations for all services
db-seed        # Load development seed data
db-reset       # Drop and recreate all schemas (destructive)
```

### 6. Frontend dev server: simple Node static server

The frontend app shell needs a dev server. Rather than adding a dependency (like Vite), we'll extend the pattern from the existing `server.js` — a zero-dependency Node HTTP server. It serves:
- `/` → `frontend/shell/index.html`
- `/design-system/dist/*` → design system built assets
- `/frontend/*` → frontend source files (ESM, no bundling during dev)
- Falls back to SPA routing (returns index.html for unmatched routes)

The design system's existing `server.js` remains for standalone DS development.

### 7. Python virtual environment: single venv at `backend/.venv`

One shared venv for all backend services. Each service has its own `requirements.txt`, but they're all installed into the same venv. This simplifies the dev setup (one `pip install` command) and avoids managing N separate venvs.

**Alternative considered:** Per-service venvs. Rejected for dev simplicity. In production (Docker), each service has its own isolated environment naturally. During dev, a shared venv is fine since we control all dependencies.

### 8. OpenSpec config update

The `openspec/config.yaml` context section needs updating to reflect the broader project — it currently describes only the design system. The updated context should cover all layers (frontend, backend, infra) while preserving the design system conventions.

## Risks / Trade-offs

**[Risk] Design system test paths break after move** → Mitigation: All test imports use relative paths (`../src/components/...`). Since `test/` and `src/` move together, internal paths don't change. Only `web-test-runner.config.js` file glob (`test/**/*.test.js`) needs to remain relative. Verify with `cd design-system && npm test` immediately after move.

**[Risk] Git history for moved files becomes harder to trace** → Mitigation: Use `git mv` for the move. Git tracks renames well with `git log --follow`. This is a one-time cost.

**[Risk] Shared Python venv creates dependency conflicts between services** → Mitigation: Unlikely at this scale (all services use the same framework versions). If conflicts arise, switch to per-service venvs. Docker isolation in production prevents any production impact.

**[Risk] Hash routing limits deep linking and SEO** → Mitigation: This is a private personal app, SEO is irrelevant. Deep linking works fine with hash routes (`#/todos/123`). Can migrate to History API later if needed.

**[Risk] No hot reload for Python services in dev** → Mitigation: FastAPI's `--reload` flag with uvicorn handles this natively. Each service starts with `uvicorn app.main:app --reload`.

**[Trade-off] No npm workspaces** → Simpler setup, but means no shared dependency hoisting. Since design-system and frontend have minimal overlap (design system is dev-only deps, frontend will have Tiptap later), this is acceptable.

**[Trade-off] Infrastructure in Docker but services native** → Split environment (some things in containers, some not). Adds slight cognitive overhead, but the dev speed benefit is worth it. The Makefile abstracts this — `make dev` handles both.
