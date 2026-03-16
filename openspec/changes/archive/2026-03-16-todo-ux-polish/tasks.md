## 1. App Shell — Top Header Bar

- [x] 1.1 Add header bar to `app-shell.js` with app name (left), search placeholder (center), user profile + logout (right)
- [x] 1.2 Remove user section (name + logout) from sidebar footer in `app-shell.js`
- [x] 1.3 Adjust shell layout: header on top full-width, sidebar + content below
- [x] 1.4 Improve sidebar selected nav item highlight color (use `--pos-color-action-primary` with subtle background)

## 2. Collapsible Sidebar

- [x] 2.1 Add `collapsible` and `collapsed` attributes to `ui-side-panel.js` in design system
- [x] 2.2 Add toggle button to `ui-side-panel` that appears when `collapsible` is set
- [x] 2.3 When collapsed, shrink panel to 48px width, hide text, show only icons
- [x] 2.4 Wire collapse toggle in `app-shell.js` sidebar

## 3. Fix Layout Issues

- [x] 3.1 Fix horizontal scroll on todo app panel — constrain widths with `overflow: hidden` and proper `min-width: 0` on flex children
- [x] 3.2 Adjust `pos-todos-app.js` height to account for new header bar height

## 4. Todo Sidebar — Smart Views

- [x] 4.1 Add smart view items (Inbox, Today, Upcoming, Completed) to `pos-list-sidebar.js` above user lists with icons
- [x] 4.2 Add a "Lists" section label/divider between smart views and user-created lists
- [x] 4.3 Emit `smart-view-select` event with view type (inbox/today/upcoming/completed) when smart view clicked
- [x] 4.4 Handle smart view selection in `pos-todos-app.js` — set `selectedView` state

## 5. Smart View Data Loading

- [x] 5.1 On todo module mount, fetch tasks from ALL lists and store in `allTasks` in the store
- [x] 5.2 Filter `allTasks` for Today view (due_date === today)
- [x] 5.3 Filter `allTasks` for Upcoming view (due_date > today, status !== done)
- [x] 5.4 Filter `allTasks` for Completed view (status === done)
- [x] 5.5 Inbox view uses the first list's tasks (existing behavior)

## 6. Inline Add Task

- [x] 6.1 Remove "Add task" button from task list header in `pos-task-list.js`
- [x] 6.2 Add an inline "Add task" row at the bottom of the task list that expands to the form on click
- [x] 6.3 After form submit, collapse form back to the minimal row

## 7. Task Editing

- [x] 7.1 Handle `select-task` event in `pos-todos-app.js` — fetch full task data and set `_editingTaskId`
- [x] 7.2 In `pos-task-list.js`, render `<pos-task-form mode="edit">` inline when `_editingTaskId` matches a task
- [x] 7.3 Pre-fill edit form with task data via `setValues()`
- [x] 7.4 Handle `task-submit` in edit mode — call `updateTask()` API and refresh task list
- [x] 7.5 Handle `task-cancel` in edit mode — close the edit form

## 8. Remove Important/Urgent Flags

- [x] 8.1 Remove Important and Urgent checkboxes from `pos-task-form.js`
- [x] 8.2 Remove `is_important` and `is_urgent` from form submit data
- [x] 8.3 Remove important/urgent flag rendering from `pos-task-item.js`
- [x] 8.4 Remove `important` and `urgent` attributes from `pos-task-item` usage in `pos-task-list.js`

## 9. Task Metadata & Reactivity

- [x] 9.1 Ensure priority badge and relative due date are always visible on task rows (already done, verify)
- [x] 9.2 Show list name on task rows when in a smart view (Today/Upcoming/Completed)
- [x] 9.3 Fix reactivity: ensure store updates after task creation trigger re-render without page reload
- [x] 9.4 Ensure task completion (checkbox toggle) updates the list immediately

## 10. Persist Selected List

- [x] 10.1 Save selected list/view ID to localStorage on change in `pos-todos-app.js`
- [x] 10.2 On mount, restore selected list/view from localStorage; fall back to Inbox if not found
- [x] 10.3 Handle edge case: persisted list no longer exists after reload

## 11. Selected List Highlight

- [x] 11.1 Update `ui-nav-item` selected state styles — use a more visible accent color combination

## 12. Integration Verification

- [x] 12.1 Run `make dev` and verify the full app renders with header, collapsible sidebar, and todo module
- [x] 12.2 Verify smart views (Inbox, Today, Upcoming, Completed) show correct filtered tasks
- [x] 12.3 Verify task creation, editing, completion, and list persistence all work end-to-end
