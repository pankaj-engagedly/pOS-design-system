## ADDED Requirements

### Requirement: Shared tags model in pos_contracts

The pos_contracts package SHALL provide a shared `Tag` model and a polymorphic `Taggable` join table. The `tags` table SHALL have: id (UUIDv7), user_id, name (max 100 chars, unique per user). The `taggables` table SHALL have: tag_id (FK to tags), entity_type (string — "note", "document", etc.), entity_id (UUID). The composite (tag_id, entity_type, entity_id) SHALL be unique.

#### Scenario: Tag is unique per user
- **WHEN** user A creates tag "insurance" and user B also creates "insurance"
- **THEN** both tags exist independently, scoped to their respective users

#### Scenario: Same tag applied to different entity types
- **WHEN** user A tags a note and a document with "insurance"
- **THEN** one tag row exists, with two rows in taggables (entity_type="note" + entity_type="document")

### Requirement: Tag service module in pos_contracts

The pos_contracts package SHALL provide a `tag_service` module with async functions for tag operations: `add_tag(session, user_id, entity_type, entity_id, tag_name)`, `remove_tag(session, user_id, entity_type, entity_id, tag_id)`, `get_tags_for_entity(session, entity_type, entity_id)`, `get_all_tags(session, user_id)`, `get_entities_by_tag(session, user_id, entity_type, tag_name)`. All tag access SHALL go through these functions — services SHALL NOT query tag tables directly. This abstraction enables future extraction to a standalone tags service.

#### Scenario: Add tag creates or reuses existing tag
- **WHEN** `add_tag(session, user_id, "document", doc_id, "insurance")` is called and tag "insurance" already exists for the user
- **THEN** the existing tag is reused and a taggable link is created (get-or-create pattern)

#### Scenario: Get tags for an entity
- **WHEN** `get_tags_for_entity(session, "note", note_id)` is called
- **THEN** all tags linked to that note via taggables are returned

#### Scenario: Get all entities of a type by tag
- **WHEN** `get_entities_by_tag(session, user_id, "document", "insurance")` is called
- **THEN** all document entity_ids tagged with "insurance" for that user are returned

### Requirement: Shared tags Alembic migration

The shared tags tables (tags, taggables) SHALL have their own Alembic configuration with version table `alembic_version_shared`, located at `backend/shared/migrations/`. The dev-start.sh script SHALL run shared migrations before service-specific migrations.

#### Scenario: Shared migration runs on startup
- **WHEN** `make dev` is run
- **THEN** the shared tags migration creates the tags and taggables tables before any service starts

### Requirement: Notes service refactored to use shared tags

The notes service SHALL be refactored to use the shared tag_service from pos_contracts instead of its own tags and note_tags tables. The notes service's tag routes SHALL call `tag_service.add_tag(session, user_id, "note", note_id, name)` etc. The old notes-specific tags and note_tags tables SHALL be dropped via a migration that first migrates existing data to the shared tables.

#### Scenario: Notes tag operations use shared service
- **WHEN** a user adds a tag to a note via POST /api/notes/notes/{id}/tags
- **THEN** the route calls `tag_service.add_tag` which writes to the shared tags + taggables tables

#### Scenario: Existing note tags are migrated
- **WHEN** the notes migration runs
- **THEN** existing tags and note_tags data is copied to the shared tags and taggables tables, then the old tables are dropped

### Requirement: Documents service uses shared tags

The documents service SHALL use the shared tag_service for all tagging operations. Document tag routes SHALL follow the same pattern as notes: POST /api/documents/documents/{id}/tags, DELETE /api/documents/documents/{id}/tags/{tag_id}, GET /api/documents/tags.

#### Scenario: Tag a document
- **WHEN** a user sends POST /api/documents/documents/{id}/tags with `{"name": "insurance"}`
- **THEN** the tag_service creates/reuses the tag and links it with entity_type="document"

#### Scenario: List tags with counts
- **WHEN** a user sends GET /api/documents/tags
- **THEN** the service returns all tags for the user with the count of documents using each tag

#### Scenario: Filter documents by tag
- **WHEN** a user sends GET /api/documents/documents?tag=insurance
- **THEN** the service uses `tag_service.get_entities_by_tag` to find matching document IDs and returns those documents

### Requirement: Cross-entity tag queries

The tag_service SHALL support querying tags across all entity types: `get_all_tags(session, user_id)` SHALL return all tags with counts per entity_type. This enables future "show me everything tagged X" functionality.

#### Scenario: Tags list shows cross-entity counts
- **WHEN** `get_all_tags(session, user_id)` is called
- **THEN** each tag includes counts like `{"name": "insurance", "counts": {"note": 3, "document": 5}}`
