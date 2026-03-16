## 1. Documents service scaffold

- [x] 1.1 Create `backend/services/documents/` directory structure: `app/__init__.py`, `app/main.py`, `app/db.py`, `app/models.py`, `app/schemas.py`, `app/routes.py`, `app/service.py`, `app/events.py`
- [x] 1.2 Create `app/main.py` — FastAPI app with DocumentsConfig(BaseServiceConfig), SERVICE_NAME="pos-documents", UserIdMiddleware, setup_logging, lifespan with db init/close + event_bus init/close, health check on /health
- [x] 1.3 Create `app/db.py` — per-service database lifecycle (init_db, get_session, close_db) following the notes/todos pattern
- [x] 1.4 Create `pyproject.toml` or `requirements.txt` with dependencies (fastapi, uvicorn, sqlalchemy, asyncpg, pos-contracts, pos-events, loguru)
- [x] 1.5 Set up Alembic: `alembic.ini`, `migrations/env.py` with alembic_version_documents version table, import from pos_contracts.models

## 2. Shared tags infrastructure (pos_contracts)

- [x] 2.1 Add Tag model to pos_contracts/models.py: id (UUIDv7), user_id, name (max 100 chars). UniqueConstraint on (user_id, name)
- [x] 2.2 Add Taggable model to pos_contracts/models.py: tag_id (FK to tags), entity_type (string — "note", "document", etc.), entity_id (UUID). Unique composite (tag_id, entity_type, entity_id)
- [x] 2.3 Create `pos_contracts/tag_service.py` — async functions: add_tag(session, user_id, entity_type, entity_id, tag_name), remove_tag(session, user_id, entity_type, entity_id, tag_id), get_tags_for_entity(session, entity_type, entity_id), get_all_tags(session, user_id), get_entities_by_tag(session, user_id, entity_type, tag_name). All use get-or-create pattern for tags.
- [x] 2.4 Export Tag, Taggable, and tag_service from pos_contracts __init__.py
- [x] 2.5 Create shared Alembic config: `backend/shared/migrations/alembic.ini`, `backend/shared/migrations/env.py` with version table `alembic_version_shared`
- [x] 2.6 Generate shared Alembic migration for tags + taggables tables
- [x] 2.7 Update `infra/scripts/dev-start.sh` to run shared migrations before service-specific migrations

## 3. Refactor notes service to use shared tags

- [x] 3.1 Update notes routes to import and call tag_service (add_tag, remove_tag, get_tags_for_entity) instead of local tag functions
- [x] 3.2 Update notes service.py — remove local tag CRUD functions, use tag_service for tag operations
- [x] 3.3 Remove local Tag and NoteTag models from notes app/models.py
- [x] 3.4 Create notes Alembic migration: migrate existing tags/note_tags data to shared tags/taggables tables, then drop old tables

## 4. Documents service database models

- [x] 4.1 Create `app/models.py` — DocFolder model (UserScopedBase): name, parent_id (self-FK, nullable), position. UniqueConstraint on (user_id, parent_id, name)
- [x] 4.2 Add Document model: name, description (nullable), attachment_id (UUID, not FK — cross-service reference), file_size (integer), content_type (string), folder_id (FK to doc_folders, nullable)
- [x] 4.3 Add DocShare model: owner_user_id, shared_with_user_id, document_id (nullable FK), folder_id (nullable FK), permission (default "read"). Check constraint: exactly one of document_id/folder_id is non-null
- [x] 4.4 Add DocRecentAccess model: user_id, document_id (FK), accessed_at (timestamp)
- [x] 4.5 Generate initial Alembic migration with documents service tables (folders, documents, shares, recent_access)

## 5. Pydantic schemas

- [x] 5.1 Create `app/schemas.py` — FolderCreate, FolderUpdate, FolderResponse (with child_count, document_count)
- [x] 5.2 Add DocumentCreate (attachment_id, name, folder_id, description), DocumentUpdate (name, description, folder_id), DocumentResponse (with tags list)
- [x] 5.3 Add TagCreate, TagResponse (with document_count)
- [x] 5.4 Add ShareCreate (document_id or folder_id, email), ShareResponse, SharedWithMeResponse
- [x] 5.5 Add RecentDocumentResponse, ReorderRequest

## 6. Folder CRUD service and routes

- [x] 6.1 Create folder service functions in `app/service.py`: get_folders (by parent_id), create_folder (with depth validation max 5), update_folder, delete_folder (cascade), reorder_folders
- [x] 6.2 Add depth validation helper — walk parent_id chain to count depth, reject if > 5
- [x] 6.3 Create folder routes in `app/routes.py`: POST /folders, GET /folders, GET /folders/{id}, PATCH /folders/{id}, DELETE /folders/{id}, PATCH /folders/reorder
- [x] 6.4 Add folder domain events: FolderCreated, FolderUpdated, FolderMoved, FolderDeleted using DomainEvent pattern with FOLDER_FIELDS tuple

## 7. Document CRUD service and routes

