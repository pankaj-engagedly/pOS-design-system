## ADDED Requirements

### Requirement: Subtask progress on task rows
The `pos-task-item` component SHALL display subtask progress (e.g., "2/5") when a task has subtasks.

#### Scenario: Task with subtasks shows progress
- **WHEN** a task has 5 subtasks and 2 are completed
- **THEN** the task row SHALL display "2/5" in the meta area

#### Scenario: Task without subtasks shows no progress
- **WHEN** a task has zero subtasks
- **THEN** no subtask progress indicator SHALL be shown

### Requirement: Subtask list in task edit view
When editing a task, the `pos-task-form` in edit mode SHALL display the full subtask list below the task fields, using the existing `pos-subtask-list` component.

#### Scenario: Edit form shows existing subtasks
- **WHEN** a user clicks a task to edit it
- **THEN** the edit form SHALL display all subtasks with checkboxes and titles

### Requirement: Add subtask inline
The subtask list SHALL include an inline input to add new subtasks. Pressing Enter SHALL create the subtask via the API and append it to the list.

#### Scenario: Add a subtask
- **WHEN** a user types a subtask title in the add input and presses Enter
- **THEN** the subtask SHALL be created via `POST /api/todos/tasks/{id}/subtasks` and appear in the list immediately

### Requirement: Toggle subtask completion
Clicking a subtask checkbox SHALL toggle its `is_completed` status via the API.

#### Scenario: Toggle subtask done
- **WHEN** a user checks a subtask checkbox
- **THEN** the subtask SHALL be updated via `PATCH /api/todos/subtasks/{id}` with `is_completed: true`

### Requirement: Remove subtask
Each subtask row SHALL have a remove button that deletes the subtask via the API.

#### Scenario: Remove a subtask
- **WHEN** a user clicks the remove button on a subtask
- **THEN** the subtask SHALL be deleted via `DELETE /api/todos/subtasks/{id}` and removed from the list immediately

### Requirement: Subtask data flows through task detail fetch
When a task is selected for editing, the full task data (including subtasks) SHALL be fetched via `GET /api/todos/tasks/{id}` and passed to the form.

#### Scenario: Task detail includes subtasks
- **WHEN** `pos-todos-app` fetches a task for editing
- **THEN** the `TaskResponse` SHALL include the `subtasks` array, which is passed to the edit form
