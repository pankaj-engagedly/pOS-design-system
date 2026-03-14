## Why

Notes is the second vertical slice in pOS (after Todos), proving that the microservice architecture scales to new domains. It's the most-used personal productivity tool — a fast, private, Apple Notes-inspired experience for capturing and organizing thoughts with rich text. Building it now exercises the full stack patterns established in Phase 1 and unlocks Phase 2 (Notes + Knowledge Base).

## What Changes

- **New backend service** (`backend/services/notes/` on `:8004`): FastAPI microservice for notes and folders CRUD, full-text search, soft-delete with restore, following the todos service pattern (UserScopedBase, per-service Alembic, RabbitMQ events)
- **New frontend module** (`frontend/modules/notes/`): Complete notes UI with folder sidebar, note list (list + grid views), rich text editor, search, and quick capture — expanding the existing skeleton
- **Rich text editing**: Integrate Tiptap (headless, ProseMirror-based) as a lightweight rich text editor wrapped in a Web Component — supports bold, italic, headings, lists, code blocks, links, paste handling
- **Gateway routing**: Add `/api/notes/*` → `:8004` proxy route
- **Infrastructure**: Update Makefile and dev scripts to start/stop/migrate the notes service

## Capabilities

### New Capabilities
- `notes-service`: Backend notes microservice — data models (Note, Folder, Tag), REST API, business logic, migrations, events
- `notes-frontend`: Frontend notes module — pages, components (note card, note editor, folder panel, note list/grid), API service, store, rich text integration

### Modified Capabilities
- `backend-foundation`: Adding notes service registration — gateway route for `/api/notes/*` → `:8004`, dev scripts updated to start notes service, Makefile targets for notes migrations
- `frontend-shell`: Router already has notes route placeholder — no spec-level requirement change needed (implementation only)

## Impact

- **New files**: ~15-20 backend files (service, models, schemas, routes, migrations, tests), ~10-12 frontend files (page, components, services, store)
- **New dependency**: Tiptap editor (frontend npm package — `@tiptap/core`, `@tiptap/starter-kit`)
- **Database**: New tables: `notes`, `folders`, `note_tags`, `tags` — all user_id scoped
- **Gateway**: New proxy route `/api/notes/*`
- **Dev infra**: Makefile, dev-start.sh, dev-stop.sh updated for notes service on `:8004`
- **No breaking changes** to existing functionality