- [x] 7.1 Add document service functions: create_document (validate attachment exists via DB query), get_document, get_documents (with folder_id, tag filters), update_document, delete_document (also delete attachment record)
- [x] 7.2 Add document routes: POST /documents, GET /documents, GET /documents/{id}, PATCH /documents/{id}, DELETE /documents/{id}
- [x] 7.3 Add document domain events: DocumentUploaded, DocumentUpdated, DocumentMoved, DocumentDeleted using DomainEvent pattern with DOC_FIELDS tuple
- [x] 7.4 Add @trace decorators to all service functions

## 8. Document tagging routes (using shared tag_service)

- [x] 8.1 Add document tag routes in `app/routes.py`: POST /documents/{id}/tags (calls tag_service.add_tag with entity_type="document"), DELETE /documents/{id}/tags/{tag_id} (calls tag_service.remove_tag), GET /tags (calls tag_service.get_all_tags with document counts)
- [x] 8.2 Add tag filter to GET /documents — use tag_service.get_entities_by_tag to find matching document IDs
- [x] 8.3 Add tag domain events: TagAdded, TagRemoved with document_id in extra

## 9. Sharing service and routes

- [x] 9.1 Add share service functions: create_share (lookup user by email from users table), list_my_shares, list_shared_with_me, revoke_share
- [x] 9.2 Add shared access check helper — given user_id + document_id, check if document is owned OR shared (directly or via folder ancestor share)
- [x] 9.3 Add share routes: POST /shares, GET /shares, GET /shared-with-me, DELETE /shares/{id}
- [x] 9.4 Update document GET to allow shared access (read-only) using the access check helper
- [x] 9.5 Add share domain events: DocumentShared, DocumentUnshared, FolderShared, FolderUnshared

## 10. Recent access service and routes

- [x] 10.1 Add recent access service functions: record_access (upsert, prune to 50), get_recent_documents (with limit, default 20)
- [x] 10.2 Add recent route: GET /recent
- [x] 10.3 Integrate record_access into document GET and document create flows

## 11. Infrastructure updates

- [x] 11.1 Update gateway — add DOCUMENTS_SERVICE_URL config ("http://localhost:8005"), add proxy route for /api/documents/*
- [x] 11.2 Update `infra/scripts/dev-start.sh` — add documents service on port 8005 with LOG_LEVEL support, add wait_for_port 8005 "documents"
- [x] 11.3 Update Makefile — add `documents` log level variable (default to LOG_LEVEL)
- [x] 11.4 Update README.md — add documents service to ports table, architecture diagram, project structure

## 12. Frontend — store and API service

- [x] 12.1 Create `frontend/modules/documents/services/documents-api.js` — API client wrapping all document, folder, tag, share, recent HTTP calls + two-step upload (attachments then documents)
- [x] 12.2 Create `frontend/modules/documents/store.js` — state management: currentFolderId, documents list, folders tree, tags, viewMode (list/grid), loading states

## 13. Frontend — folder tree component

- [x] 13.1 Create `frontend/modules/documents/components/pos-folder-tree.js` — recursive folder tree sidebar with expand/collapse, folder selection, create folder inline, context menu (rename, delete, share)

## 14. Frontend — document list component

- [x] 14.1 Create `frontend/modules/documents/components/pos-document-list.js` — list/grid toggle view of documents with file type icons, name, size, date columns (list view) and card tiles (grid view)
- [x] 14.2 Create `frontend/modules/documents/components/pos-document-item.js` — individual document row/card with context menu: rename, move, tag, share, download, delete

## 15. Frontend — upload component

- [x] 15.1 Create `frontend/modules/documents/components/pos-document-upload.js` — drag-and-drop area + file picker button, upload progress indicator, two-step upload flow (attachments → documents)

## 16. Frontend — sharing and dialogs

- [x] 16.1 Create `frontend/modules/documents/components/pos-share-dialog.js` — dialog for sharing (email input, current shares list, revoke button)
- [x] 16.2 Create `frontend/modules/documents/components/pos-folder-picker.js` — dialog for moving documents (folder tree selection)

## 17. Frontend — pages

- [x] 17.1 Create `frontend/modules/documents/pages/documents-page.js` — main page composing folder tree sidebar + document list + upload area, wired to store
- [x] 17.2 Create `frontend/modules/documents/pages/documents-shared-page.js` — shared-with-me page listing shared documents/folders grouped by sharer
- [x] 17.3 Create `frontend/modules/documents/pages/documents-recent-page.js` — recent documents page

## 18. Frontend — routing and shell integration

- [x] 18.1 Register document routes in the app shell router: #/documents, #/documents/shared, #/documents/recent
- [x] 18.2 Add "Documents" entry to the sidebar navigation with icon
- [x] 18.3 Wire up folder tree selection → store → document list refresh cycle

## 19. Verification

- [x] 19.1 Start full stack with `make dev` — verify documents service starts on :8005, health check passes
- [x] 19.2 Test backend API: create folders (nested), upload document, list documents by folder, move document, tag document, delete document
- [x] 19.3 Test sharing: create share by email, verify shared user can view, verify shared user cannot modify
- [x] 19.4 Test recent access: view documents, verify recent list updates
- [x] 19.5 Test frontend: navigate to documents, create folders, upload files, switch views, share, view shared-with-me, view recents
