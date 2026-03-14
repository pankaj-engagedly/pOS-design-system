# Session Log: Notes Module (Phase 2) + Architecture Discussion

**Date:** 2026-03-14
**Scope:** Full Notes module implementation via OpenSpec, bug fixes, and backend architecture deep-dive

---

## Session Overview

This session built the entire Notes module (Phase 2) — from OpenSpec artifacts through a working feature with rich text editing. After implementation, we fixed several bugs related to Web Components + Shadow DOM patterns. The session ended with an in-depth architecture discussion about `pos_common`, microservice independence, and event system design — connecting Pankaj's production Ruby experience to the pOS Python stack.

---

## Part 1: OpenSpec Artifacts for Notes Module

### What happened
Created the `notes-module-phase-2` change via OpenSpec with the full artifact sequence:

1. **proposal.md** — Notes module inspired by Apple Notes: CRUD, rich text (Tiptap), folders, tags, list/grid views, search, pin, color, soft-delete/archive
2. **design.md** — Three-panel layout (folder sidebar | note list | editor), data models, API design, Tiptap integration
3. **specs/** — Capability specs for backend service, frontend components, editor integration
4. **tasks.md** — Implementation tasks across backend + frontend

### Key design decisions
- **Rich text editor**: Tiptap (headless ProseMirror) — lightweight, extensible, outputs JSON
- **Content storage**: JSONB column for Tiptap document, with a `tsvector` GENERATED column + GIN index for full-text search
- **Three-panel layout**: Folder sidebar, note list (list/grid toggle), and editor panel
- **Soft delete**: `is_deleted` + `deleted_at` columns, trash view, restore capability
- **Backend**: New FastAPI service on port 8004, following the todos service pattern

---

## Part 2: Backend Implementation

### Notes Service (`backend/services/notes/` — port 8004)

**Models** (`app/models.py`):
- `Folder` — UserScopedBase, unique constraint on (user_id, name)
- `Note` — UserScopedBase, JSONB `content`, tsvector `search_vector` (GENERATED column), `is_pinned`, `color`, `is_deleted`, `deleted_at`, FK to folder
- `Tag` — UserScopedBase, unique on (user_id, name)
- `note_tags` — Association table (many-to-many)

**Key patterns**:
- `search_vector` is a PostgreSQL GENERATED column that auto-extracts text from JSONB content for full-text search
- Per-service Alembic version table: `alembic_version_notes`
- Migration `env.py` uses `OWNED_TABLES` filter (same pattern as todos)

**Service layer** (`app/service.py`):
- Full CRUD for folders, notes, tags
- Notes support filtering by folder, pinned, deleted (trash), search query
- Tags use get-or-create pattern
- Soft delete: sets `is_deleted=True` + `deleted_at=now()`, restore clears both

**Routes** (`app/routes.py`):
- Folders: CRUD + reorder
- Notes: CRUD + restore + permanent delete + reorder
- Tags: list, add to note, remove from note
- All endpoints scoped by `X-User-Id` header (set by gateway)

**Utils** (`app/utils.py`):
- `extract_preview_text(content_json)` — Recursively walks Tiptap JSON, extracts text nodes, truncates to 200 chars for list/card previews

**Events** (`app/events.py`):
- Best-effort RabbitMQ publishing for note lifecycle events

### Gateway update
- Added `NOTES_SERVICE_URL = "http://localhost:8004"` to gateway config
- Added proxy route: `/api/notes/{path:path}` → notes service

### Dev scripts
- `dev-start.sh` — Added notes service startup, `wait_for_port 8004 "notes"`
- `dev-stop.sh` — Updated to include notes service

---

## Part 3: Frontend Implementation

### Tiptap Editor Bundle

**Problem**: The frontend uses a plain static file server — no bundler, no import maps. Bare module specifiers like `import { Editor } from '@tiptap/core'` don't work in browsers.

**Solution**: Created `editor.bundle.js` (741KB) using esbuild:
- `editor-entry.js` — Entry point exporting Editor, StarterKit, Link, Placeholder
- `build-editor.js` — Build script using design-system's esbuild binary
- `package.json` — Added `@tiptap/*` dependencies and `build:editor` script
- Components import from `'../editor.bundle.js'` (relative path, browser-friendly)

### Components

**`pos-folder-sidebar.js`** — Left panel:
- Smart views: All Notes, Pinned, Trash (with note counts)
- User folders with delete button
- New Folder button
- Inline rename via double-click
- Dispatches: `folder-select`, `folder-create`, `folder-delete`, `folder-rename`

**`pos-note-list.js`** — Middle panel:
- Search input with debounced dispatch
- List/grid view toggle
- New Note button
- Renders `pos-note-list-item` (list mode) or `pos-note-card` (grid mode)
- Dispatches: `note-select`, `note-create`, `search-change`, `view-mode-change`

**`pos-note-list-item.js`** — Compact row:
- Title, preview text, relative date, pin icon, color stripe
- Active state styling

**`pos-note-card.js`** — Grid card:
- Color tint background, title, preview (4 lines), tag badges
- Active state styling

**`pos-note-toolbar.js`** — Formatting toolbar:
- Bold, Italic, Strike, Code, H1-H3, Bullet/Ordered List, Blockquote, Code Block, HR, Link
- Heading dropdown menu
- Active format highlighting (synced with editor selection)
- Dispatches: `toolbar-action { action, attrs }`

**`pos-note-editor.js`** — Editor panel:
- Title input with auto-save (500ms debounce)
- Tiptap editor mounted in Shadow DOM
- Content auto-save (500ms debounce)
- Save status indicator (Saving.../Saved/Error)
- Tags area with add/remove capability
- Dispatches: `note-content-change`, `note-title-change`, `tag-add`, `tag-remove`

**`pos-notes-app.js`** — Page orchestrator:
- Three-panel layout wiring all child components
- Handles all events: folder CRUD, note CRUD, search, view mode, auto-save, tags
- Manages store state and API calls

### Store and API
- `store.js` — Reactive store (createStore pattern) for notes module state
- `services/notes-api.js` — All API wrappers for folders, notes, tags, search

---

## Part 4: Bug Fixes

### Bug 1: "Coming Soon" still showing after page load

**Root cause**: `import { Editor } from '@tiptap/core'` is a bare module specifier. Browsers can't resolve it without an import map or bundler. The import silently failed, the app shell caught the error and registered a placeholder component.

**Fix**: Bundled all Tiptap dependencies into `editor.bundle.js` using esbuild. Changed imports to use the relative path `'../editor.bundle.js'`.

### Bug 2: Infinite note creation loop

**Root cause**: `pos-note-list.js` called `_bindEvents()` inside `render()`. Since `render()` is called from `_renderNotes()` on every store update, each call stacked another click listener on the shadow root. One "New Note" click fired `note-create` N times.

**Fix**: Added `_eventsBound` guard flag to `_bindEvents()`. Removed `_bindEvents()` call from `render()`.

```javascript
_bindEvents() {
  if (this._eventsBound) return;
  this._eventsBound = true;
  // ... listeners
}
```

### Bug 3: Can't click or write in the editor

**Root cause**: Circular initialization loop. `_initEditor()` called `this.render()`, and `render()` ended with `requestAnimationFrame(() => this._initEditor())`. This created an infinite loop that constantly destroyed and recreated the editor — it was never stable long enough to accept input.

**Fix**: Separated concerns completely:
- `render()` only builds DOM (no editor logic)
- `_mountEditor()` only initializes Tiptap (no DOM rebuilding)
- `set note(val)` orchestrates: destroy old editor → render DOM → mount new editor

```javascript
set note(val) {
  const prevId = this._note?.id;
  this._note = val;
  if (val?.id !== prevId) {
    this._editor?.destroy();
    this._editor = null;
    this.render();
    if (val) this._mountEditor();
  } else if (val) {
    this._renderTags(); // same note — only refresh tags
  }
}
```

### Bug 4: Toolbar formatting broken + sluggishness while typing

**Root cause**: Same event listener stacking pattern as Bug 2, plus DOM thrashing. `pos-note-toolbar.js` called `_bindEvents()` inside `render()`, and the `activeFormats` setter called `render()` on every keystroke (triggered by Tiptap's `onUpdate` and `onSelectionUpdate`). After 50 keystrokes: 50+ click listeners stacked, formatting toggled on/off/on unpredictably, and full `innerHTML` replacement on every keystroke caused severe lag.

**Fix**: Two changes:
1. **Avoid full re-render on keystrokes**: `activeFormats` setter now calls `_updateActiveButtons()` which just toggles `.active` CSS classes on existing buttons — zero DOM rebuilding. Added `data-format` attribute to buttons for querying.
2. **Guard event binding**: `_bindEvents()` has `_eventsBound` flag, reset only when `render()` actually rebuilds the DOM.

```javascript
set activeFormats(val) {
  this._activeFormats = new Set(val || []);
  this._updateActiveButtons(); // toggle classes, no DOM rebuild
}

_updateActiveButtons() {
  this.shadow.querySelectorAll('.btn[data-format]').forEach(btn => {
    btn.classList.toggle('active', this._activeFormats.has(btn.dataset.format));
  });
}
```

### Recurring pattern / lesson learned

All four bugs stem from the same Web Components + Shadow DOM pattern:

> **Never call `_bindEvents()` inside `render()` when `render()` can be called multiple times.**

Shadow DOM event listeners survive `innerHTML` replacement (they're on the shadow root, not on child elements). Each `render()` → `_bindEvents()` call stacks another listener. Fix: bind once with a guard flag, or use event delegation on the shadow root (bind in `connectedCallback`, delegate via `data-*` attributes).

---

## Part 5: Architecture Discussion — pos_common and Microservice Independence

### The questions
Pankaj raised three architectural concerns about `pos_common`:

1. **Is a shared library good practice for independent deployment?**
2. **Should auth move to the gateway so services don't worry about it?**
3. **Should database connections and event infrastructure be per-service?**

### Current pos_common breakdown

| Module | Used By | What It Does |
|--------|---------|-------------|
| `database.py` | All services | Engine init, session factory, Base + UserScopedBase |
| `auth.py` | Gateway + Auth only | JWT create/validate |
| `events.py` | Todos + Notes | RabbitMQ connect/publish/subscribe |
| `config.py` | All apps | Pydantic BaseSettings |
| `schemas.py` | All apps | HealthResponse, pagination |
| `exceptions.py` | All apps | Error hierarchy with HTTP status codes |

### Recommendation: Share contracts, not infrastructure

**The principle**: A shared library for **types and schemas** (what things look like) is a genuine microservices pattern. A shared library for **database connections and event publishing** (how things work) creates a distributed monolith.

**Proposed split**:

**Package 1: `pos-contracts`** (thin, versioned, shared) — Only types, schemas, interfaces:
- `UserScopedBase` column pattern
- `BaseEvent` envelope schema
- `HealthResponse`, `PaginatedResponse`, `ErrorResponse`
- Exception hierarchy
- Zero runtime dependencies on SQLAlchemy engines, aio-pika connections, etc.

**Package 2: Gone** — Infrastructure moves per-service:
- Each service owns its `db.py` (~40 lines: init engine, session factory, close)
- Each service owns its event publisher (~30 lines)
- Gateway owns token validation
- Auth service owns token creation

### Auth → Gateway (edge authentication)

The gateway already validates JWT and sets `X-User-Id`. Services already just read that header. Making this explicit:
- `validate_token()` moves into gateway code
- `create_access_token()` / `create_refresh_token()` moves into auth service code
- No service behind the gateway ever touches JWT logic

### Event system architecture

This led to a deep discussion connecting Pankaj's Ruby production experience to the Python design.

**Pankaj's Ruby pattern** (production-proven):
- A shared **gem** containing `BaseEvent` (envelope: event_id, event_name, source_service, created_at, payload) + `Publisher` with pluggable transport
- Each service extended `BaseEvent` for concrete events (e.g., `NoteCreatedEvent`)
- Services called `Publisher.publish(event)` — never touched the transport directly
- Transport was pluggable: originally ResqueBus (Redis-based), later migrated to RabbitMQ

**Migration strategy** (dual-publish / strangler fig):
- During ResqueBus → RabbitMQ migration, the gem published to BOTH backends simultaneously
- Subscribers migrated one at a time to consume from RabbitMQ
- No big-bang cutover needed
- This only worked BECAUSE services called the abstract `Publisher.publish()`, not ResqueBus directly

**Python equivalent for pOS** (`pos-events` package):
```
pos-events/
  BaseEvent      — dataclass envelope (event_id, event_name, source_service, created_at, payload)
  Transport      — ABC (connect, publish, subscribe, close)
  RabbitMqTransport — default implementation using aio-pika
  EventBus       — singleton, services call event_bus.publish(event)
  FanoutTransport — publishes to N transports (for migrations)
```

Services define concrete events locally:
```python
# In notes service
class NoteCreated(BaseEvent):
    def __init__(self, note_id, title, folder_id):
        super().__init__(
            event_name="note.created",
            source_service="notes",
            payload={"note_id": note_id, "title": title, "folder_id": folder_id},
        )

await event_bus.publish(NoteCreated(str(note.id), note.title, str(note.folder_id)))
```

### Key takeaway

**pOS sub-goal**: This project is a controlled replay of Pankaj's evolved production architecture — rebuilding from scratch to validate which decisions were right vs expedient. The event bus pattern is proven from production; now it's about expressing it cleanly in Python with the benefit of hindsight.

**Design principles** (from Ruby experience):
- Abstraction over direct coupling
- Don't give developers too many choices (opinionated interfaces)
- Maintain basic structure with extensibility
- Scale or change as situation demands

---

## Files Changed This Session

### Backend (new)
- `backend/services/notes/` — Entire notes service (main, models, schemas, service, routes, events, utils)
- `backend/services/notes/alembic.ini` + `migrations/` — Alembic setup with per-service version table
- `backend/services/notes/tests/` — Test files for notes, folders, search, tags, utils
- `backend/services/notes/requirements.txt`

### Backend (modified)
- `backend/gateway/app/routes.py` — Added notes service proxy
- `backend/gateway/app/main.py` — Added NOTES_SERVICE_URL to config

### Frontend (new)
- `frontend/modules/notes/` — Entire notes module:
  - `components/pos-folder-sidebar.js`
  - `components/pos-note-list.js`
  - `components/pos-note-list-item.js`
  - `components/pos-note-card.js`
  - `components/pos-note-toolbar.js`
  - `components/pos-note-editor.js`
  - `pages/pos-notes-app.js`
  - `services/notes-api.js`
  - `store.js`
  - `editor-entry.js`
  - `editor.bundle.js` (741KB Tiptap bundle)
- `frontend/build-editor.js` — esbuild script for Tiptap bundle
- `frontend/package.json` — Added Tiptap dependencies

### Infrastructure (modified)
- `infra/scripts/dev-start.sh` — Added notes service startup on port 8004
- `infra/scripts/dev-stop.sh` — Updated to include notes

---

## Status at End of Session

- **Notes module**: Functional — create, edit, delete, folders, tags, search, rich text, list/grid views
- **Bugs fixed**: 4 (module loading, infinite creation, editor input, toolbar formatting)
- **Architecture discussion**: Complete — clear path for refactoring pos_common when containerizing
- **Remaining**: Integration verification tasks (manual testing), archive the OpenSpec change
- **Next steps**: Continue Phase 2 (Knowledge Base), or polish Notes UX, or refactor pos_common
