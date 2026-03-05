## Why

The base design system has button and input but lacks the remaining form primitives (checkbox, radio, toggle, select, textarea) that every application needs. Without these, projects are forced to build their own — breaking consistency. Additionally, inline feedback components (alert, progress) are universal UI patterns that belong in the base layer alongside badges and spinners.

## What Changes

- Add `ui-checkbox` — native checkbox with label, indeterminate support
- Add `ui-radio` — radio button with label, grouping via `name` attribute
- Add `ui-toggle` — on/off switch control
- Add `ui-select` — styled native select dropdown
- Add `ui-textarea` — multi-line text input with auto-resize option
- Add `ui-alert` — inline feedback banner with variant, dismissible option
- Add `ui-progress` — determinate/indeterminate progress bar
- Update showcase page with new component sections

## Capabilities

### New Capabilities
- `ui-checkbox`: Checkbox form control with label slot, checked/indeterminate states, disabled support
- `ui-radio`: Radio button form control with label slot, name-based grouping, checked state
- `ui-toggle`: Binary switch control with on/off states, size variants, label slot
- `ui-select`: Styled select dropdown wrapping native `<select>`, option slotting, size variants
- `ui-textarea`: Multi-line text input with rows/resize control, size variants, placeholder
- `ui-alert`: Inline feedback banner with semantic variants (info/success/warning/danger), optional dismiss button
- `ui-progress`: Progress indicator bar with value/max, indeterminate mode, size variants

### Modified Capabilities
_(none — all new components, no existing spec changes)_

## Impact

- **New files:** 7 component files in `src/components/`
- **Modified files:** `src/index.js` (register new components), `examples/showcase.html` (add sections)
- **Token usage:** All components use existing semantic tokens — no new tokens needed
- **API surface:** 7 new custom elements added to the registry
- **Breaking changes:** None
