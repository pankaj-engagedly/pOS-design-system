"""Todo domain event publishers."""

import logging

from pos_common.events import publish_event

logger = logging.getLogger(__name__)


async def publish_task_event(event_type: str, task, config) -> None:
    """Publish a task domain event to RabbitMQ.

    Best-effort: logs warning if RabbitMQ is unavailable, does not fail the request.
    """
    try:
        await publish_event(event_type, {
            "task_id": str(task.id),
            "user_id": str(task.user_id),
            "list_id": str(task.list_id),
            "title": task.title,
            "status": task.status,
            "priority": task.priority,
        })
    except Exception as e:
        logger.warning("Failed to publish event %s: %s", event_type, e)
