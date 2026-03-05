## Why

The project is evolving from a standalone design system into a full personal hub application (pOS). The current flat structure — where design system files live at the repo root — cannot accommodate a multi-layer architecture with a separate frontend app, Python backend microservices, infrastructure configs, and shared tooling. We need to restructure the monorepo now, before building any application features, to establish clean boundaries between the design system, frontend, backend, and infrastructure layers. See `docs/PROJECT_REQUIREMENTS.md` for the full project vision and architecture.

## What Changes

- **BREAKING**: Move all design system files (src/, tokens/, dist/, test/, examples/, esbuild.config.js, web-test-runner.config.js, server.js) into a `design-system/` subdirectory with its own `package.json`
- Create `frontend/` directory with app shell (routing, layout, module loader), shared services (api-client, auth-store, event-bus, router), shared atomic design layers (molecules, organisms, templates), and module slots for micro-frontends
- Create `backend/` directory with Python shared library (`pos_common` — DB session factory with user_id mixin, config loader, RabbitMQ event helpers, JWT auth utils), API gateway scaffold (FastAPI with auth middleware stub), and a sample service skeleton to validate the pattern
- Create `infra/` directory with Docker Compose for local dev (PostgreSQL 16 + RabbitMQ), and placeholder directories for Docker and Kubernetes configs
- Create root-level `Makefile` with targets: `setup`, `dev`, `test`, `build`, `db-migrate`, `db-seed`, and scoped variants (`dev-backend`, `dev-frontend`, `dev-ds`, `test-backend`, `test-frontend`, `test-ds`)
- Create `setup-dev.sh` script for one-command dev environment setup (Python venv, Node deps, Docker images, DB initialization)
- Update root `package.json` to become a workspace orchestrator (not the design system package)
- Update `.gitignore` for Python artifacts, virtual environments, Docker volumes, and IDE files
- Preserve all OpenSpec config and archive at the root level (unchanged)

## Capabilities

### New Capabilities
- `project-structure`: Monorepo directory layout, workspace organization, and the relationship between design-system, frontend, backend, and infra layers
- `frontend-shell`: App shell architecture — HTML entry point, client-side router, sidebar navigation, content layout, dynamic module loader, theme integration with the design system
- `backend-foundation`: Python shared library (pos_common), FastAPI API gateway scaffold, service skeleton pattern, Docker Compose for PostgreSQL + RabbitMQ
- `dev-tooling`: Makefile targets, setup script, local development workflow, environment configuration

### Modified Capabilities
- `build-pipeline`: Build process changes to accommodate the design system being in a subdirectory. esbuild config paths and output locations update.

## Impact

- **All existing design system code**: Moves into `design-system/`. Internal imports unchanged (relative paths), but root-level scripts and configs need path updates.
- **Test suite**: Must continue passing (101 tests) from the new location. `web-test-runner.config.js` paths may need adjustment.
- **Server**: `server.js` moves into `design-system/`. Frontend app shell will eventually replace it as the primary dev server.
- **OpenSpec**: Stays at root. `openspec/config.yaml` may need updates to reflect the new project scope (no longer design-system-only).
- **New dependencies**: Python 3.12+, Docker, Docker Compose (dev environment). No new Node runtime dependencies.
- **CI/CD**: Not yet in place, but the Makefile establishes the interface that CI will use.
