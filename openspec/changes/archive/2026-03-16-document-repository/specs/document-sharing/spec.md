## ADDED Requirements

### Requirement: Share model

The documents service SHALL store shares in a `doc_shares` table with: id (UUIDv7), owner_user_id (the sharer), shared_with_user_id (the recipient), document_id (nullable — for document shares), folder_id (nullable — for folder shares), permission (string, default "read"), created_at. Exactly one of document_id or folder_id SHALL be non-null (check constraint).

#### Scenario: Share a document
- **WHEN** user A shares document D with user B
- **THEN** a row is created with owner_user_id=A, shared_with_user_id=B, document_id=D, folder_id=NULL

#### Scenario: Share a folder
- **WHEN** user A shares folder F with user B
- **THEN** a row is created with owner_user_id=A, shared_with_user_id=B, document_id=NULL, folder_id=F
- **AND** user B can access all documents within folder F and its subfolders

### Requirement: Share management API

The documents service SHALL support: POST /api/documents/shares (create a share), GET /api/documents/shares (list shares created by the user), GET /api/documents/shared-with-me (list items shared with the current user), DELETE /api/documents/shares/{id} (revoke a share).

#### Scenario: Create a document share
- **WHEN** a user sends POST /api/documents/shares with `{"document_id": "<id>", "shared_with_user_id": "<id>"}`
- **THEN** the share is created and a document.shared event is published

#### Scenario: List items shared with me
- **WHEN** a user sends GET /api/documents/shared-with-me
- **THEN** the service returns all documents and folders shared with the current user, grouped by sharer

#### Scenario: Revoke a share
- **WHEN** a user sends DELETE /api/documents/shares/{id}
- **THEN** the share is removed and the recipient can no longer access the item

#### Scenario: Prevent duplicate shares
- **WHEN** a user attempts to share the same document with the same user again
- **THEN** the service returns 409 (conflict) instead of creating a duplicate

### Requirement: Shared access enforcement

The documents service SHALL allow shared users to view and download shared documents but NOT modify, move, or delete them. When a shared user requests a document or folder, the service SHALL check both ownership AND share records.

#### Scenario: Shared user can view document
- **WHEN** user B has a share for document D owned by user A
- **THEN** user B can GET /api/documents/documents/{D} and receive the document metadata

#### Scenario: Shared user cannot modify document
- **WHEN** user B has a read-only share for document D
- **THEN** PATCH /api/documents/documents/{D} from user B returns 403

#### Scenario: Folder share grants access to contents
- **WHEN** user A shares folder F with user B, and folder F contains documents D1, D2, and subfolder S with document D3
- **THEN** user B can access D1, D2, and D3 via the shared-with-me endpoint

### Requirement: Share domain events

The documents service SHALL publish sharing events: document.shared, document.unshared, folder.shared, folder.unshared.

#### Scenario: Share event published
- **WHEN** a share is created
- **THEN** a document.shared or folder.shared event is published with owner_id, shared_with_id, and item id

### Requirement: Share recipient lookup

The documents service SHALL lookup share recipients by email address. The user sends an email in the share request, and the service resolves it to a user_id by querying the auth service's users table (same database).

#### Scenario: Share by email
- **WHEN** a user sends POST /api/documents/shares with `{"document_id": "<id>", "email": "spouse@example.com"}`
- **THEN** the service looks up the user by email, creates the share, and returns the share record

#### Scenario: Share with non-existent user
- **WHEN** a user sends a share request with an email that has no pOS account
- **THEN** the service returns 404 with "User not found"
