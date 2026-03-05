## 1. Form Controls — Checkbox & Radio

- [x] 1.1 Create `src/components/ui-checkbox.js`: extends `PosBaseElement`, hidden native `<input type="checkbox">` with styled indicator (border box → checkmark on checked, dash on indeterminate), `<label>` wrapping `<slot>` for label text, `checked`/`indeterminate`/`disabled` attributes, dispatches native `change` event, all colors from tokens
- [x] 1.2 Create `src/components/ui-radio.js`: extends `PosBaseElement`, hidden native `<input type="radio">` with styled circular indicator (ring → filled dot on checked), `<label>` wrapping `<slot>`, `name`/`value`/`checked`/`disabled` attributes, mutual exclusion via shared `name`, dispatches native `change` event

## 2. Form Controls — Toggle & Select

- [x] 2.1 Create `src/components/ui-toggle.js`: extends `PosBaseElement`, hidden `<input type="checkbox">` with `role="switch"`, styled track/thumb with CSS transition, `checked`/`disabled` attributes, `size` (sm/md/lg), `<label>` wrapping `<slot>`, track uses `--pos-color-action-primary` when checked
- [x] 2.2 Create `src/components/ui-select.js`: extends `PosBaseElement`, styled wrapper around native `<select>`, `<slot>` for `<option>` children moved into internal select, `placeholder` attribute as disabled first option, `value` getter/setter, `size` (sm/md/lg), `disabled` attribute, visual consistency with `<ui-input>` (matching border, radius, height)

## 3. Form Controls — Textarea

- [x] 3.1 Create `src/components/ui-textarea.js`: extends `PosBaseElement`, native `<textarea>` in styled wrapper matching `<ui-input>` visuals, mirrors `placeholder`/`disabled`/`rows` attributes, `value` getter/setter, `resize` attribute (none/vertical/horizontal/both, default vertical), `size` (sm/md/lg), focus ring on `:focus-within`

## 4. Feedback — Alert

- [x] 4.1 Create `src/components/ui-alert.js`: extends `PosBaseElement`, inline banner with left border accent, `variant` attribute (info/success/warning/danger) with distinct border and background colors, `dismissible` attribute showing close button, dispatches `dismiss` CustomEvent `{ bubbles: true, composed: true }` and hides on dismiss, `header` named slot for title, default slot for body

## 5. Feedback — Progress

- [x] 5.1 Create `src/components/ui-progress.js`: extends `PosBaseElement`, track + fill bar, `value`/`max` attributes (fill = value/max * 100%), indeterminate mode when no `value` (animated sliding bar), `size` (sm=4px/md=8px/lg=12px), `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`, track uses `--pos-color-background-secondary`, fill uses `--pos-color-action-primary`

## 6. Registration & Showcase

- [x] 6.1 Update `src/index.js` to import and register all new components (`ui-checkbox`, `ui-radio`, `ui-toggle`, `ui-select`, `ui-textarea`, `ui-alert`, `ui-progress`)
- [x] 6.2 Update `examples/showcase.html` to add sidebar nav entries and sections for all 7 new components with live demos, code examples, and attribute tables
- [x] 6.3 Verify all new components render correctly in both light and dark themes
