## 1. Backend Service Scaffold

- [x] 1.1 Create `backend/services/notes/` directory structure: `app/__init__.py`, `app/main.py`, `app/models.py`, `app/schemas.py`, `app/routes.py`, `app/service.py`, `app/events.py`, `requirements.txt`, `alembic.ini`
- [x] 1.2 Create `app/main.py` — FastAPI app with lifespan (init/close DB + RabbitMQ), UserIdMiddleware, router mounted at `/api/notes`, health endpoint
- [x] 1.3 Create `requirements.txt` with fastapi, uvicorn, sqlalchemy, asyncpg, alembic, aio-pika, pydantic-settings, and local pos_common dependency

## 2. Data Models & Migration

- [x] 2.1 Create `app/models.py` — Folder model (UserScopedBase): name, position; unique constraint on (user_id, name)
- [x] 2.2 Create `app/models.py` — Note model (UserScopedBase): folder_id (nullable FK), title, content (JSONB), preview_text, color, is_pinned, is_deleted, deleted_at, position, search_vector (tsvector)
- [x] 2.3 Create `app/models.py` — Tag model (UserScopedBase): name; unique constraint on (user_id, name). NoteTag association table: note_id, tag_id (composite PK)
- [x] 2.4 Set up Alembic config — `alembic.ini` with version_table=alembic_version_notes, `migrations/env.py`, `migrations/script.py.mako`
- [x] 2.5 Create initial migration `001_create_notes_tables.py` — all tables, FK constraints, GIN index on search_vector, unique constraints

## 3. Schemas & Preview Text Utility

- [x] 3.1 Create `app/schemas.py` — FolderCreate, FolderUpdate, FolderResponse schemas
- [x] 3.2 Create `app/schemas.py` — NoteCreate, NoteUpdate, NoteResponse, NoteSummaryResponse schemas (summary excludes content, includes tags)
- [x] 3.3 Create `app/schemas.py` — TagResponse, TagCreate, ReorderRequest schemas
- [x] 3.4 Create `app/utils.py` — `extract_preview_text(content_json)` function: recursively walk Tiptap JSON, extract text nodes, truncate to 200 chars

## 4. Service Layer (Business Logic)

- [x] 4.1 Create `app/service.py` — Folder CRUD: get_folders, create_folder, update_folder, delete_folder (nullify note folder_ids), reorder_folders
- [x] 4.2 Create `app/service.py` — Note CRUD: get_notes (with filters: folder_id, tag, is_pinned, is_deleted, search), create_note, get_note, update_note, reorder_notes
- [x] 4.3 Create `app/service.py` — Note lifecycle: soft_delete_note (set is_deleted + deleted_at), restore_note, permanent_delete_note
- [x] 4.4 Create `app/service.py` — Tag management: get_tags (with note counts), add_tag_to_note (create-if-not-exists), remove_tag_from_note
- [x] 4.5 Create `app/service.py` — Auto-extract preview_text on note create/update when content changes; update search_vector

## 5. Routes & Events

- [x] 5.1 Create `app/routes.py` — Folder endpoints: GET /folders, POST /folders, PATCH /folders/:id, DELETE /folders/:id, PATCH /folders/reorder
- [x] 5.2 Create `app/routes.py` — Note endpoints: GET /notes (query params), POST /notes, GET /notes/:id, PATCH /notes/:id, DELETE /notes/:id, DELETE /notes/:id/permanent, POST /notes/:id/restore, PATCH /notes/reorder
- [x] 5.3 Create `app/routes.py` — Tag endpoints: GET /tags, POST /notes/:id/tags, DELETE /notes/:id/tags/:tag_id
- [x] 5.4 Create `app/events.py` — publish_note_event helper: note.created, note.updated, note.deleted (best-effort, log on failure)

## 6. Infrastructure & Gateway

- [x] 6.1 Add notes service proxy route to `backend/gateway/app/routes.py` — `/api/notes/{path}` → `http://localhost:8004`
- [x] 6.2 Update `infra/scripts/dev-start.sh` — start notes service on :8004, run notes migrations, log to `/tmp/pos-logs/notes.log`
- [x] 6.3 Update `infra/scripts/dev-stop.sh` — stop notes service process
- [x] 6.4 Update `Makefile` — add notes to db-migrate target, any notes-specific targets

