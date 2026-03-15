"""pos_events — event bus for pOS backend services.

Provides the event envelope contract (BaseEvent), a declarative DomainEvent
for reducing boilerplate, a pluggable Transport abstraction, and the EventBus
singleton that services publish through.

Usage (declarative — preferred):
    from pos_events import DomainEvent, event_bus

    NOTE_FIELDS = ("id", "user_id", "title", "folder_id")

    class NotesEvent(DomainEvent):
        _source_service = "notes"

    class NoteCreated(NotesEvent):
        _event_name = "note.created"
        _payload_fields = NOTE_FIELDS

    await event_bus.publish(NoteCreated.from_model(note))

Usage (manual — for events with custom payload logic):
    from pos_events import BaseEvent, event_bus

    event = BaseEvent(
        event_name="note.imported",
        source_service="notes",
        payload={"source": "evernote", "count": 42},
    )
    await event_bus.publish(event)
"""

from .base import BaseEvent, DomainEvent
from .bus import EventBus, event_bus
from .rabbitmq import RabbitMqTransport
from .transport import Transport

__all__ = [
    "BaseEvent",
    "DomainEvent",
    "Transport",
    "RabbitMqTransport",
    "EventBus",
    "event_bus",
]
