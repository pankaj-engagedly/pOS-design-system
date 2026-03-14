# pOS — Personal Operating System

A self-hosted personal hub with modular micro-services and a browser-native frontend. Built with Web Components (no framework), Python/FastAPI micro-services, and JWT authentication.

**Status:** Phase 1 complete — auth + todos working end-to-end

---

## Quick Start

### Prerequisites

- Python 3.10+ (Homebrew `postgresql@17` recommended)
- Node.js 18+
- Docker (for RabbitMQ)
- PostgreSQL (local Homebrew install)

### First-time setup

```bash
make setup     # installs deps, builds design system, pulls Docker images
```

### Start everything

```bash
make dev       # checks Postgres, starts RabbitMQ, runs migrations, starts all services
```

### Stop everything

```bash
make stop      # stops all services, frontend, and Docker containers
```

---

## Services & Ports

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Frontend** | 3001 | http://localhost:3001 | App UI — open this in your browser |
| Gateway | 8000 | http://localhost:8000 | API gateway, JWT auth middleware |
| Auth API | 8001 | http://localhost:8001 | Registration, login, token management |
| Todo API | 8002 | http://localhost:8002 | Lists, tasks, subtasks CRUD |
| RabbitMQ | 5672 / 15672 | http://localhost:15672 | Message broker (management UI) |
| PostgreSQL | 5432 | — | Local Homebrew install |

API docs (Swagger): http://localhost:8000/docs

Logs: `/tmp/pos-logs/*.log`

---

## Architecture

```
Browser (:3001)
  │
  ├── frontend/shell/        App shell (sidebar, routing, auth guards)
  ├── frontend/modules/      Feature modules (auth, todos, notes, ...)
  ├── frontend/shared/       Shared molecules, organisms, services
  └── design-system/dist/    Web Component atoms (ui-button, ui-input, ...)
        │
        │  /api/* proxied
        ▼
Gateway (:8000)              JWT validation, request proxying
  ├── /api/auth/* ──► Auth Service (:8001)    users, tokens
  └── /api/todos/* ─► Todo Service (:8002)    lists, tasks, subtasks
                          │
                     PostgreSQL (:5432)    shared database, per-service tables
                     RabbitMQ (:5672)      domain events (best-effort)
```

### Key Design Decisions

- **Web Components + Shadow DOM** — no React/Vue/Angular, zero framework runtime
- **Atomic Design** — atoms (design system) → molecules/organisms (shared) → pages (modules)
- **Micro-services** — each service owns its domain, shares a database with separate Alembic version tables
- **JWT auth** — access token in memory, refresh token in localStorage, gateway validates
- **API gateway** — single entry point, proxies to services, injects `X-User-Id` header

---

## Project Structure

```
pOS-design-system/
├── frontend/                    Browser app
│   ├── shell/                   App shell + index.html
│   ├── modules/                 Feature modules
│   │   ├── auth/pages/          Login & register pages
│   │   ├── todos/               Todo app (pages, services, store, tests)
│   │   ├── notes/               Placeholder
│   │   ├── knowledge-base/      Placeholder
│   │   ├── vault/               Placeholder
│   │   └── ...                  (feeds, documents, photos, settings)
│   ├── shared/
│   │   ├── molecules/           Reusable UI pieces (task-item, task-form, ...)
│   │   ├── organisms/           Composed UI (task-list, list-sidebar)
│   │   └── services/            Auth store, API client, router, event bus
│   └── server.js                Dev server with API proxy
│
├── backend/
│   ├── gateway/                 API gateway (FastAPI)
│   │   └── app/                 Routes, proxy, auth middleware
│   ├── services/
│   │   ├── auth/                Auth service (FastAPI)
│   │   │   ├── app/             Models, routes, service logic
│   │   │   └── migrations/      Alembic (alembic_version_auth)
│   │   └── todos/               Todo service (FastAPI)
│   │       ├── app/             Models, routes, service logic, events
│   │       └── migrations/      Alembic (alembic_version_todos)
│   ├── shared/                  pos_common library (auth, database, config, events)
│   ├── .env                     Local dev config
│   └── docker-compose.yml       RabbitMQ (Postgres via Homebrew)
│
├── design-system/               Web Component library
│   ├── src/components/          17 components (button, input, card, dialog, ...)
│   ├── src/core/                PosBaseElement, define helper
│   ├── src/plugins/             Plugin loader + host SDK
│   ├── tokens/                  Raw + semantic design tokens
│   ├── dist/                    Built CSS + JS bundle
│   └── test/                    @web/test-runner + Playwright tests
│
├── infra/
│   └── scripts/                 dev-start.sh, dev-stop.sh, setup-dev.sh
│
├── openspec/                    Specs & change tracking
│   ├── specs/                   Main capability specs
│   └── changes/                 Active & archived changes
│
└── Makefile                     Dev commands
```

---

## Make Targets

| Command | Description |
|---------|-------------|
| `make setup` | First-time setup (deps, build, Docker images) |
| `make dev` | Start full stack (Postgres check → RabbitMQ → migrations → services) |
| `make stop` | Stop all services and Docker containers |
| `make dev-ds` | Start design system preview only |
| `make dev-frontend` | Start frontend server only |
| `make test` | Run all tests (design system + backend) |
| `make test-ds` | Run design system tests |
| `make test-backend` | Run backend pytest tests |
| `make build` | Build design system |
| `make db-migrate` | Run Alembic migrations for all services |

---

## Design System

17 Web Components built on `PosBaseElement` with Shadow DOM and `adoptedStyleSheets`:

`ui-button` · `ui-input` · `ui-card` · `ui-dialog` · `ui-alert` · `ui-badge` · `ui-tag` · `ui-checkbox` · `ui-radio` · `ui-toggle` · `ui-select` · `ui-textarea` · `ui-progress` · `ui-spinner` · `ui-divider` · `ui-icon` · `ui-tooltip`

Two-tier token system: raw values (`colors.json`, `spacing.json`, ...) → semantic aliases (`base.json`, `dark.json`, ...) → CSS custom properties (`--pos-*`).

Light + dark themes via `[data-pos-theme]` attribute.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Web Components, Shadow DOM, ES Modules |
| Design System | Custom elements, CSS Custom Properties |
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async) |
| Database | PostgreSQL 17 |
| Messaging | RabbitMQ (domain events, best-effort) |
| Auth | JWT (HS256), bcrypt password hashing |
| Testing | @web/test-runner + Playwright, pytest |
| Dev Tooling | Makefile, esbuild, Alembic |