## 7. Backend Testing

- [x] 7.1 Create `backend/services/notes/tests/test_notes.py` — test note CRUD, soft delete/restore, permanent delete
- [x] 7.2 Create `backend/services/notes/tests/test_folders.py` — test folder CRUD, delete nullifies notes
- [x] 7.3 Create `backend/services/notes/tests/test_search.py` — test full-text search, user scoping, excludes deleted
- [x] 7.4 Create `backend/services/notes/tests/test_tags.py` — test tag CRUD, create-if-not-exists, note association
- [x] 7.5 Create `backend/services/notes/tests/test_utils.py` — test extract_preview_text with various Tiptap JSON structures

## 8. Frontend Store & API Service

- [x] 8.1 Create `frontend/modules/notes/store.js` — reactive store with initial state: folders, selectedFolderId, selectedView, notes, selectedNoteId, selectedNote, viewMode, searchQuery, loading, error
- [x] 8.2 Create `frontend/modules/notes/services/notes-api.js` — all API wrappers: getFolders, createFolder, updateFolder, deleteFolder, reorderFolders, getNotes, createNote, getNote, updateNote, deleteNote, permanentDeleteNote, restoreNote, reorderNotes, searchNotes, getTags, addTag, removeTag

## 9. Frontend Components — Folder Sidebar

- [x] 9.1 Create `frontend/modules/notes/components/pos-folder-sidebar.js` — smart views (All Notes, Pinned, Trash) + user folder list + "New Folder" button; dispatches folder-select, folder-create, folder-delete, folder-rename events; shows note counts as badges

## 10. Frontend Components — Note List & Cards

- [x] 10.1 Create `frontend/modules/notes/components/pos-note-list-item.js` — compact row: title, preview_text, relative date, pin icon, color stripe; dispatches note-select event
- [x] 10.2 Create `frontend/modules/notes/components/pos-note-card.js` — card with ui-card: title, preview excerpt, color tint, pin icon, tag badges; dispatches note-select event
- [x] 10.3 Create `frontend/modules/notes/components/pos-note-list.js` — container with toolbar (search input, view toggle, new note button) + note list/grid rendering; switches between list-item and card based on view-mode attribute

## 11. Frontend Components — Rich Text Editor

- [x] 11.1 Install Tiptap dependencies: `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`
- [x] 11.2 Create `frontend/modules/notes/components/pos-note-toolbar.js` — formatting buttons (Bold, Italic, Strike, H1-H3, Bullet List, Ordered List, Code, Code Block, Blockquote, HR, Link); dispatches toolbar-action events; highlights active formats
- [x] 11.3 Create `frontend/modules/notes/components/pos-note-editor.js` — wraps Tiptap in Shadow DOM; title input + editor area; initializes from note content JSON; emits note-content-change and note-title-change events with 500ms debounce; shows placeholder when no note selected

## 12. Frontend Page Orchestrator

- [x] 12.1 Rewrite `frontend/modules/notes/pages/pos-notes-app.js` — three-panel layout (folder sidebar | note list | editor); subscribe to store; load folders + notes on mount
- [x] 12.2 Wire folder events — folder-select updates store + fetches filtered notes; folder-create/delete/rename call API + refresh folders
- [x] 12.3 Wire note list events — note-select fetches full note + opens editor; note-create creates empty note in current folder
- [x] 12.4 Wire editor events — note-content-change and note-title-change trigger auto-save (PATCH) with debounce; show save status indicator
- [x] 12.5 Wire note actions — pin/unpin, color change, move to folder, delete (soft), restore, permanent delete with confirmation dialog
- [x] 12.6 Wire tag management — add/remove tags from editor panel, refresh note after tag changes
- [x] 12.7 Wire search — debounced search input triggers API search, results update note list
- [x] 12.8 Persist and restore selection (folder/view, view mode) via localStorage

## 13. Integration & Polish

- [ ] 13.1 Verify gateway proxying end-to-end: create folder, create note, edit content, search, delete, restore
- [ ] 13.2 Verify Tiptap works inside Shadow DOM — paste handling, formatting, content round-trip (JSON → editor → JSON)
- [ ] 13.3 Test responsive behavior — panels collapse gracefully on narrower viewports
- [ ] 13.4 Verify auto-save flow — edit, debounce, save indicator, reload shows saved content
