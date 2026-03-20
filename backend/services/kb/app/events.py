"""KB domain events — declarative payload, zero boilerplate."""

from pos_events import DomainEvent, event_bus


class KBEvent(DomainEvent):
    """All KB events inherit this."""
    _source_service = "kb"


# ── Payload field definitions ────────────────────────────

ITEM_FIELDS = ("id", "user_id", "title", "item_type", "url")
ITEM_IDENTITY = ("id", "user_id")

COLLECTION_FIELDS = ("id", "user_id", "name")
COLLECTION_IDENTITY = ("id", "user_id")

FEED_SOURCE_FIELDS = ("id", "user_id", "title", "url", "feed_type")
FEED_SOURCE_IDENTITY = ("id", "user_id")


# ── Item events ──────────────────────────────────────────

class ItemCreated(KBEvent):
    _event_name = "kb.item.created"
    _payload_fields = ITEM_FIELDS

class ItemUpdated(KBEvent):
    _event_name = "kb.item.updated"
    _payload_fields = ITEM_FIELDS

class ItemDeleted(KBEvent):
    _event_name = "kb.item.deleted"
    _payload_fields = ITEM_IDENTITY


# ── Collection events ────────────────────────────────────

class CollectionCreated(KBEvent):
    _event_name = "kb.collection.created"
    _payload_fields = COLLECTION_FIELDS

class CollectionDeleted(KBEvent):
    _event_name = "kb.collection.deleted"
    _payload_fields = COLLECTION_IDENTITY


# ── Feed events ──────────────────────────────────────────

class FeedSubscribed(KBEvent):
    _event_name = "kb.feed.subscribed"
    _payload_fields = FEED_SOURCE_FIELDS

class FeedUnsubscribed(KBEvent):
    _event_name = "kb.feed.unsubscribed"
    _payload_fields = FEED_SOURCE_IDENTITY


# ── Publish helpers ──────────────────────────────────────

_EVENT_MAP = {
    "kb.item.created": ItemCreated,
    "kb.item.updated": ItemUpdated,
    "kb.item.deleted": ItemDeleted,
    "kb.collection.created": CollectionCreated,
    "kb.collection.deleted": CollectionDeleted,
    "kb.feed.subscribed": FeedSubscribed,
    "kb.feed.unsubscribed": FeedUnsubscribed,
}


async def publish_event(event_type: str, model, **extra) -> None:
    """Publish a KB domain event by extracting fields from the model."""
    cls = _EVENT_MAP.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(model, **extra))
