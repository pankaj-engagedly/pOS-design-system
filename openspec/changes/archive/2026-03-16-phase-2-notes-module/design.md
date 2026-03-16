## Context

Phase 1 established the full-stack pattern with Auth + Todos. Notes is the second service, following identical backend patterns (FastAPI, UserScopedBase, per-service Alembic, gateway proxy) and frontend patterns (Web Components, module store, API service, event delegation). The main new complexity is rich text editing — everything else is a proven pattern.

The existing skeleton has `frontend/modules/notes/pages/pos-notes-app.js` (placeholder) and an empty `store.js`. The gateway already lists `/api/notes` as a Phase 2 route. Port `:8004` is reserved for notes.

## Goals / Non-Goals

**Goals:**
- Full CRUD for notes with rich text body (bold, italic, headings, lists, code blocks, links)
- Folder-based organization (one level, like Apple Notes)
- List and grid view toggle for note browsing
- Search across note titles and content
- Pin notes to top, optional color coding
- Soft-delete with trash/restore
- Paste-friendly editor (URLs, formatted text)
- Follow established patterns exactly — no new architectural concepts

**Non-Goals:**
- Real-time collaboration or sharing
- Nested folders (one level only)
- Image embedding in notes (Phase 4 with Documents/Photos)
- Markdown source editing toggle (just rich text WYSIWYG)
- Note versioning / history
- Export to PDF/markdown
- Offline support

## Decisions

### 1. Data Model — Flat tags, single-level folders

**Decision**: Notes belong to an optional folder (nullable FK). Tags are a simple join table (note_tags) with a tags table. No nested folders.

**Why**: Apple Notes uses single-level folders which covers 95% of use cases. Nested folders add tree query complexity (recursive CTEs, path management) with minimal user value at this stage. Tags provide the cross-cutting organization that folders can't.

**Tables**:
```
folders: id, user_id, name, position, created_at, updated_at
notes: id, user_id, folder_id (nullable FK), title, content (JSON - Tiptap doc),
       preview_text (first ~200 chars plain text), color (nullable),
       is_pinned, is_deleted, deleted_at, position, created_at, updated_at
tags: id, user_id, name (unique per user)
note_tags: note_id, tag_id (composite PK)
```

**Alternatives considered**:
- Storing content as HTML string → JSON (Tiptap doc format) is more structured, easier to extract plain text for search/preview, and is the native Tiptap format
- Tags as JSON array on note → separate table allows tag management (rename, list all tags, filter by tag) without scanning all notes

### 2. Rich Text — Tiptap (headless ProseMirror)

**Decision**: Use `@tiptap/core` + `@tiptap/starter-kit` wrapped in a custom Web Component `pos-note-editor`.

**Why**: Tiptap is headless (no UI opinions), framework-agnostic, and ProseMirror-based (battle-tested). It works perfectly with Web Components since we control the DOM. The starter-kit includes paragraphs, headings, bold, italic, strike, code, code blocks, bullet lists, ordered lists, blockquotes, and horizontal rules — exactly what we need.

**Integration approach**:
- `pos-note-editor` Web Component wraps Tiptap instance
- Toolbar rendered as simple buttons using `ui-button` / `ui-icon` atoms
- Editor content stored as Tiptap JSON (`.getJSON()`), sent to API as-is
- `preview_text` extracted server-side from the JSON content for list views and search
- Paste handling comes free with ProseMirror (handles HTML, plain text, URLs)

**Alternatives considered**:
- Quill → heavier, has its own UI, harder to customize in Shadow DOM
- Plain `contenteditable` + `execCommand` → deprecated API, inconsistent across browsers, no structured output
- Markdown textarea → not WYSIWYG, poor UX for non-technical users

### 3. Search — PostgreSQL full-text search on preview_text

**Decision**: Use PostgreSQL `to_tsvector` / `to_tsquery` on `title` and `preview_text` columns. Add a generated `search_vector` tsvector column with a GIN index.

**Why**: PostgreSQL FTS is built-in, fast enough for personal use (thousands of notes, not millions), and avoids adding Elasticsearch/Meilisearch infrastructure. The `preview_text` column (plain text extracted from Tiptap JSON) makes indexing straightforward.

**Alternatives considered**:
- Client-side search → doesn't scale, duplicates data
- Elasticsearch → overkill for single-user, adds infrastructure burden
- LIKE queries → no ranking, poor performance on large datasets

### 4. Frontend Layout — Three-panel (Apple Notes style)

