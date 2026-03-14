## Context

The frontend currently has 4 molecules and 2 organisms in `frontend/shared/` that were built during Phase 1 (Auth + Todos). Of these, 4 are todo-specific (`pos-task-item`, `pos-task-form`, `pos-subtask-list`, `pos-task-list`) and 2 are genuinely reusable (`pos-list-item`, `pos-list-sidebar`). All 6 define styles from scratch rather than composing from design system atoms.

The design system has 17 components covering forms, feedback, and content — but the app layer doesn't use them. This change fixes the boundary violations and establishes the composition pattern for all future modules.

## Goals / Non-Goals

**Goals:**
- Establish correct atomic design boundaries: design system = atoms, shared = cross-module molecules/organisms, modules = feature-specific components
- All app-level components compose from `ui-*` atoms — no raw HTML form elements or custom-styled buttons
- All styles use design tokens — no hardcoded px values or hex colors
- Add `ui-nav-item`, `ui-side-panel`, `ui-app-layout` to design system for reuse across modules

**Non-Goals:**
- Changing any user-facing behavior or functionality
- Adding new features to the todo app
- Refactoring backend or API layer
- Building a component library documentation site
- Dark theme support (already deferred)

## Decisions

### 1. `pos-list-item` becomes `ui-nav-item` in design system
**Rationale**: The selectable row with label + count pattern is universal (mail folders, note categories, KB topics, vault folders). It's a pure UI primitive with no app logic.
**Alternative considered**: Keep in `frontend/shared/molecules/` — rejected because every future module would need it, making it a de facto atom.

### 2. `ui-side-panel` as a layout primitive
**Rationale**: Sidebar navigation is a recurring pattern across modules. A design system component provides consistent width, padding, scroll behavior, and header treatment.
**API**: `width` attribute (default 240px), `collapsible` boolean, header/default slots.
**Alternative considered**: Just use CSS grid in each page — rejected because it duplicates layout logic and can't enforce consistency.

### 3. `ui-app-layout` for sidebar + content split
**Rationale**: Every module page will have the same two-panel structure. A layout component standardizes this.
**API**: `sidebar-width` attribute, sidebar/default slots. Handles responsive behavior.
**Alternative considered**: Each page defines its own flex layout — rejected for the same consistency reasons.

### 4. Todo components move to `frontend/modules/todos/components/`
**Rationale**: `pos-task-item`, `pos-task-form`, `pos-subtask-list`, `pos-task-list` are tightly coupled to the todo data model. They don't belong in shared.
**Migration**: Move files, update import paths in `pos-todos-app.js`. No API changes.

### 5. Composition over reimplementation
All refactored components will use design system atoms in their shadow DOM templates:
- `<ui-input>` instead of `<input>` with custom styles
- `<ui-button>` instead of `<button>` with custom styles
- `<ui-checkbox>` instead of custom checkbox markup
- `<ui-badge>` instead of inline-styled priority spans
- `<ui-select>` instead of `<select>` with custom styles

### 6. Priority tokens added to semantic token set
Four new semantic tokens: `--pos-color-priority-low`, `--pos-color-priority-medium`, `--pos-color-priority-high`, `--pos-color-priority-urgent`. Mapped from raw blue/yellow/orange/red tokens. Used by `pos-task-item` via `ui-badge`.

## Risks / Trade-offs

- **[Risk] Design system components may not cover all styling needs of app components** → Mitigation: Use CSS custom properties on `ui-*` components for app-specific overrides; extend component APIs only if the need is genuinely reusable.
- **[Risk] Moving files breaks import paths** → Mitigation: Update all imports in the same commit; grep for old paths before marking complete.
- **[Risk] Shadow DOM composition depth increases** → Mitigation: Keep it to max 2 levels (page → organism → atom). The extra shadow boundary has negligible performance impact for this scale.
- **[Trade-off] More design system components to maintain** → Accepted: 3 new components is manageable, and they prevent duplication across 8 planned modules.
