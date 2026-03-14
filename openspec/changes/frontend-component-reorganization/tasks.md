## 1. Design System — Priority Tokens

- [x] 1.1 Add priority color tokens (`--pos-color-priority-low/medium/high/urgent`) to `tokens/semantic/base.json`
- [x] 1.2 Rebuild tokens (`npm run build:tokens`) and verify in `dist/tokens/theme.css`

## 2. Design System — `ui-nav-item` Component

- [x] 2.1 Create `design-system/src/components/ui-nav-item.js` extending PosBaseElement with label (default slot), `count` attribute, `selected` attribute, `icon` slot
- [x] 2.2 Register `ui-nav-item` in `design-system/src/index.js`
- [x] 2.3 Add `ui-nav-item` tests in `design-system/test/ui-nav-item.test.js`

## 3. Design System — `ui-side-panel` Component

- [x] 3.1 Create `design-system/src/components/ui-side-panel.js` with `width` attribute, `header`/`footer`/default slots, scrollable content area
- [x] 3.2 Register `ui-side-panel` in `design-system/src/index.js`
- [x] 3.3 Add `ui-side-panel` tests in `design-system/test/ui-side-panel.test.js`

## 4. Design System — `ui-app-layout` Component

- [x] 4.1 Create `design-system/src/components/ui-app-layout.js` with `sidebar-width` attribute, `sidebar`/default slots, full-height layout
- [x] 4.2 Register `ui-app-layout` in `design-system/src/index.js`
- [x] 4.3 Add `ui-app-layout` tests in `design-system/test/ui-app-layout.test.js`

## 5. Design System — Build & Verify

- [x] 5.1 Run design system build (`npm run build`) and verify all 3 new components are bundled
- [x] 5.2 Run design system tests (`npm test`) and verify all pass

## 6. Move Todo Components to Module

- [x] 6.1 Create `frontend/modules/todos/components/` directory
- [x] 6.2 Move `frontend/shared/molecules/pos-task-item.js` → `frontend/modules/todos/components/pos-task-item.js`
- [x] 6.3 Move `frontend/shared/molecules/pos-task-form.js` → `frontend/modules/todos/components/pos-task-form.js`
- [x] 6.4 Move `frontend/shared/molecules/pos-subtask-list.js` → `frontend/modules/todos/components/pos-subtask-list.js`
- [x] 6.5 Move `frontend/shared/organisms/pos-task-list.js` → `frontend/modules/todos/components/pos-task-list.js`
- [x] 6.6 Update import paths in `frontend/modules/todos/pages/pos-todos-app.js`

## 7. Refactor `pos-list-sidebar` to Compose from Design System

- [x] 7.1 Refactor `frontend/shared/organisms/pos-list-sidebar.js` to use `<ui-side-panel>` as its shell
- [x] 7.2 Replace internal list item markup with `<ui-nav-item>` components
- [x] 7.3 Replace raw button/input with `<ui-button>` and `<ui-input>` for the create-list form
- [x] 7.4 Replace all hardcoded styles with design tokens (`--pos-space-*`, `--pos-radius-*`, `--pos-font-*`)

## 8. Delete Old `pos-list-item`

- [x] 8.1 Delete `frontend/shared/molecules/pos-list-item.js` (replaced by `ui-nav-item`)
- [x] 8.2 Grep codebase for any remaining references to `pos-list-item` and update

## 9. Refactor Todo Components to Compose from Design System

- [x] 9.1 Refactor `pos-task-item.js` — use `<ui-checkbox>` for status toggle, `<ui-badge>` for priority with `--pos-color-priority-*` tokens, replace hardcoded styles with tokens
- [x] 9.2 Refactor `pos-task-form.js` — use `<ui-input>`, `<ui-select>`, `<ui-textarea>`, `<ui-button>`, `<ui-checkbox>` instead of raw HTML, replace hardcoded styles with tokens
- [x] 9.3 Refactor `pos-subtask-list.js` — use `<ui-checkbox>`, `<ui-input>`, `<ui-button>`, replace hardcoded styles with tokens
- [x] 9.4 Refactor `pos-task-list.js` — use `<ui-button>` for filter tabs, replace hardcoded styles with tokens

## 10. Refactor Todos Page to Use Layout Components

- [x] 10.1 Refactor `pos-todos-app.js` to use `<ui-app-layout>` instead of custom flex layout, replace hardcoded dimensions with design tokens

## 11. Integration Verification

- [ ] 11.1 Run `make dev` and verify todo app renders correctly with all refactored components
- [ ] 11.2 Verify list selection, task creation, task toggle, and subtask management all work
- [x] 11.3 Verify no hardcoded px values or hex colors remain in shared/ or todos/ components (grep check)
