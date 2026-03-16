## Context

The todo module has backend subtask CRUD (model, routes, service) but no frontend wiring. Users also need to attach files to tasks. The attachment capability should be a shared service usable by any module (notes, vault, etc. in future phases).

Current state:
- Backend: `Subtask` model with `task_id`, `title`, `is_completed`, `position`. Full CRUD in `service.py` + `routes.py`. `TaskResponse` already includes `subtasks: list[SubtaskResponse]`.
- Frontend: `pos-subtask-list.js` exists in `frontend/modules/todos/components/` but is not wired into the task flow.
- No attachment capability exists anywhere.

## Goals / Non-Goals

**Goals:**
- Display subtasks on task items (progress indicator) and in task edit view (full CRUD)
- Create an attachment microservice following existing service patterns (auth, todos)
- Allow file upload/download/remove on tasks
- Keep attachment service generic — not coupled to todos

**Non-Goals:**
- S3/cloud storage (local disk for now, abstracted for later swap)
- Image thumbnails or previews
- Drag-and-drop file upload (simple file input)
- File size limits enforcement (defer to future)
- Attachment search or indexing

## Decisions

### 1. Attachment service architecture
**Decision**: Standalone FastAPI microservice at `backend/services/attachments/` on port 8003, following auth/todos patterns.

**Why**: Matches existing architecture. Each service owns its data. Any module can reference attachment IDs without coupling.

**Alternative considered**: Store files in the todo service. Rejected — breaks bounded context, won't scale to notes/vault.

### 2. File storage
**Decision**: Local filesystem storage under `data/attachments/<user_id>/<uuid>.<ext>`. Served via the attachment service's download endpoint.

**Why**: Simplest for local dev. The service interface (upload → ID, download by ID) abstracts storage, so swapping to S3 later only changes the service internals.

### 3. Task-attachment relationship
**Decision**: Add `attachment_ids` column (JSON array of UUIDs) to the `tasks` table in the todo service. No foreign key — cross-service reference by convention.

**Why**: Avoids cross-service DB joins. The todo service stores IDs; the frontend fetches attachment metadata from the attachment service separately. Simple, decoupled.

**Alternative considered**: Join table in attachment service. Rejected — would require the attachment service to know about "tasks", breaking genericity.

### 4. Subtask UI approach
**Decision**: Show subtask count/progress on `pos-task-item` (e.g., "2/5"). Show full subtask list with add/toggle/remove in the task edit form (`pos-task-form` in edit mode).

**Why**: Keeps the task list view clean while giving full subtask management in the edit context. The existing `pos-subtask-list.js` component handles the detail view.

### 5. Attachment UI approach
**Decision**: Add a file attachment section to `pos-task-form` (both create and edit modes). Show attached file chips on `pos-task-item` meta area.

**Why**: Attachments are a task attribute — they belong in the form. File chips provide at-a-glance visibility without cluttering the list.

### 6. Gateway proxy for attachments
**Decision**: Add `/api/attachments/{path}` proxy route in gateway, same pattern as auth and todos. The proxy must handle multipart/form-data for file uploads.

**Why**: Consistent with existing gateway pattern. The existing `proxy_request` utility forwards body content as-is, which works for multipart.

## Risks / Trade-offs

- **[Cross-service data consistency]** → If an attachment is deleted but task still references its ID, the frontend shows a broken reference. Mitigation: frontend handles 404 gracefully, shows "file removed" state.
- **[Disk storage limits]** → No size limits enforced. Mitigation: acceptable for single-user local dev. Add limits in a future change.
- **[No cascading deletes]** → Deleting a task doesn't delete its attachments. Mitigation: orphaned files are harmless for now. Add cleanup via RabbitMQ event (todo.task.deleted → attachment service cleans up) in future.
