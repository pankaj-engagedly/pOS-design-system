## Why

Tasks in the todo module currently show a flat list — no subtask breakdown and no file attachments. Subtask CRUD endpoints exist in the backend but have no frontend wiring. Users need to break tasks into steps and attach reference files (screenshots, documents, etc.) to tasks.

## What Changes

- Wire up existing subtask backend to the frontend: display subtasks inline on task items, add/toggle/remove subtasks in the task edit view
- Create a new **attachment microservice** (`backend/services/attachments/`) with its own database tables, Alembic migrations, and REST API for file upload/download/delete
- Store files on local disk (configurable path), return metadata (id, filename, size, content_type, created_at)
- Add an `attachment_ids` JSON array column to the todo task model to reference attachments
- Proxy `/api/attachments/*` through the gateway
- Frontend: show subtask progress on task rows, inline subtask management in task edit, file upload/download/remove UI on tasks

## Capabilities

### New Capabilities
- `attachment-service`: Shared file storage microservice — upload, download, delete files with metadata. Any module can use it.
- `task-subtasks-ui`: Frontend wiring for subtask display, creation, toggling, and removal on tasks
- `task-attachments-ui`: Frontend UI for uploading, viewing, downloading, and removing file attachments on tasks

### Modified Capabilities
- `backend-foundation`: Add attachment service to gateway proxy routes, dev scripts, and Makefile

## Impact

- **New service**: `backend/services/attachments/` (models, routes, service, schemas, Alembic)
- **Backend todos**: Add `attachment_ids` column to Task model, new migration
- **Gateway**: Add proxy route for `/api/attachments/*`
- **Dev scripts**: Register attachment service in `dev-start.sh`, `dev-stop.sh`, `Makefile`
- **Frontend**: Update `pos-task-item`, `pos-task-list`, `pos-task-form` for subtasks + attachments
- **Frontend services**: New `attachment-api.js` for upload/download calls
