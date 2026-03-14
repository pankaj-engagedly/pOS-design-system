## ADDED Requirements

### Requirement: Attachment service runs as standalone microservice
The attachment service SHALL run as an independent FastAPI microservice on port 8003, following the same patterns as auth and todos services (models, routes, service, schemas, Alembic migrations).

#### Scenario: Service starts and responds to health check
- **WHEN** the attachment service is started
- **THEN** GET `/health` SHALL return `{"status": "ok", "service": "pos-attachments"}`

### Requirement: File upload
The service SHALL accept file uploads via `POST /api/attachments/upload` as multipart/form-data with a `file` field. It SHALL store the file on local disk under `data/attachments/<user_id>/<uuid>.<ext>` and return attachment metadata.

#### Scenario: Successful file upload
- **WHEN** an authenticated user uploads a file via POST multipart/form-data
- **THEN** the service SHALL store the file on disk, create a database record, and return JSON with `id` (UUID), `filename` (original name), `size` (bytes), `content_type` (MIME type), and `created_at`

#### Scenario: Upload without file field
- **WHEN** a POST request is sent without a `file` field
- **THEN** the service SHALL return 422 validation error

### Requirement: File download
The service SHALL serve files via `GET /api/attachments/{id}/download`. Files SHALL only be accessible by the user who uploaded them.

#### Scenario: Download own file
- **WHEN** a user requests download of an attachment they own
- **THEN** the service SHALL return the file with correct `Content-Type` and `Content-Disposition` headers

#### Scenario: Download another user's file
- **WHEN** a user requests download of an attachment they do not own
- **THEN** the service SHALL return 404

### Requirement: Attachment metadata retrieval
The service SHALL return attachment metadata via `GET /api/attachments/{id}`.

#### Scenario: Get metadata for own attachment
- **WHEN** a user requests metadata for an attachment they own
- **THEN** the service SHALL return JSON with `id`, `filename`, `size`, `content_type`, `created_at`

### Requirement: Attachment deletion
The service SHALL delete attachments via `DELETE /api/attachments/{id}`. It SHALL remove both the database record and the file on disk.

#### Scenario: Delete own attachment
- **WHEN** a user deletes an attachment they own
- **THEN** the service SHALL remove the file from disk and the record from the database, returning 204

#### Scenario: Delete another user's attachment
- **WHEN** a user tries to delete an attachment they do not own
- **THEN** the service SHALL return 404

### Requirement: Batch metadata retrieval
The service SHALL support fetching metadata for multiple attachments via `POST /api/attachments/batch` with a JSON body of `{"ids": [<uuid>, ...]}`. Only attachments owned by the requesting user SHALL be returned.

#### Scenario: Batch fetch metadata
- **WHEN** a user requests metadata for a list of attachment IDs
- **THEN** the service SHALL return an array of metadata objects for all matching attachments owned by that user

### Requirement: User-scoped data model
The attachment database model SHALL extend `UserScopedBase` with columns: `filename` (String), `content_type` (String), `size` (Integer), `storage_path` (String, internal disk path — not exposed in API responses).

#### Scenario: Attachment record created with user scope
- **WHEN** a file is uploaded
- **THEN** the database record SHALL have `user_id` set to the authenticated user's ID
