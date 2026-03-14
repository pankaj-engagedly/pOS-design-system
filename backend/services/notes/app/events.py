"""Notes domain event publishers."""

import logging

from pos_common.events import publish_event

logger = logging.getLogger(__name__)


async def publish_note_event(event_type: str, note, config) -> None:
    """Publish a note domain event to RabbitMQ.

    Best-effort: logs warning if RabbitMQ is unavailable, does not fail the request.
    """
    try:
        await publish_event(event_type, {
            "note_id": str(note.id),
            "user_id": str(note.user_id),
            "title": note.title,
            "folder_id": str(note.folder_id) if note.folder_id else None,
        })
    except Exception as e:
        logger.warning("Failed to publish event %s: %s", event_type, e)
