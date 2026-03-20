"""BaseEvent — the envelope contract for all pOS domain events.

Every event published on the event bus uses this envelope:
    event_id        — UUIDv7, auto-generated (time-ordered for log correlation)
    event_name      — dot-notation routing key, e.g. "note.created"
    source_service  — which service published it, e.g. "notes"
    created_at      — ISO 8601 UTC timestamp, auto-generated
    payload         — service-specific data dict

Why is the envelope here but concrete events in each service?
- The envelope is a system-level contract: every consumer can rely on these fields
- The payload is a domain-level contract: only the publishing service defines it
- Keeping concrete events (NoteCreated, TaskCompleted) in their service means the
  service owns its domain schema — changes don't require a shared package release
- New services define their own events without touching this package

Usage in a service (declarative pattern):
    from pos_events import DomainEvent, event_bus

    # Define payload fields ONCE per entity — shared across related events.
    # NoteCreated and NoteUpdated both carry the same note snapshot.
    NOTE_FIELDS = ("id", "user_id", "title", "folder_id")

    class NotesEvent(DomainEvent):
        _source_service = "notes"

    class NoteCreated(NotesEvent):
        _event_name = "note.created"
        _payload_fields = NOTE_FIELDS

    class NoteUpdated(NotesEvent):
        _event_name = "note.updated"
        _payload_fields = NOTE_FIELDS

    # Publishing — pass the SQLAlchemy model, fields are extracted automatically:
    await event_bus.publish(NoteCreated.from_model(note))

    # Extra/override fields:
    await event_bus.publish(NoteDeleted.from_model(note, permanent=True))
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, ClassVar

import uuid_utils


@dataclass
class BaseEvent:
    """Standard event envelope. All domain events extend this."""

    event_name: str
    """Dot-notation routing key. e.g. 'note.created', 'task.completed'"""

    source_service: str
    """Which service published this event. e.g. 'notes', 'todos'"""

    payload: dict[str, Any]
    """Service-specific event data. Defined by the concrete event class."""

    event_id: str = field(
        # str() on uuid_utils.UUID gives the standard hyphenated format
        default_factory=lambda: str(uuid_utils.uuid7())
    )
    """UUIDv7 — time-ordered so events are naturally sortable by creation time."""

    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    """ISO 8601 UTC timestamp."""

    def to_dict(self) -> dict[str, Any]:
        """Serialize to a JSON-safe dict for transport."""
        return {
            "event_id": self.event_id,
            "event_name": self.event_name,
            "source_service": self.source_service,
            "created_at": self.created_at,
            "payload": self.payload,
        }


@dataclass
class DomainEvent(BaseEvent):
    """Declarative event base — define payload fields once, extract from models.

    Why this pattern?
    In a typical service you'll have NoteCreated, NoteUpdated, NoteDeleted — and
    the first two carry nearly identical payloads (the note's current state).
    Without DomainEvent, you'd repeat the same field list in every __init__.
    With DomainEvent, you define the field tuple ONCE per entity and each event
    class is just 2 lines: a name and which fields to include.

    How it works:
    - _event_name: class-level routing key (becomes envelope event_name)
    - _source_service: class-level service name (set once in a service base class)
    - _payload_fields: tuple of model attribute names to extract into payload
    - from_model(): reads those attributes from a SQLAlchemy model, auto-converts
      UUIDs to strings, and merges any **extra overrides into the payload

    This mirrors the BaseEvent gem pattern from production Ruby microservices —
    declare the shape, let the framework do the plumbing.
    """

    # ClassVar annotations — NOT dataclass fields, just class-level constants
    # that subclasses override. Python dataclasses ignore ClassVar.
    _event_name: ClassVar[str] = ""
    _source_service: ClassVar[str] = ""
    _payload_fields: ClassVar[tuple[str, ...]] = ()

    @classmethod
    def from_model(cls, model, **extra) -> "DomainEvent":
        """Create an event by extracting _payload_fields from a model instance.

        UUIDs (anything with .hex) are auto-converted to strings for JSON safety.
        None values pass through as-is (e.g. nullable folder_id).
        Extra kwargs merge into (and can override) the extracted payload.
        """
        payload = {}
        for attr in cls._payload_fields:
            val = model[attr] if isinstance(model, dict) else getattr(model, attr)
            # UUID objects have .hex — convert to string for JSON serialization
            payload[attr] = str(val) if val is not None and hasattr(val, "hex") else val
        payload.update(extra)
        return cls(
            event_name=cls._event_name,
            source_service=cls._source_service,
            payload=payload,
        )
