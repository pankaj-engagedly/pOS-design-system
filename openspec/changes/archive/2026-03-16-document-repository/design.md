## Context

pOS has a working attachments service (:8003) that handles raw file storage — upload bytes, get a UUID back, download by UUID. But there's no higher-level document management: no folders, no metadata beyond filename, no tagging, no sharing, no recent access history.

Users need a Google Drive-like experience for organizing personal documents (insurance policies, bank statements, tax returns, etc.) — a separate documents service that adds organization, metadata, and sharing on top of the existing file storage.

The existing patterns are well-established: notes service has folders + tags + events, todos service has lists + tasks + events. The documents service follows the same architecture.

## Goals / Non-Goals

**Goals:**
- Folder-based document organization with nesting (up to 5 levels)
- Document metadata layer referencing attachments service for actual file storage
- Tagging for cross-cutting organization
- Sharing individual documents or folders with other pOS users (read-only)
- Recent access tracking per user
- Domain events for all mutations
- Frontend module with folder tree, document list/grid, upload, sharing, tags

**Non-Goals:**
- Real-time collaboration or simultaneous editing
- File versioning (future phase)
- Full-text search within document contents (future — would need OCR/PDF parsing)
- External sharing (public links, non-pOS users)
- File preview/rendering (just download for now)
- Storage quotas or billing

## Decisions

### 1. Separate documents service vs extending attachments

**Decision:** New documents service (:8005) that references attachments by ID.

**Why:** The attachments service is a low-level file storage primitive — any service can use it (todos already reference attachment_ids). The documents service adds higher-level concerns: folders, organization, sharing, recent access. Mixing these into attachments would bloat a clean, simple service.

**How it works:**
- Upload flow: frontend uploads to attachments service → gets attachment_id → creates document record in documents service with that attachment_id
- Download flow: frontend requests document → gets attachment_id → downloads from attachments service
- Delete flow: delete document → optionally delete underlying attachment

**Alternative considered:** Embed file storage directly in documents service. Rejected because it duplicates the attachments logic and prevents other services from referencing the same files.

### 2. Folder nesting — adjacency list

**Decision:** Each folder has a `parent_id` (self-referential FK, nullable for root folders). Max depth enforced at API level (5 levels).

**Why:** Simple to implement, simple to query one level at a time (which is what the UI needs — expand folder tree on click). The pOS scale (personal use, hundreds not millions of folders) doesn't need the complexity of nested sets or materialized paths.

**Alternative considered:** Materialized path (`/root/work/taxes/2025`) — better for deep subtree queries but adds complexity for moves. Not needed at personal scale.

### 3. Sharing model — share table with user_id pairs

**Decision:** A `doc_shares` table linking (owner_user_id, shared_with_user_id, document_id or folder_id, permission). Initially read-only permission only.

**Why:** Family sharing is the primary use case — share a folder of insurance docs with a spouse. The shared user sees shared items in a "Shared with me" section. Simple relational model, no complex ACL system needed.

**Access pattern:**
- Owner creates a share → row in doc_shares
- Shared user queries their documents → UNION of own documents + shared documents
- Folder shares grant access to all documents within (recursive check)
- Shared users can view/download but not modify, move, or delete

### 4. Shared tags table instead of per-service duplication

**Decision:** Extract tags into a shared `tags` table and polymorphic `taggables` join table in pos_contracts. Both notes and documents services use the same tags. Access goes through a `tag_service` module in pos_contracts that encapsulates all tag queries.

**Why:** Tags are inherently cross-cutting. A user tagging "insurance" on a note and a document expects it to be the same tag. Per-service tags (notes has `tags` + `note_tags`, documents would create `doc_tags` + `doc_tag_links`) means:
- The same tag name exists independently in each service's tables — they can't be correlated
- "Show me everything tagged insurance" is impossible without querying every service
- The same CRUD code is duplicated in every service that needs tagging

**Schema:**
```
tags (id, user_id, name)                      — shared, owned by pos_contracts
taggables (tag_id, entity_type, entity_id)    — polymorphic join: entity_type = "note" | "document" | "task"
```

**Access pattern:** A `tag_service` module in pos_contracts provides functions like `add_tag(session, user_id, entity_type, entity_id, tag_name)` and `get_tags_for_entity(session, entity_type, entity_id)`. Services call these functions — they don't query the tags tables directly. This indirection means:
- When we extract tags to a separate service later, we swap the pos_contracts functions from SQL queries to HTTP calls — one file change, no service code changes
- The function signature is the API contract, not the database schema

**Migration ownership:** Shared tags tables get their own Alembic version table (`alembic_version_shared`) in a new `backend/shared/migrations/` config. Runs before service-specific migrations in dev-start.sh.

**Refactoring notes service:** The existing notes `tags` + `note_tags` tables are replaced by the shared tables. Notes migration drops the old tables and migrates data. Notes routes call the shared tag_service instead of local tag functions.

**Alternative considered:** Tags as a separate microservice (:8006). Rejected for now — adds HTTP overhead and infrastructure for a simple feature. The shared-table approach is extractable to a service later since access is already behind a function boundary.

**Trade-off:** This directly couples services at the database level, which flouts microservice boundaries. Accepted as pragmatic for single-Postgres phase. The `tag_service` abstraction layer makes future extraction straightforward.

### 5. Recent access — lightweight tracking table

**Decision:** A `doc_recent_access` table with (user_id, document_id, accessed_at). Capped at 50 entries per user via cleanup on insert.

**Why:** Simple append-on-access pattern. No need for a separate cache or analytics system at personal scale. The cleanup keeps the table bounded.

### 5. Documents reference attachments, don't duplicate

**Decision:** Document model has `attachment_id` FK pointing to the attachments table. Documents service reads from attachments table directly (same database).

**Why:** Both services share the same PostgreSQL instance. An HTTP call to the attachments service for every document read would add latency. Direct DB reference is simpler and faster. When services eventually get separate databases, this becomes an HTTP call — the `attachment_id` reference pattern stays the same.

### 6. Frontend module structure

**Decision:** Follow the notes module pattern — pages, services, store, components (molecules/organisms).

**Pages:**
- `documents-page.js` — main page with folder tree sidebar + document list
- `document-shared-page.js` — "Shared with me" view
- `document-recent-page.js` — recently accessed documents

**Key components:**
- `pos-folder-tree.js` — recursive folder tree sidebar
- `pos-document-list.js` — list/grid view of documents
- `pos-document-upload.js` — drag-and-drop upload area
- `pos-share-dialog.js` — sharing management dialog

## Risks / Trade-offs

**[Risk] Shared database access to attachments table** → If we later separate databases, the direct FK becomes an HTTP call. Mitigation: keep attachment access behind a service function (`get_attachment_meta`) that can be swapped to HTTP later.

**[Risk] Folder sharing recursion** → Checking if a user has access to a document via a shared parent folder requires walking up the folder tree. Mitigation: at personal scale (< 5 levels, < 1000 folders) this is negligible. If it becomes an issue, cache resolved permissions.

**[Risk] Large file uploads through gateway** → Gateway proxies the upload to attachments service. Mitigation: gateway already handles this for attachments; no new risk. For very large files (> 100MB), streaming upload support can be added later.

**[Trade-off] Read-only sharing only** → Simpler model but limits collaboration. Acceptable for Phase 4 — the use case is "share documents with family for their reference," not collaborative editing.

**[Trade-off] Shared tags table couples services at DB level** → Violates microservice boundaries. Mitigation: all tag access goes through `tag_service` functions in pos_contracts — when we extract to a separate service, swap function implementations from SQL to HTTP. No service code changes needed.
