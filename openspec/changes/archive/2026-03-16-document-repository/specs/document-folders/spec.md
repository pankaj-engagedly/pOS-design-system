## ADDED Requirements

### Requirement: Folder model with nesting

The documents service SHALL store folders in a `doc_folders` table. Each folder SHALL have: id (UUIDv7), user_id, parent_id (nullable self-referential FK for nesting), name (max 255 chars), position (integer for ordering), created_at, updated_at. The model SHALL extend UserScopedBase. Root folders have parent_id = NULL.

#### Scenario: Create a root folder
- **WHEN** a user creates a folder with name "Insurance" and no parent_id
- **THEN** a root-level folder is created with parent_id = NULL

#### Scenario: Create a nested folder
- **WHEN** a user creates a folder with name "2025" and parent_id pointing to the "Insurance" folder
- **THEN** a child folder is created nested under "Insurance"

#### Scenario: Folder nesting depth limit
- **WHEN** a user attempts to create a folder that would exceed 5 levels of nesting
- **THEN** the service returns 422 with an error message about maximum nesting depth

### Requirement: Folder CRUD operations

The documents service SHALL support: POST /api/documents/folders (create), GET /api/documents/folders (list root folders or children of a parent), GET /api/documents/folders/{id} (get single folder with children and document counts), PATCH /api/documents/folders/{id} (rename, move to new parent), DELETE /api/documents/folders/{id} (delete folder and all contents).

#### Scenario: List root folders
- **WHEN** a user sends GET /api/documents/folders (no parent_id param)
- **THEN** the service returns all root-level folders for the user, ordered by position

#### Scenario: List child folders
- **WHEN** a user sends GET /api/documents/folders?parent_id={id}
- **THEN** the service returns all direct children of the specified folder

#### Scenario: Get folder with metadata
- **WHEN** a user sends GET /api/documents/folders/{id}
- **THEN** the response includes folder details, child folder count, and document count

#### Scenario: Move folder to new parent
- **WHEN** a user sends PATCH /api/documents/folders/{id} with `{"parent_id": "<new-parent-id>"}`
- **THEN** the folder is moved under the new parent, and depth is validated

#### Scenario: Delete folder cascades to contents
- **WHEN** a user deletes a folder that contains documents and subfolders
- **THEN** all documents and subfolders within are also deleted (cascade), and underlying attachments are cleaned up

### Requirement: Folder reordering

The documents service SHALL support reordering folders within the same parent via PATCH /api/documents/folders/reorder with an ordered list of folder IDs.

#### Scenario: Reorder folders
- **WHEN** a user sends PATCH /api/documents/folders/reorder with `{"parent_id": null, "ordered_ids": [id3, id1, id2]}`
- **THEN** the position column is updated to reflect the new order

### Requirement: Folder domain events

The documents service SHALL publish folder events: folder.created, folder.updated, folder.moved, folder.deleted.

#### Scenario: Folder created event
- **WHEN** a folder is created
- **THEN** a folder.created event is published with folder id, user_id, name, parent_id
