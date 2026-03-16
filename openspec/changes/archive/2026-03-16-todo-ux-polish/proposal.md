## Why

The todo app has a working backend and basic UI, but the user experience needs polish before adding more modules. Key issues: no way to edit tasks, no visual feedback when tasks are completed, sidebar isn't collapsible, no global header bar, new tasks don't appear without reload, and the sidebar doesn't have smart views (Inbox, Today, Upcoming) that modern todo apps provide.

## What Changes

- **Collapsible app sidebar**: Make the main pOS sidebar collapsible with a toggle button
- **Top header bar**: Add a global header with search, profile avatar, and settings dropdown; move user name and logout from sidebar footer to header
- **Fix horizontal scroll**: The todo panel width causes overflow — fix layout constraints
- **Inline add task**: Move "Add task" from top-right corner to inline below the task list
- **Task completion**: Wire up checkbox toggle to mark tasks done/undone (already partially works via toggle-status event but needs visual polish)
- **Task editing**: Click a task to open an edit form/panel; save changes via PATCH API
- **Selected list highlight**: Improve the selected nav-item color for better visibility
- **Persist selected list**: Save selected list ID to localStorage; restore on page reload
- **Remove Important/Urgent flags**: Remove from task form — Priority covers the same intent
- **Smart sidebar sections**: Add Inbox (default list), Today (tasks due today), Upcoming (tasks with future due dates), Completed (done tasks) as virtual views above user-created lists — Todoist-style. These filter across all lists client-side.
- **Task metadata display**: Show priority badge and relative due date (Today, Tomorrow, overdue) on each task row — already partially implemented, ensure always visible
- **Fix reactivity**: New tasks not appearing without reload — ensure store updates trigger re-render

## Capabilities

### New Capabilities
- `app-header`: Global top header bar with search, profile, and settings
- `todo-smart-views`: Virtual sidebar sections (Inbox, Today, Upcoming, Completed) filtering across all lists

### Modified Capabilities
- `ui-side-panel`: Adding collapsible behavior
- `frontend-shell`: Moving user section from sidebar to header, adding collapsible sidebar

## Impact

- **Frontend shell** (`app-shell.js`): Major refactor — add header bar, collapsible sidebar, move user section
- **Todo sidebar** (`pos-list-sidebar.js`): Add smart view sections above user lists
- **Todo task list** (`pos-task-list.js`): Move add button inline, add edit support
- **Todo task item** (`pos-task-item.js`): Remove important/urgent flags, ensure metadata always shown
- **Todo task form** (`pos-task-form.js`): Remove important/urgent checkboxes, add edit mode support
- **Todo app page** (`pos-todos-app.js`): Add edit event handling, persist selected list, handle smart views
- **Todo store** (`store.js`): Add allTasks state for smart views, persist selectedListId
- **Design system** (`ui-side-panel`): Add collapsible attribute and toggle
- **No backend changes** — all smart views filter client-side from existing list-based API
