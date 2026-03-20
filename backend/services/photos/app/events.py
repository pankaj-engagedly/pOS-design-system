"""Photos domain events — declarative payload, zero boilerplate."""

from pos_events import DomainEvent, event_bus


class PhotosEvent(DomainEvent):
    """All Photos events inherit this."""
    _source_service = "photos"


# ── Payload field definitions ────────────────────────────

PHOTO_FIELDS = ("id", "user_id", "filename", "file_size")
PHOTO_IDENTITY = ("id", "user_id")

ALBUM_FIELDS = ("id", "user_id", "name", "album_type")
ALBUM_IDENTITY = ("id", "user_id")

PERSON_FIELDS = ("id", "user_id", "name")
PERSON_IDENTITY = ("id", "user_id")


# ── Photo events ─────────────────────────────────────────

class PhotoUploaded(PhotosEvent):
    _event_name = "photo.uploaded"
    _payload_fields = PHOTO_FIELDS

class PhotoUpdated(PhotosEvent):
    _event_name = "photo.updated"
    _payload_fields = PHOTO_FIELDS

class PhotoDeleted(PhotosEvent):
    _event_name = "photo.deleted"
    _payload_fields = PHOTO_IDENTITY

class PhotoFavourited(PhotosEvent):
    _event_name = "photo.favourited"
    _payload_fields = ("id", "user_id", "is_favourite")


# ── Album events ─────────────────────────────────────────

class AlbumCreated(PhotosEvent):
    _event_name = "album.created"
    _payload_fields = ALBUM_FIELDS

class AlbumDeleted(PhotosEvent):
    _event_name = "album.deleted"
    _payload_fields = ALBUM_IDENTITY


# ── Person events ────────────────────────────────────────

class PersonCreated(PhotosEvent):
    _event_name = "person.created"
    _payload_fields = PERSON_FIELDS

class PhotoTagged(PhotosEvent):
    _event_name = "photo.tagged"
    _payload_fields = ("photo_id", "person_id", "user_id")


# ── Publish helpers ──────────────────────────────────────

_EVENT_MAP = {
    "photo.uploaded": PhotoUploaded,
    "photo.updated": PhotoUpdated,
    "photo.deleted": PhotoDeleted,
    "photo.favourited": PhotoFavourited,
    "album.created": AlbumCreated,
    "album.deleted": AlbumDeleted,
    "person.created": PersonCreated,
    "photo.tagged": PhotoTagged,
}


async def publish_event(event_type: str, model, **extra) -> None:
    """Publish a Photos domain event by extracting fields from the model."""
    cls = _EVENT_MAP.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(model, **extra))
