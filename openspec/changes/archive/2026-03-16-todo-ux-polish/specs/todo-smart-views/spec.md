## ADDED Requirements

### Requirement: Smart view sections in sidebar
The todo sidebar SHALL display smart view sections above user-created lists. Smart views SHALL include: Inbox, Today, Upcoming, and Completed.

#### Scenario: Smart views visible
- **WHEN** the todo sidebar renders
- **THEN** four smart view items SHALL appear above the "Lists" section: Inbox, Today, Upcoming, Completed
- **AND** each SHALL have a distinguishing icon

### Requirement: Inbox smart view
Inbox SHALL show tasks from the first (default) list. Selecting Inbox SHALL load tasks from that list.

#### Scenario: Inbox selected
- **WHEN** user clicks Inbox
- **THEN** tasks from the default list SHALL be displayed

### Requirement: Today smart view
Today SHALL show tasks due today across all lists. Tasks SHALL be fetched from all lists and filtered by due_date matching today's date.

#### Scenario: Today shows due-today tasks
- **WHEN** user clicks Today
- **THEN** only tasks with due_date equal to today SHALL be shown
- **AND** tasks from all lists SHALL be included

### Requirement: Upcoming smart view
Upcoming SHALL show tasks with a future due date across all lists.

#### Scenario: Upcoming shows future tasks
- **WHEN** user clicks Upcoming
- **THEN** only tasks with due_date in the future SHALL be shown
- **AND** tasks SHALL be sorted by due_date ascending

### Requirement: Completed smart view
Completed SHALL show tasks with status "done" across all lists.

#### Scenario: Completed shows done tasks
- **WHEN** user clicks Completed
- **THEN** only tasks with status "done" SHALL be shown from all lists

### Requirement: All tasks loaded for smart views
When the todo module mounts, it SHALL fetch tasks from ALL lists and store them for smart view filtering.

#### Scenario: All tasks available
- **WHEN** the todo module loads
- **THEN** tasks from every list SHALL be fetched and stored in `allTasks`
- **AND** smart views SHALL filter from this combined set

### Requirement: Task list name shown in smart views
When viewing a smart view, each task item SHALL show which list it belongs to.

#### Scenario: List name on task row
- **WHEN** user is viewing Today, Upcoming, or Completed
- **THEN** each task row SHALL display the list name as a subtle label

### Requirement: Inline add task
The "Add task" action SHALL be positioned inline at the bottom of the task list, not in the header. It SHALL be a minimal row that expands to a form on click.

#### Scenario: Add task at bottom
- **WHEN** user views a task list
- **THEN** an "Add task" row SHALL appear at the bottom of the task list
- **AND** clicking it SHALL expand an inline task creation form

### Requirement: Task editing
Clicking a task row (not the checkbox) SHALL open an inline edit form for that task. The form SHALL be pre-filled with the task's current values.

#### Scenario: Click to edit
- **WHEN** user clicks a task title/row
- **THEN** the task row SHALL be replaced with an edit form pre-filled with the task's data
- **AND** the user SHALL be able to save or cancel

#### Scenario: Save edited task
- **WHEN** user edits a task and clicks Save
- **THEN** the task SHALL be updated via the PATCH API
- **AND** the task list SHALL reflect the updated values immediately

### Requirement: Persist selected list
The selected list/view SHALL be persisted to localStorage. On page reload, the previously selected list SHALL be restored.

#### Scenario: Selection persists
- **WHEN** user selects a list and reloads the page
- **THEN** the same list SHALL be selected after reload

#### Scenario: Fallback if list deleted
- **WHEN** the persisted list ID no longer exists
- **THEN** selection SHALL fall back to Inbox

### Requirement: Remove Important/Urgent flags
The task creation and edit forms SHALL NOT include Important and Urgent checkboxes. Priority (none/low/medium/high/urgent) is sufficient.

#### Scenario: No Important/Urgent in form
- **WHEN** the task form renders
- **THEN** no Important or Urgent checkboxes SHALL be present
- **AND** Priority select SHALL be the only priority mechanism

### Requirement: New tasks appear immediately
When a task is created, it SHALL appear in the task list immediately without requiring a page reload.

#### Scenario: Instant task appearance
- **WHEN** user creates a new task
- **THEN** the task SHALL appear in the list immediately
- **AND** the task count SHALL update

### Requirement: Task metadata always visible
Each task row SHALL always show priority badge (if set) and due date (in relative form: Today, Tomorrow, overdue indicator).

#### Scenario: Metadata displayed
- **WHEN** a task has priority "high" and due_date of today
- **THEN** the task row SHALL show a "high" priority badge and "Today" due date label