**Decision**: Three-panel layout: folder sidebar (left) | note list (middle) | note editor (right). On narrow screens, panels stack/slide.

**Layout**:
```
┌──────────┬──────────────┬────────────────────────┐
│ Folders  │  Note List   │   Note Editor          │
│          │  (list/grid) │   (Tiptap rich text)   │
│ All Notes│              │                        │
│ Folder 1 │  Note title  │   Title input          │
│ Folder 2 │  Preview...  │   ─────────            │
│ Trash    │  2 days ago  │   Rich text content    │
│          │              │                        │
│ + Folder │  Note title  │   [B] [I] [H] [•] [—] │
│          │  Preview...  │                        │
└──────────┴──────────────┴────────────────────────┘
```

**Smart views** (like todos): "All Notes", "Pinned", "Trash" — plus user-created folders.

**Why**: This matches Apple Notes exactly and is the most efficient layout for note-taking. The middle panel supports both list view (compact, title + preview + date) and grid view (card-based, shows more preview).

### 5. Soft Delete — is_deleted flag + deleted_at timestamp

**Decision**: Notes have `is_deleted` boolean and `deleted_at` timestamp. Deleted notes appear in "Trash" view. Permanent delete available from trash. All list queries filter `WHERE is_deleted = false` by default.

**Why**: Matches Apple Notes behavior. Simple to implement (no separate trash table), easy to restore, and the `deleted_at` timestamp enables future auto-purge (e.g., 30 days).

### 6. Content Storage — Tiptap JSON, not HTML

**Decision**: Store note body as Tiptap JSON document format in a JSONB column.

**Why**:
- Lossless round-trip (JSON → editor → JSON, no conversion)
- Easy to extract plain text server-side for `preview_text` and search indexing
- Structured data is easier to migrate if we change editors later
- Smaller than HTML for the same content

### 7. Frontend Components

```
frontend/modules/notes/
├── components/
│   ├── pos-note-editor.js      # Tiptap wrapper Web Component (molecule)
│   ├── pos-note-toolbar.js     # Editor formatting toolbar (molecule)
│   ├── pos-note-card.js        # Note card for grid view (molecule)
│   ├── pos-note-list-item.js   # Note row for list view (molecule)
│   ├── pos-note-list.js        # Note list/grid container (organism)
│   └── pos-folder-sidebar.js   # Folder navigation panel (organism)
├── pages/
│   └── pos-notes-app.js        # Main page orchestrator
├── services/
│   └── notes-api.js            # API wrapper
└── store.js                    # Module state
```

## Risks / Trade-offs

**[Risk] Tiptap bundle size** → Tiptap core + starter-kit is ~50KB gzipped. Acceptable for a note-taking app. We load it only when the notes module is active (lazy loaded via router).

**[Risk] Shadow DOM + Tiptap compatibility** → ProseMirror manipulates DOM directly. The editor element must be inside the Shadow DOM but Tiptap doesn't use global styles, so this should work cleanly. The `pos-note-editor` component will mount Tiptap on a `<div>` inside its shadow root. Mitigation: test early in isolation.

**[Risk] Large note content** → JSONB column has no practical size limit in PostgreSQL. For preview_text extraction, we cap at 200 characters. No risk for personal use volumes.

**[Trade-off] No offline support** → Notes require API connectivity. Acceptable for Phase 2; could add service worker caching later.

**[Trade-off] No real-time sync** → Single user, single tab assumption. No conflict resolution needed.

## API Design

```
# Folders
GET    /api/notes/folders              → list folders
POST   /api/notes/folders              → create folder
PATCH  /api/notes/folders/:id          → rename folder
DELETE /api/notes/folders/:id          → delete folder (moves notes to unfiled)
PATCH  /api/notes/folders/reorder      → reorder folders

# Notes
GET    /api/notes/notes                → list notes (query: folder_id, tag, search, is_deleted, is_pinned)
POST   /api/notes/notes                → create note
GET    /api/notes/notes/:id            → get note (full content)
PATCH  /api/notes/notes/:id            → update note
DELETE /api/notes/notes/:id            → soft delete (move to trash)
DELETE /api/notes/notes/:id/permanent  → permanent delete
POST   /api/notes/notes/:id/restore   → restore from trash
PATCH  /api/notes/notes/reorder        → reorder notes

# Tags
GET    /api/notes/tags                 → list all tags for user
POST   /api/notes/notes/:id/tags       → add tag to note
DELETE /api/notes/notes/:id/tags/:tag_id → remove tag from note
```

All endpoints scoped by `user_id` via gateway middleware (same as todos).
