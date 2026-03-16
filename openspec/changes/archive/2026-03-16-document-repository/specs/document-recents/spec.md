## ADDED Requirements

### Requirement: Recent access tracking model

The documents service SHALL track recently accessed documents in a `doc_recent_access` table with: id (UUIDv7), user_id, document_id (FK to documents), accessed_at (timestamp with timezone). The table SHALL be bounded to 50 entries per user — older entries are pruned on insert.

#### Scenario: Access is recorded on document view
- **WHEN** a user sends GET /api/documents/documents/{id}
- **THEN** a recent access entry is created or updated for that user-document pair

#### Scenario: Duplicate access updates timestamp
- **WHEN** a user views the same document again
- **THEN** the existing recent access entry's accessed_at is updated (upsert), not duplicated

#### Scenario: Maximum 50 recent entries per user
- **WHEN** a user has 50 recent access entries and views a new document
- **THEN** the oldest entry is removed and the new one is added

### Requirement: Recent documents API

The documents service SHALL support: GET /api/documents/recent (list recently accessed documents for the current user, ordered by accessed_at descending, default limit 20).

#### Scenario: List recent documents
- **WHEN** a user sends GET /api/documents/recent
- **THEN** the service returns up to 20 most recently accessed documents with their metadata, ordered newest first

#### Scenario: Custom limit
- **WHEN** a user sends GET /api/documents/recent?limit=5
- **THEN** the service returns the 5 most recently accessed documents

### Requirement: Record access on upload

The documents service SHALL also record a recent access entry when a document is uploaded (created), so newly uploaded documents appear in the recent list immediately.

#### Scenario: Upload appears in recents
- **WHEN** a user uploads a new document
- **THEN** the document appears at the top of GET /api/documents/recent
