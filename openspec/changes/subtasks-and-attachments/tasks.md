## 1. Attachment Service — Backend

- [x] 1.1 Scaffold `backend/services/attachments/` with `app/__init__.py`, `main.py`, `models.py`, `schemas.py`, `service.py`, `routes.py`, `requirements.txt`
- [x] 1.2 Create `Attachment` model extending `UserScopedBase` with `filename`, `content_type`, `size`, `storage_path` columns
- [x] 1.3 Set up Alembic for attachment service with `alembic_version_attachments` version table
- [x] 1.4 Run initial migration to create `attachments` table
- [x] 1.5 Create Pydantic schemas: `AttachmentResponse`, `BatchRequest`
- [x] 1.6 Implement `service.py`: `upload_file()`, `get_attachment()`, `get_attachments_batch()`, `delete_attachment()`, `get_file_path()`
- [x] 1.7 Implement `routes.py`: `POST /upload`, `GET /{id}`, `GET /{id}/download`, `POST /batch`, `DELETE /{id}`, `GET /health`
- [x] 1.8 Create `data/attachments/` directory and add to `.gitignore`

## 2. Infra — Wire Attachment Service

- [x] 2.1 Add attachment service proxy route to `backend/gateway/app/routes.py` (`/api/attachments/{path}` → port 8003)
- [x] 2.2 Add attachment service to `infra/scripts/dev-start.sh` (start on port 8003, health check)
- [x] 2.3 Add attachment service to `infra/scripts/dev-stop.sh`
- [x] 2.4 Update `Makefile` if needed for attachment service references

## 3. Todo Service — Attachment IDs Column

- [x] 3.1 Add `attachment_ids` JSON column to `Task` model (default empty list)
- [x] 3.2 Create and run Alembic migration for `attachment_ids` column
- [x] 3.3 Add `attachment_ids` to `TaskCreate`, `TaskUpdate`, `TaskResponse`, and `TaskSummaryResponse` schemas

## 4. Frontend — Subtask UI Wiring

- [x] 4.1 Update `pos-subtask-list.js` to use `composed: true` on all custom events, wire add/toggle/remove
- [x] 4.2 Add subtask progress indicator (e.g., "2/5") to `pos-task-item.js` meta area
- [x] 4.3 Include `pos-subtask-list` in `pos-task-form` edit mode, pass subtasks from task data
- [x] 4.4 Handle `subtask-add` event in `pos-todos-app.js` — call `POST /api/todos/tasks/{id}/subtasks`
- [x] 4.5 Handle `subtask-toggle` event — call `PATCH /api/todos/subtasks/{id}`
- [x] 4.6 Handle `subtask-remove` event — call `DELETE /api/todos/subtasks/{id}`
- [x] 4.7 After subtask changes, refresh task data to update progress counts

## 5. Frontend — Attachment API Client

- [x] 5.1 Create `frontend/modules/todos/services/attachment-api.js` with `uploadFile()`, `getMetadata()`, `batchGetMetadata()`, `getDownloadUrl()`

## 6. Frontend — Attachment UI on Tasks

- [x] 6.1 Add file input + attachment list section to `pos-task-form.js` details area
- [x] 6.2 On file select, upload via attachment API, collect returned ID
- [x] 6.3 In create mode, include `attachment_ids` in task-submit detail
- [x] 6.4 In edit mode, append new attachment ID and update task via API
- [x] 6.5 Display attached files as chips (filename + size + remove button)
- [x] 6.6 Clicking filename opens download URL in new tab
- [x] 6.7 Remove button removes attachment ID from task (does not delete file)
- [x] 6.8 Add attachment count indicator to `pos-task-item.js` meta area

## 7. Integration Verification

- [ ] 7.1 Run `make dev` — verify attachment service starts on port 8003 and responds to health check
- [ ] 7.2 Verify file upload, download, and delete work via the gateway
- [ ] 7.3 Verify subtask add/toggle/remove works inline in task edit view
- [ ] 7.4 Verify subtask progress shows on task rows
- [ ] 7.5 Verify attachment upload/display/download/remove works on tasks
