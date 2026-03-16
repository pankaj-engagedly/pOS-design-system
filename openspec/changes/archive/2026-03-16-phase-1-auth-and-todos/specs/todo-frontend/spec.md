# todo-frontend

Todo UI module following Atomic Design. Molecules and organisms live in `frontend/shared/` (reusable by default). Module only contains pages, services, and store.

## Requirements

### Requirement: Todo Page

Main page component that composes the todo UI.

**Behavior:**
- Component: `pos-todos-app` in `frontend/modules/todos/pages/` (replaces placeholder)
- Layout: sidebar (list of todo lists) + main area (tasks for selected list)
- On load: fetch lists from API, select first list (or Inbox), fetch tasks
- Module-local state store for lists and tasks
- API service module at `frontend/modules/todos/services/todo-api.js`

### Requirement: Task Item Molecule

Single task row showing task summary with inline actions.

**Behavior:**
- Component: `pos-task-item` in `frontend/shared/molecules/`
- Displays: checkbox (completion toggle), title, priority badge (ui-badge), due date, important star, urgent flag
- Clicking checkbox toggles status (todo ↔ done) via API
- Clicking task title emits event to show task detail/edit
- Priority shown as colored badge (none=hidden, low=blue, medium=yellow, high=orange, urgent=red)
- Overdue tasks highlight the due date in red
- Uses: ui-checkbox, ui-badge

### Requirement: Task List Organism

Scrollable list of task items with header and basic filtering.

**Behavior:**
- Component: `pos-task-list` in `frontend/shared/organisms/`
- Header: list name + task count + "Add task" button
- Renders `pos-task-item` for each task
- Filter controls: status filter (all/active/done), sort (position/due date/priority)
- "Add task" opens inline form at top of list (pos-task-form)
- Empty state: "No tasks yet" with call to action

### Requirement: Task Form Molecule

Form for creating or editing a task.

**Behavior:**
- Component: `pos-task-form` in `frontend/shared/molecules/`
- Fields: title (required, ui-input), description (ui-textarea), priority (ui-select), due date (ui-input type=date), is_important (ui-checkbox), is_urgent (ui-checkbox)
- Two modes: create (inline at top of list) and edit (in detail view)
- Create mode: minimal — just title input with Enter to submit, expand for more fields
- Submit calls API via todo-api service
- Cancel dismisses form

### Requirement: List Sidebar Organism

Sidebar showing all todo lists with management actions.

**Behavior:**
- Component: `pos-list-sidebar` in `frontend/shared/organisms/`
- Renders each list as `pos-list-item` molecule
- Each list shows: name + task count (active tasks)
- Selected list highlighted
- "New list" button at bottom
- Click list to select it (loads tasks in main area)
- Inline rename on double-click
- Delete list (with ui-dialog confirmation if list has tasks)

### Requirement: Subtask List Molecule

Checklist of subtasks within task detail view.

**Behavior:**
- Component: `pos-subtask-list` in `frontend/shared/molecules/`
- Renders checkboxes for each subtask
- Toggle completion on checkbox click
- "Add subtask" input at bottom
- Delete subtask on X button
- Shows completion count: "3/5 completed"

### Requirement: List Item Molecule

Single list row in the sidebar.

**Behavior:**
- Component: `pos-list-item` in `frontend/shared/molecules/`
- Displays: list name + active task count
- Click to select (emits event)
- Visual highlight when selected
- Could be reused for other sidebar lists in future modules (note folders, KB categories, etc.)

### Requirement: Todo API Service

Module-local API service wrapping all todo endpoints.

**Behavior:**
- Module: `frontend/modules/todos/services/todo-api.js`
- Uses shared `apiFetch` from `api-client.js`
- Functions: `getLists()`, `createList(name)`, `updateList(id, data)`, `deleteList(id)`, `reorderLists(ids)`, `getTasks(listId)`, `createTask(data)`, `getTask(id)`, `updateTask(id, data)`, `deleteTask(id)`, `reorderTasks(listId, ids)`, `addSubtask(taskId, title)`, `updateSubtask(id, data)`, `deleteSubtask(id)`
