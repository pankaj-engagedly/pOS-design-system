## Why

Frontend components in `frontend/shared/` mix todo-specific components with genuinely reusable ones, violating atomic design boundaries. These components also define styles from scratch (hardcoded px values, raw hex colors) instead of composing from design system `ui-*` atoms and using design tokens. This makes the codebase inconsistent, harder to maintain, and means the design system investment isn't paying off in the app layer.

## What Changes

- **Move todo-specific components** (`pos-task-item`, `pos-task-form`, `pos-subtask-list`, `pos-task-list`) from `frontend/shared/` into `frontend/modules/todos/components/`
- **Promote `pos-list-item` to design system** as `ui-nav-item` — a selectable navigation row with label, count badge, and icon support
- **Add `ui-side-panel`** to design system — a collapsible sidebar panel with header slot, used for navigation sidebars
- **Add `ui-app-layout`** to design system — a sidebar + main content split layout component
- **Add priority semantic tokens** to the design system token set (`--pos-color-priority-*`)
- **Refactor `pos-list-sidebar`** to compose from `ui-side-panel` + `ui-nav-item` + `ui-input`/`ui-button`
- **Refactor todo components** to use `ui-input`, `ui-select`, `ui-textarea`, `ui-button`, `ui-checkbox`, `ui-badge` instead of raw HTML elements
- **Replace all hardcoded styles** in molecules/organisms with design tokens (`--pos-space-*`, `--pos-radius-*`, `--pos-font-*`)
- **Delete `pos-list-item`** from `frontend/shared/molecules/` after migration to `ui-nav-item`

## Capabilities

### New Capabilities
- `ui-nav-item`: Selectable navigation list item with label, count/badge, selected state, and optional icon. Promoted from app-level `pos-list-item`.
- `ui-side-panel`: Collapsible sidebar panel with header slot, configurable width, and content area for navigation lists.
- `ui-app-layout`: Two-panel layout component providing sidebar + main content split with configurable sidebar width.
- `priority-tokens`: Semantic color tokens for task priority levels (low, medium, high, urgent).

### Modified Capabilities
- `semantic-tokens`: Adding priority color tokens to the semantic token set.

## Impact

- **Design system**: 3 new components (`ui-nav-item`, `ui-side-panel`, `ui-app-layout`), extended semantic tokens
- **Frontend shared**: `pos-list-sidebar` refactored, `pos-list-item` removed (replaced by `ui-nav-item`)
- **Frontend todos module**: 4 components moved in from shared, all refactored to compose from design system
- **Tests**: New design system component tests needed; existing todo app behavior unchanged
- **No backend changes**
- **No breaking API changes** — all changes are internal component restructuring
