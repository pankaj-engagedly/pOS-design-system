"""Todo domain events — declarative payload, zero boilerplate.

Each event class is just a name + which fields to extract from the model.
Payload field tuples are defined ONCE per entity shape, then shared across
events that carry the same data (e.g. TaskCreated and TaskUpdated both
snapshot the same core task fields).

The envelope (event_id, event_name, source_service, created_at) is handled
by DomainEvent/BaseEvent. The service owns its payload schema — changes here
don't require a shared package release.
"""

from pos_events import DomainEvent, event_bus


# --- Service base class (source_service set once) ---

class TodosEvent(DomainEvent):
    """All todos events inherit this — source_service is 'todos' everywhere."""
    _source_service = "todos"


# --- Payload field definitions (define once, reuse across events) ---

# List fields — shared by ListCreated, ListUpdated
LIST_FIELDS = ("id", "user_id", "name")

# List identity — for delete events
LIST_IDENTITY = ("id", "user_id")

# Core task fields shared by most task events.
# If tasks gain new fields (e.g. due_date, labels), add here once.
TASK_FIELDS = ("id", "user_id", "list_id", "title", "priority")

# TaskUpdated also includes status (TaskCreated doesn't — it's always "todo")
TASK_UPDATE_FIELDS = ("id", "user_id", "list_id", "title", "status", "priority")

# Lighter payload for lifecycle events
TASK_IDENTITY = ("id", "user_id", "list_id")


# --- List events ---

class ListCreated(TodosEvent):
    _event_name = "list.created"
    _payload_fields = LIST_FIELDS


class ListUpdated(TodosEvent):
    _event_name = "list.updated"
    _payload_fields = LIST_FIELDS


class ListDeleted(TodosEvent):
    _event_name = "list.deleted"
    _payload_fields = LIST_IDENTITY


# --- Task events ---

class TaskCreated(TodosEvent):
    _event_name = "task.created"
    _payload_fields = TASK_FIELDS


class TaskUpdated(TodosEvent):
    _event_name = "task.updated"
    _payload_fields = TASK_UPDATE_FIELDS


class TaskCompleted(TodosEvent):
    _event_name = "task.completed"
    _payload_fields = TASK_FIELDS


class TaskDeleted(TodosEvent):
    _event_name = "task.deleted"
    _payload_fields = TASK_IDENTITY


# --- Publish helpers (backward compat with routes passing event_type strings) ---

async def publish_list_event(event_type: str, lst) -> None:
    """Publish a list domain event by extracting fields from the model."""
    event_map = {
        "list.created": ListCreated,
        "list.updated": ListUpdated,
        "list.deleted": ListDeleted,
    }
    cls = event_map.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(lst))


async def publish_task_event(event_type: str, task, config) -> None:
    """Publish a task domain event by extracting fields from the model.

    The config param is kept for API compatibility but unused — EventBus
    is already initialized with the RabbitMQ URL at startup.
    """
    event_map = {
        "todo.task.created": TaskCreated,
        "todo.task.updated": TaskUpdated,
        "todo.task.completed": TaskCompleted,
        "todo.task.deleted": TaskDeleted,
    }
    cls = event_map.get(event_type)
    if cls:
        await event_bus.publish(cls.from_model(task))
