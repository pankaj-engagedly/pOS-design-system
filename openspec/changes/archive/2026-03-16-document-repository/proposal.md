## Why

Personal documents — insurance policies, bank statements, credit card statements, tax returns, contracts — are scattered across email, downloads folders, and cloud drives. pOS needs a centralized, organized document repository (similar to Google Drive) where users can store, tag, folder, search, and share documents with family members. This is Phase 4 of the pOS roadmap.

## What Changes

- New **documents backend service** (:8005) — folders, documents (metadata + attachment reference), tags, sharing, recent access tracking
- New **documents frontend module** — file upload, folder tree, document list/grid views, sharing UI, tag management, recent documents
- **Leverage existing attachments service** (:8003) — documents service stores metadata and references attachments by ID; actual file storage remains in the attachments service
- New **gateway proxy routes** — `/api/documents/*` → documents service
- New **domain events** — document.uploaded, document.moved, document.shared, folder.created, etc.

## Capabilities

### New Capabilities
- `document-storage`: Backend service for document metadata, folder hierarchy, file references via attachments service. CRUD for documents with upload/download proxied through attachments.
- `document-folders`: Nested folder system for organizing documents. Folder CRUD, move documents between folders, folder tree traversal.
- `document-tagging`: Tag documents for cross-cutting organization. Tag CRUD, filter by tag, multi-tag support.
- `document-sharing`: Share individual documents or entire folders with other pOS users (family members). Read-only shared access, share/unshare management.
- `document-recents`: Track recently accessed/uploaded documents per user. Auto-updated on view/upload, configurable limit.
- `document-frontend`: Frontend module with folder tree sidebar, document list/grid views, upload flow, sharing dialog, tag management, recent documents page.

### Modified Capabilities
- `backend-foundation`: Gateway needs new proxy route for documents service (:8005). Attachments service used as storage backend.

## Impact

- **New backend service**: `backend/services/documents/` — new FastAPI service, Alembic migrations, models, routes
- **New frontend module**: `frontend/modules/documents/` — pages, components, services, store
- **Gateway**: Add `/api/documents/*` proxy route to documents service
- **Infrastructure**: New service in `dev-start.sh`, port 8005, new Alembic version table
- **Database**: New tables — doc_folders, documents, doc_tags, doc_tag_links, doc_shares, doc_recent_access
- **Dependencies**: Documents service depends on attachments service for file storage (HTTP calls or shared DB reference)
