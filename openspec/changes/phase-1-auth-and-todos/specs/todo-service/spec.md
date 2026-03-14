# todo-service

Backend service for todo lists and tasks CRUD with priorities, statuses, ordering, and subtasks.

## Requirements

### Requirement: Todo Lists CRUD

Users can create, read, update, delete, and reorder todo lists.

**Behavior:**
- Each user gets a default "Inbox" list created on first access (lazy creation)
- Lists have name and position (integer for ordering)
- GET returns all lists for the user, ordered by position
- PATCH updates name
- DELETE cascades to all tasks in the list (with confirmation flag)
- PATCH `/lists/reorder` accepts ordered array of list IDs, updates positions
- All queries scoped to `user_id` from request state

### Requirement: Tasks CRUD

Users can create, read, update, and delete tasks within lists.

**Behavior:**
- Task fields: title (required), description (text, optional), status (enum: todo/in_progress/done/archived), priority (enum: none/low/medium/high/urgent), due_date (optional), is_important (boolean), is_urgent (boolean), position (integer)
- POST creates task in specified list, default status=todo, priority=none
- GET single task returns full detail including subtasks
- GET list tasks returns tasks ordered by position
- PATCH updates any field
- DELETE removes task and its subtasks
- PATCH `/tasks/reorder` accepts list_id + ordered array of task IDs, updates positions
- Publish domain events: `todo.task.created`, `todo.task.updated`, `todo.task.completed` (when status changes to done)

### Requirement: Subtasks

Tasks can have a flat checklist of subtasks.

**Behavior:**
- Subtask fields: title, is_completed (boolean), position (integer)
- POST on `/tasks/:id/subtasks` adds a subtask
- PATCH toggles completion or updates title
- DELETE removes subtask
- Subtasks returned with parent task detail
- Cascade delete when parent task is deleted

### Requirement: Todo Data Model

SQLAlchemy models and Alembic migration for todo tables.

**Tables:**
- `todo_lists`: id, user_id, name, position, created_at, updated_at (extends UserScopedBase)
- `tasks`: id, user_id, list_id (FK → todo_lists), title, description, status, priority, due_date, is_important, is_urgent, position, created_at, updated_at (extends UserScopedBase)
- `subtasks`: id, user_id, task_id (FK → tasks, cascade), title, is_completed, position, created_at, updated_at (extends UserScopedBase)

### Requirement: Todo Service Setup

FastAPI service following sample service pattern.

**Behavior:**
- Service config extends `BaseServiceConfig` with `SERVICE_NAME = "pos-todos"`
- Runs on port 8002
- Health check at `/health`
- Routes under `/api/todos` prefix
- Lifespan: init_db on startup, close_db on shutdown
- Service layer separates business logic from routes
