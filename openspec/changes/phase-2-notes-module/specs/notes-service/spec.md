## ADDED Requirements

### Requirement: Notes service runs as independent FastAPI microservice

The notes service SHALL run as an independent FastAPI application on port 8004. It SHALL use the `pos_common` shared library for database, config, auth, and event utilities. It SHALL include `UserIdMiddleware` to extract `x-user-id` from gateway-injected headers. All routes SHALL be mounted under `/api/notes`.

#### Scenario: Service starts and responds to health check
- **WHEN** the notes service is started on port 8004
- **THEN** `GET /api/notes/health` returns `{"status": "ok", "service": "notes"}`

#### Scenario: Service rejects requests without user_id header
- **WHEN** a request is made to any notes endpoint without the `x-user-id` header
- **THEN** the service returns 401 Unauthorized

### Requirement: Folder data model with user scoping

The notes service SHALL define a `Folder` model extending `UserScopedBase` with columns: `name` (String 255, not null), `position` (Integer, default 0). Folders SHALL be unique per user by name.

#### Scenario: Folder has required columns from UserScopedBase
- **WHEN** a Folder record is created
- **THEN** it has columns: `id` (UUID PK), `user_id` (UUID, indexed), `name`, `position`, `created_at`, `updated_at`

#### Scenario: Folder name is unique per user
- **WHEN** a user creates a folder with a name that already exists for that user
- **THEN** the service returns a 409 Conflict error

### Requirement: Note data model with rich text content storage

The notes service SHALL define a `Note` model extending `UserScopedBase` with columns: `folder_id` (UUID FK to folders, nullable), `title` (String 500, not null, default empty string), `content` (JSONB, nullable — stores Tiptap document JSON), `preview_text` (String 200, nullable — plain text excerpt), `color` (String 20, nullable), `is_pinned` (Boolean, default false), `is_deleted` (Boolean, default false), `deleted_at` (DateTime with timezone, nullable), `position` (Integer, default 0).

#### Scenario: Note has all specified columns
- **WHEN** a Note record is created
- **THEN** it has columns: `id`, `user_id`, `folder_id`, `title`, `content`, `preview_text`, `color`, `is_pinned`, `is_deleted`, `deleted_at`, `position`, `created_at`, `updated_at`

#### Scenario: Note can exist without a folder
- **WHEN** a Note is created with `folder_id` set to null
- **THEN** the Note is saved successfully and appears in "All Notes" queries

#### Scenario: Deleting a folder nullifies note folder_id
- **WHEN** a folder is deleted that contains notes
- **THEN** those notes have their `folder_id` set to null (not cascading delete)

### Requirement: Tag data model with many-to-many relationship to notes

The notes service SHALL define a `Tag` model extending `UserScopedBase` with column: `name` (String 100, not null). Tags SHALL be unique per user by name. A `note_tags` association table SHALL link notes to tags with composite primary key (`note_id`, `tag_id`).

#### Scenario: Tag is unique per user
- **WHEN** a user creates a tag with name "work" and a tag "work" already exists for that user
- **THEN** the existing tag is returned (no duplicate created)

#### Scenario: A note can have multiple tags
- **WHEN** tags "work" and "important" are added to a note
- **THEN** the note's tags list contains both tags

#### Scenario: Deleting a note removes its tag associations
- **WHEN** a note with tags is permanently deleted
- **THEN** the `note_tags` entries for that note are removed
- **AND** the tags themselves are NOT deleted

### Requirement: Full-text search using PostgreSQL tsvector

The Note model SHALL have a generated `search_vector` column of type `tsvector`, populated from `title` (weight A) and `preview_text` (weight B). A GIN index SHALL be created on `search_vector`. The search endpoint SHALL use `to_tsquery` for matching.

#### Scenario: Search finds note by title keyword
- **WHEN** a user searches for "meeting"
- **AND** a note exists with title "Team meeting notes"
- **THEN** the note is returned in search results

#### Scenario: Search finds note by content keyword
- **WHEN** a user searches for "quarterly"
- **AND** a note exists with preview_text containing "quarterly review"
- **THEN** the note is returned in search results

#### Scenario: Search is scoped to current user
- **WHEN** user A searches for "secret"
- **AND** user B has a note titled "secret plans"
- **THEN** no results are returned for user A

#### Scenario: Search excludes deleted notes
- **WHEN** a user searches for a term matching a soft-deleted note
- **THEN** the deleted note is NOT included in results

### Requirement: Folder CRUD endpoints

The notes service SHALL provide REST endpoints for folder management.

#### Scenario: List folders
- **WHEN** `GET /api/notes/folders` is called
- **THEN** all folders for the current user are returned, ordered by position

#### Scenario: Create folder
- **WHEN** `POST /api/notes/folders` is called with `{"name": "Work"}`
- **THEN** a new folder is created and returned with status 201

#### Scenario: Rename folder
- **WHEN** `PATCH /api/notes/folders/:id` is called with `{"name": "Personal"}`
- **THEN** the folder name is updated and the folder is returned

#### Scenario: Delete folder
- **WHEN** `DELETE /api/notes/folders/:id` is called
- **THEN** the folder is deleted with status 204
- **AND** any notes in that folder have their `folder_id` set to null

#### Scenario: Reorder folders
- **WHEN** `PATCH /api/notes/folders/reorder` is called with `{"ordered_ids": [id1, id2, id3]}`
- **THEN** folder positions are updated to match the provided order

### Requirement: Note CRUD endpoints

The notes service SHALL provide REST endpoints for note management.

