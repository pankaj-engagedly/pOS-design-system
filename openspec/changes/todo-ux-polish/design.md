## Context

The todo app has a functional backend and basic UI from Phase 1. The app shell has a fixed sidebar with navigation, user info, and logout. The todo module has its own inner sidebar for lists and a task list panel. Several UX gaps remain: no editing, no smart views, reactivity bugs, and layout issues.

## Goals / Non-Goals

**Goals:**
- Make the app feel like a polished todo app (Todoist-level UX)
- All changes are frontend-only — no backend modifications needed
- Smart views (Today, Upcoming, Completed) work by fetching all lists' tasks client-side
- Task editing via inline form or click-to-edit
- Persist user's selected list across reloads

**Non-Goals:**
- Adding new backend API endpoints (smart views filter client-side)
- Mobile responsive design (desktop-first for now)
- Drag-and-drop reordering
- Task search functionality (search bar is placeholder for now)
- Notifications or reminders

## Decisions

### 1. Smart views fetch all tasks client-side
**Rationale**: The backend only has `GET /lists/{id}/tasks`. Rather than adding new endpoints, we fetch tasks from all lists on load and filter in the store. The dataset is small (personal todo app) so this is fine.
**Implementation**: On app mount, fetch all lists, then fetch tasks for each list. Store all tasks in `allTasks`. Smart views filter `allTasks` by criteria (due today, due in future, status=done).
**Alternative considered**: Add backend endpoints for `GET /tasks?due=today` — deferred to avoid backend changes in this UX-focused change.

### 2. Top header replaces sidebar user section
**Rationale**: The sidebar user section wastes vertical space. A top header with profile/settings is a standard pattern and frees up sidebar space for smart views.
**Implementation**: Add a `pos-app-header` component in the shell. Move logout and user name there. Add a placeholder search input and profile avatar.
**The header is part of the app shell**, not a design system component (it has app-specific logic like auth).

### 3. Collapsible sidebar via ui-side-panel enhancement
**Rationale**: The sidebar takes 240px that could be useful on smaller screens. Adding `collapsible` attribute to `ui-side-panel` keeps it reusable.
**Implementation**: Add `collapsed` boolean attribute. When collapsed, panel shrinks to icon-width. Toggle button built into the component.

### 4. Task editing via inline form
**Rationale**: Clicking a task opens an edit form inline (replaces the task row temporarily) rather than a modal or separate panel. This is simpler and keeps context.
**Implementation**: `pos-task-list` tracks `_editingTaskId`. When set, that task's row is replaced with `<pos-task-form mode="edit">` pre-filled with task data. Save dispatches `task-update` event.

### 5. Inline add at bottom of task list
**Rationale**: The add button in the header takes the user's eye away from where the new task will appear. Inline add at the bottom (like Todoist) keeps flow natural.
**Implementation**: Always show a minimal "add task" input row at the bottom of the task list. Clicking it expands to the full form.

### 6. Remove Important/Urgent flags
**Rationale**: Priority (none/low/medium/high/urgent) already covers urgency levels. Having separate is_important and is_urgent booleans alongside priority is redundant.
**Implementation**: Remove from task form and task item display. Keep the fields in the backend model (no migration needed), just stop sending/showing them.

### 7. Selected list persistence via localStorage
**Rationale**: Simple and effective. No backend state needed.
**Implementation**: Save `selectedListId` to `localStorage` on change. On load, restore from localStorage if the list still exists.

## Risks / Trade-offs

- **[Risk] Fetching all tasks from all lists could be slow with many lists** → Mitigation: Personal app, unlikely to have >20 lists. Can add pagination later.
- **[Risk] Smart views show tasks from all lists mixed together** → Mitigation: Show list name as a subtle label on each task in smart views.
- **[Trade-off] Collapsible sidebar adds complexity to ui-side-panel** → Accepted: It's a genuinely reusable feature for future modules.
- **[Trade-off] No backend changes means smart view filtering is client-side only** → Accepted for now; backend endpoints can be added later if performance requires.
