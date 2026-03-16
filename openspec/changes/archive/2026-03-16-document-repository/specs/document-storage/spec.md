## ADDED Requirements

### Requirement: Documents service on port 8005

The documents service SHALL be a FastAPI application running on port 8005, following the same patterns as the notes and todos services. It SHALL use pos_contracts for base models, pos_events for domain events, and loguru for logging. It SHALL have its own db.py, Alembic migrations (alembic_version_documents), and service configuration.

#### Scenario: Service starts and passes health check
- **WHEN** the documents service is started via uvicorn on port 8005
- **THEN** GET /health returns `{"status": "ok", "service": "pos-documents"}`

#### Scenario: Service uses per-service database lifecycle
- **WHEN** the documents service starts
- **THEN** it initializes its own database engine via local db.py and connects to the shared PostgreSQL instance

### Requirement: Document model with attachment reference

The documents service SHALL store document metadata in a `documents` table. Each document SHALL have: id (UUIDv7), user_id, folder_id (nullable FK to doc_folders), attachment_id (UUID referencing the attachments table), name (display name, max 500 chars), description (optional text), file_size (integer bytes, copied from attachment), content_type (string, copied from attachment), created_at, updated_at. The model SHALL extend UserScopedBase.

#### Scenario: Document record is created with attachment reference
- **WHEN** a user creates a document with name "Insurance Policy 2025" and attachment_id pointing to an uploaded file
- **THEN** a row is inserted into documents with the attachment_id, name, user_id, and metadata copied from the attachment

#### Scenario: Document belongs to a user
- **WHEN** user A creates a document
- **THEN** the document's user_id is set to user A's ID and user B cannot access it (unless shared)

### Requirement: Upload document via attachments service

The documents service SHALL support document upload. The upload flow SHALL be: (1) frontend uploads file to attachments service, receives attachment_id; (2) frontend sends POST to documents service with attachment_id + metadata (name, folder_id, description). The documents service SHALL verify the attachment exists and belongs to the user.

#### Scenario: Successful document creation
- **WHEN** a user sends POST /api/documents/documents with `{"attachment_id": "<valid-id>", "name": "Tax Return 2025", "folder_id": null}`
- **THEN** the service creates a document record and returns 201 with the document metadata

#### Scenario: Invalid attachment_id
- **WHEN** a user sends POST with an attachment_id that doesn't exist or belongs to another user
- **THEN** the service returns 404

### Requirement: Document CRUD operations

The documents service SHALL support: GET /api/documents/documents (list user's documents with optional folder_id filter), GET /api/documents/documents/{id} (get single document), PATCH /api/documents/documents/{id} (update name, description, folder_id), DELETE /api/documents/documents/{id} (delete document and optionally the underlying attachment).

#### Scenario: List documents in a folder
- **WHEN** a user sends GET /api/documents/documents?folder_id={id}
- **THEN** the service returns all documents in that folder belonging to the user, ordered by name

#### Scenario: List all documents (no folder filter)
- **WHEN** a user sends GET /api/documents/documents
- **THEN** the service returns all documents belonging to the user (not in trash)

#### Scenario: Delete document
- **WHEN** a user sends DELETE /api/documents/documents/{id}
- **THEN** the document record is removed and the underlying attachment is deleted from the attachments table

#### Scenario: Move document to another folder
- **WHEN** a user sends PATCH /api/documents/documents/{id} with `{"folder_id": "<new-folder-id>"}`
- **THEN** the document's folder_id is updated and a document.moved event is published

### Requirement: Document domain events

The documents service SHALL publish domain events using the DomainEvent pattern from pos_events. Events SHALL include: document.uploaded, document.updated, document.moved, document.deleted.

#### Scenario: Upload publishes event
- **WHEN** a document is created
- **THEN** a document.uploaded event is published with document id, user_id, name, folder_id, content_type

#### Scenario: Move publishes event
- **WHEN** a document is moved to a different folder
- **THEN** a document.moved event is published with document id, old_folder_id, new_folder_id
