# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make dev                          # Start everything (Postgres, RabbitMQ, migrations, all services, frontend)
make dev LOG_LEVEL=TRACE          # All services at TRACE
make dev kb=TRACE notes=DEBUG     # Per-service log levels
make stop                         # Stop everything

make test                         # Run design system + backend tests
make test-ds                      # Design system tests only (web-test-runner + Playwright)
make test-backend                 # Backend tests only (pytest)
cd design-system && npm test      # Same as make test-ds
cd backend && .venv/bin/python -m pytest services/todos/tests/ -v  # Single service tests

make build-ds                     # Build design system (tokens + esbuild bundle)
make setup                        # First-time setup (venv, deps)
make db-reset                     # Drop and recreate database, re-run all migrations
```

**URLs**: App http://localhost:3001 | Design System http://localhost:3000 | RabbitMQ http://localhost:15672

**Logs**: `/tmp/pos-logs/*.log` (one per service)

## Architecture

**pOS** is a personal operating system — a monorepo with a Web Component design system, vanilla JS frontend, and Python microservices backend.

### Design System (`design-system/`)
Web Component library built with esbuild. Components extend `PosBaseElement` (shadow DOM, reactive render). Token system: raw tokens → semantic tokens → CSS custom properties (`--pos-color-*`, `--pos-space-*`). Test with `web-test-runner` + Playwright.

Key shared exports used by the app: `CARD_STYLES`, `TABLE_STYLES`, `ui-tag-input`, `ui-search-input`, `ui-date-picker`, `ui-chips`.

### Frontend (`frontend/`)
- **Shell** (`shell/`): App shell with hash-based router, sidebar nav, lazy module loading
- **Shared** (`shared/`): `api-client.js` (auto-token refresh, 401 handling), `auth-store.js`, `event-bus.js`, `router.js`, `state-store.js`. Shared components: `pos-module-layout`, `pos-sidebar`, `pos-page-header`, `pos-confirm-dialog`
- **Modules** (`modules/`): auth, todos, notes, vault, documents, knowledge-base, photos, watchlist, portfolio. Each has `pages/`, `components/`, `services/`, optional `store.js`
- **Dev server** (`server.js`): Port 3001, proxies `/api/*` to gateway (8000), SPA fallback to `shell/index.html`

### Backend (`backend/`)
- **Gateway** (`gateway/`, :8000): JWT validation, injects `X-User-Id` header, httpx proxy to services
- **Services** (:8001-8010): FastAPI + async SQLAlchemy + Alembic. Each service has `main.py`, `models.py`, `schemas.py`, `routes.py`, `service.py`, `events.py`, own `migrations/`
- **Shared** (`shared/`): `pos_contracts` (UserScopedBase, BaseServiceConfig, tag_service, schemas), `pos_events` (EventBus with RabbitMQ transport)
- **Database**: Single PostgreSQL 17 (Homebrew), per-service Alembic version tables (`alembic_version_<service>`)

**Port map**: gateway 8000 | auth 8001 | todos 8002 | attachments 8003 | notes 8004 | documents 8005 | vault 8006 | kb 8007 | photos 8008 | watchlist 8009 | portfolio 8010

## Critical Patterns

**Frontend event binding**: Bind listeners once in `connectedCallback()` with a guard flag, NEVER in `render()`. Re-binding causes stacked listeners (duplicate dialogs, double-fired events). Use event delegation on shadow root.

**Shadow DOM**: Always `this.shadow.querySelector()` — `document.querySelector()` does not pierce shadow DOM.

**Auth flow**: Access token in memory (120 min), refresh token in localStorage (7 days, rotated). Proactive refresh 2 min before expiry. `tryRestoreSession()` on app load. Gateway validates JWT and injects `X-User-Id`; services read via `UserIdMiddleware`.

**Service models**: Auth models extend `Base`; all user-owned models extend `UserScopedBase` (auto UUIDv7 id, user_id, timestamps).

**Sidebar composition**: All module sidebars use `pos-sidebar` base shell + `SIDEBAR_NAV_STYLES` export inside `pos-module-layout`.

**Dialog close behavior**: Dialogs close via X button or Escape only, never on overlay click.

**Shared tags**: `pos_contracts.tag_service` with entity_type strings. Tags page uses `ui-search-input`. Rename merges, delete cascades.

**Vault encryption**: Fernet per-user key via HKDF(APP_SECRET_KEY, user_id) — server-side only.

**Events**: Best-effort, non-blocking RabbitMQ via `pos_events`. Services work without RabbitMQ.

**Alembic**: Run from service directory. Each service has `version_table = alembic_version_<service>` in `alembic.ini`. Shared migrations in `backend/shared/migrations/` run first.

## Common Pitfalls

**Shadow DOM `composed` events**: `change` has `composed: false` — does NOT cross shadow boundaries. Custom events also default to `composed: false`. Always set `bubbles: true, composed: true` on custom events that need to cross shadow DOM. Form components must manually re-dispatch `change`.

**Shadow DOM `e.target` retargeting**: Inside a host-level click listener, `e.target` is retargeted to the host element itself, not the inner element clicked. Use `e.composedPath()[0]` to get the actual originating element (e.g., for backdrop/overlay click detection).

**Listener accumulation from `_eventsBound` reset**: Shadow root listeners survive `innerHTML` replacement (they're on the root, not child nodes). If `_render()` resets `_eventsBound = false`, each render adds duplicate listeners. Never reset `_eventsBound` in `_render()` — only on full teardown.

**SQLAlchemy async lazy load**: `session.refresh(obj)` does NOT eagerly load relationships in async mode — accessing them throws `MissingGreenlet`. Re-fetch with `selectinload()` instead. Example: after `create_task`, return via `get_task()` (which uses `selectinload(Task.subtasks)`), not `session.refresh(task)`.

**Dialog z-index in shadow DOM**: `position: fixed` dialogs inside shadow DOM (nested in `pos-module-layout` with `overflow: hidden`) render behind sticky headers. Fix: style the dialog's host element with `position: relative; z-index: 10000` in the parent component's stylesheet.

**`position: fixed` inside transformed ancestor**: Any ancestor with `transform`, `filter`, or `will-change` becomes a new containing block for `position: fixed` children. The element positions relative to that ancestor, not the viewport. Use `position: absolute; inset: 0` when intentionally scoping to a panel.

**Obsolete V0 token names**: Old names like `--pos-color-bg`, `--pos-color-fg`, `--pos-color-accent` no longer exist. Use semantic tokens: `--pos-color-background-primary`, `--pos-color-text-primary`, `--pos-color-action-primary`, etc.
