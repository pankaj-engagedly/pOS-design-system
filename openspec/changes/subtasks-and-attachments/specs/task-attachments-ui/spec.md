## ADDED Requirements

### Requirement: Attachment section in task form
The `pos-task-form` SHALL include a file attachment section (in the expandable details area) with a file input button and a list of attached files.

#### Scenario: Upload a file in create mode
- **WHEN** a user selects a file via the file input while creating a task
- **THEN** the file SHALL be uploaded to the attachment service, and the returned ID SHALL be included in the task creation payload as part of `attachment_ids`

#### Scenario: Upload a file in edit mode
- **WHEN** a user selects a file via the file input while editing a task
- **THEN** the file SHALL be uploaded to the attachment service, and the task SHALL be updated with the new attachment ID appended to `attachment_ids`

### Requirement: Display attached files
The attachment section SHALL display each attached file as a chip/row showing filename, file size, and a remove button.

#### Scenario: Show attachment details
- **WHEN** a task has attachments
- **THEN** each attachment SHALL display its filename and human-readable size (e.g., "2.4 KB")

### Requirement: Download attached file
Clicking an attachment filename SHALL open/download the file via the attachment service download endpoint.

#### Scenario: Click to download
- **WHEN** a user clicks an attachment filename
- **THEN** the browser SHALL navigate to or download from `GET /api/attachments/{id}/download`

### Requirement: Remove attachment from task
Clicking the remove button on an attachment SHALL remove the attachment ID from the task's `attachment_ids` and update the task via the API. It SHALL NOT delete the file from the attachment service.

#### Scenario: Remove attachment reference
- **WHEN** a user clicks remove on an attachment
- **THEN** the attachment ID SHALL be removed from the task's `attachment_ids` array via `PATCH /api/todos/tasks/{id}`

### Requirement: Attachment count on task rows
The `pos-task-item` component SHALL show an attachment indicator (e.g., paperclip icon + count) when a task has attachments.

#### Scenario: Task with 3 attachments
- **WHEN** a task has `attachment_ids` with 3 entries
- **THEN** the task row SHALL display an attachment indicator showing "3"

### Requirement: Task model supports attachment IDs
The todo service Task model SHALL have an `attachment_ids` column (JSON array of UUID strings) to store references to attachments. The column SHALL default to an empty array.

#### Scenario: Create task with attachments
- **WHEN** a task is created with `attachment_ids: ["uuid1", "uuid2"]`
- **THEN** the task record SHALL store those IDs and return them in the response

### Requirement: Frontend attachment API client
A new `attachment-api.js` service SHALL provide functions for `uploadFile(file)`, `getMetadata(id)`, `batchGetMetadata(ids)`, and `getDownloadUrl(id)`.

#### Scenario: Upload returns metadata
- **WHEN** `uploadFile(file)` is called
- **THEN** it SHALL POST to `/api/attachments/upload` and return the attachment metadata object
