"""Notes domain events — declarative payload, zero boilerplate.

Each event class is just a name + which fields to extract from the model.
Payload field tuples are defined ONCE per entity shape, then shared across
events that carry the same data (e.g. NoteCreated and NoteUpdated both
snapshot the same note fields).

The envelope (event_id, event_name, source_service, created_at) is handled
by DomainEvent/BaseEvent. The service owns its payload schema — changes here
don't require a shared package release.
"""

from pos_events import DomainEvent, event_bus


# --- Service base class (source_service set once) ---

class NotesEvent(DomainEvent):
    """All notes events inherit this — source_service is 'notes' everywhere."""
    _source_service = "notes"


# --- Payload field definitions (define once, reuse across events) ---

# Folder fields — shared by FolderCreated, FolderUpdated
FOLDER_FIELDS = ("id", "user_id", "name")

# Folder identity — for delete events
FOLDER_IDENTITY = ("id", "user_id")

# Note fields — shared by NoteCreated, NoteUpdated.
# If notes gains new fields (e.g. color, is_pinned), add here — all events pick it up.
NOTE_FIELDS = ("id", "user_id", "title", "folder_id")

# Note identity — for lifecycle events that only need identity
NOTE_IDENTITY = ("id", "user_id")


# --- Folder events ---

class FolderCreated(NotesEvent):
    _event_name = "folder.created"
    _payload_fields = FOLDER_FIELDS


class FolderUpdated(NotesEvent):
    _event_name = "folder.updated"
    _payload_fields = FOLDER_FIELDS


class FolderDeleted(NotesEvent):
    _event_name = "folder.deleted"
    _payload_fields = FOLDER_IDENTITY


# --- Note events ---

class NoteCreated(NotesEvent):
    _event_name = "note.created"
    _payload_fields = NOTE_FIELDS


class NoteUpdated(NotesEvent):
    _event_name = "note.updated"
    _payload_fields = NOTE_FIELDS


class NoteDeleted(NotesEvent):
    _event_name = "note.deleted"
    _payload_fields = NOTE_IDENTITY


class NoteRestored(NotesEvent):
    _event_name = "note.restored"
    _payload_fields = NOTE_IDENTITY


# --- Tag events (note_id + tag info, since tags are note-scoped actions) ---

class TagAdded(NotesEvent):
    _event_name = "tag.added"
    _payload_fields = ("id", "name")


class TagRemoved(NotesEvent):
    _event_name = "tag.removed"
    _payload_fields = ("id",)


# --- Publish helpers ---

async def publish_folder_event(event_type: str, folder) -> None:
    """Publish a folder domain event by extracting fields from the model."""
    event_map = {
        "folder.created": FolderCreated,
        "folder.updated": FolderUpdated,
        "folder.deleted": FolderDeleted,
    }
    cls = event_map.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(folder))


async def publish_note_event(event_type: str, note, config) -> None:
    """Publish a note domain event by extracting fields from the model.

    The config param is kept for API compatibility but unused — EventBus
    is already initialized with the RabbitMQ URL at startup.
    """
    event_map = {
        "note.created": NoteCreated,
        "note.updated": NoteUpdated,
        "note.deleted": NoteDeleted,
        "note.restored": NoteRestored,
    }
    cls = event_map.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(note))


async def publish_tag_event(event_type: str, tag, note_id: str) -> None:
    """Publish a tag domain event. Includes note_id as extra context."""
    event_map = {
        "tag.added": TagAdded,
        "tag.removed": TagRemoved,
    }
    cls = event_map.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(tag, note_id=note_id))