#### Scenario: List notes (all, not deleted)
- **WHEN** `GET /api/notes/notes` is called without filters
- **THEN** all non-deleted notes for the current user are returned, with pinned notes first, then ordered by position
- **AND** each note includes: id, title, preview_text, color, is_pinned, folder_id, tags, position, created_at, updated_at (NOT full content)

#### Scenario: List notes filtered by folder
- **WHEN** `GET /api/notes/notes?folder_id=:id` is called
- **THEN** only non-deleted notes in that folder are returned

#### Scenario: List notes filtered by tag
- **WHEN** `GET /api/notes/notes?tag=:tag_name` is called
- **THEN** only non-deleted notes with that tag are returned

#### Scenario: List pinned notes
- **WHEN** `GET /api/notes/notes?is_pinned=true` is called
- **THEN** only pinned, non-deleted notes are returned

#### Scenario: List deleted notes (trash)
- **WHEN** `GET /api/notes/notes?is_deleted=true` is called
- **THEN** only soft-deleted notes are returned, ordered by deleted_at descending

#### Scenario: Search notes
- **WHEN** `GET /api/notes/notes?search=:query` is called
- **THEN** notes matching the search query are returned, ranked by relevance

#### Scenario: Create note
- **WHEN** `POST /api/notes/notes` is called with `{"title": "My Note", "content": {...}, "folder_id": "...", "color": "yellow"}`
- **THEN** a new note is created with status 201
- **AND** `preview_text` is auto-extracted from the content JSON

#### Scenario: Get single note with full content
- **WHEN** `GET /api/notes/notes/:id` is called
- **THEN** the full note is returned including the `content` JSON field

#### Scenario: Update note
- **WHEN** `PATCH /api/notes/notes/:id` is called with partial fields
- **THEN** only the provided fields are updated
- **AND** if `content` is updated, `preview_text` is re-extracted

#### Scenario: Soft delete note
- **WHEN** `DELETE /api/notes/notes/:id` is called
- **THEN** the note's `is_deleted` is set to true and `deleted_at` is set to current timestamp
- **AND** the response status is 204

#### Scenario: Restore note from trash
- **WHEN** `POST /api/notes/notes/:id/restore` is called
- **THEN** the note's `is_deleted` is set to false and `deleted_at` is set to null

#### Scenario: Permanent delete
- **WHEN** `DELETE /api/notes/notes/:id/permanent` is called
- **THEN** the note and its tag associations are permanently removed from the database

#### Scenario: Reorder notes
- **WHEN** `PATCH /api/notes/notes/reorder` is called with `{"ordered_ids": [id1, id2, id3]}`
- **THEN** note positions are updated to match the provided order

### Requirement: Tag management endpoints

The notes service SHALL provide endpoints for managing tags on notes.

#### Scenario: List all tags
- **WHEN** `GET /api/notes/tags` is called
- **THEN** all tags for the current user are returned with their note count

#### Scenario: Add tag to note
- **WHEN** `POST /api/notes/notes/:id/tags` is called with `{"name": "work"}`
- **THEN** the tag is associated with the note
- **AND** if the tag doesn't exist, it is created first

#### Scenario: Remove tag from note
- **WHEN** `DELETE /api/notes/notes/:id/tags/:tag_id` is called
- **THEN** the tag association is removed (tag itself is NOT deleted)

### Requirement: Preview text extraction from Tiptap JSON

The service SHALL extract plain text from Tiptap JSON document format for the `preview_text` field. It SHALL recursively walk the JSON document tree, extracting text content from text nodes, and truncate to 200 characters.

#### Scenario: Extract text from simple paragraph
- **WHEN** content is `{"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello world"}]}]}`
- **THEN** preview_text is "Hello world"

#### Scenario: Extract text from nested content
- **WHEN** content contains headings, paragraphs, and list items with text
- **THEN** preview_text contains the concatenated plain text, separated by spaces

#### Scenario: Truncate long content
- **WHEN** the extracted text exceeds 200 characters
- **THEN** preview_text is truncated to 200 characters

#### Scenario: Handle null content
- **WHEN** content is null or empty
- **THEN** preview_text is set to null

### Requirement: RabbitMQ event publishing for notes

The notes service SHALL publish events to RabbitMQ on note lifecycle changes, using best-effort delivery (log warning on failure, don't fail the request).

#### Scenario: Event on note creation
- **WHEN** a note is created
- **THEN** a `note.created` event is published with note_id and user_id

#### Scenario: Event on note update
- **WHEN** a note is updated
- **THEN** a `note.updated` event is published with note_id and user_id

#### Scenario: Event on note deletion
- **WHEN** a note is soft-deleted
- **THEN** a `note.deleted` event is published with note_id and user_id

#### Scenario: Event publishing failure does not break request
- **WHEN** RabbitMQ is unavailable
- **THEN** the note operation completes successfully
- **AND** a warning is logged

### Requirement: Database migration for notes tables

The notes service SHALL use Alembic with a per-service version table `alembic_version_notes`. The initial migration SHALL create the `folders`, `notes`, `tags`, and `note_tags` tables with all columns, indexes, and constraints.

#### Scenario: Migration creates all tables
- **WHEN** `alembic upgrade head` is run for the notes service
- **THEN** tables `folders`, `notes`, `tags`, `note_tags` are created
- **AND** GIN index on `notes.search_vector` is created
- **AND** unique constraint on `(user_id, name)` for folders and tags is created

#### Scenario: Per-service version tracking
- **WHEN** migrations run
- **THEN** the version is tracked in `alembic_version_notes` (not the shared `alembic_version`)
