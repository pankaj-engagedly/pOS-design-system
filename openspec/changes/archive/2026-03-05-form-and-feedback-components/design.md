## Design Decisions

### 1. Wrap native form elements, don't replace them

**Decision:** Each form component wraps a native element (`<input type="checkbox">`, `<select>`, `<textarea>`, etc.) inside Shadow DOM, with visual styling applied to a custom wrapper.

**Why:** Native elements give us built-in form participation, keyboard handling, and accessibility for free. Reimplementing these from scratch is error-prone and breaks browser features like autofill.

**Trade-off:** Styling native elements (especially `<select>`) has limits. We accept browser-native dropdown rendering for `<select>` options rather than building a custom listbox.

### 2. Label via slot, not attribute

**Decision:** Checkbox, radio, and toggle use a default `<slot>` for label text rather than a `label` attribute.

**Why:** Slots allow rich content (icons, formatted text) in labels. A string attribute is too limiting. The component wraps both the control and slot in a `<label>` element for click-to-toggle behavior.

### 3. Radio grouping via native name attribute

**Decision:** `<ui-radio>` elements group by sharing the same `name` attribute, matching native radio behavior. No wrapper group component needed.

**Why:** Native `<input type="radio">` already groups by `name`. Adding a `<ui-radio-group>` wrapper would add complexity without benefit at the base layer. Projects can add group components if needed.

**Constraint:** Radios in the same group must share the same `name` value to achieve mutual exclusion.

### 4. Toggle is a styled checkbox, not a button

**Decision:** `<ui-toggle>` wraps a hidden `<input type="checkbox">` with a visual track/thumb, not a `<button>` with toggled state.

**Why:** Checkbox semantics (checked/unchecked) match toggle behavior. Screen readers announce it correctly as a switch with `role="switch"`. Using a button would require manual ARIA state management.

### 5. Select wraps native `<select>` with slotted options

**Decision:** `<ui-select>` renders a styled wrapper around a native `<select>`. Options are passed as `<option>` children in the light DOM and slotted into the native select.

**Why:** Native `<select>` provides accessible keyboard navigation, mobile-optimized pickers, and form integration. Custom dropdown implementations (listbox pattern) are significantly more complex and belong at the project layer if needed.

**Limitation:** Individual option styling is limited to what the browser allows.

### 6. Alert variants match badge pattern

**Decision:** `<ui-alert>` uses `variant` attribute with values `info`, `success`, `warning`, `danger` — following the same semantic color pattern as badges.

**Why:** Consistent variant naming across the system. Alert uses left border accent + subtle background tint for visual distinction without overwhelming the UI.

### 7. Progress uses HTML progress semantics

**Decision:** `<ui-progress>` wraps a styled `<div>` bar (not native `<progress>`) but uses `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

**Why:** Native `<progress>` is extremely hard to style consistently across browsers. A div-based bar with proper ARIA attributes gives us full visual control with correct semantics.

### 8. Indeterminate progress via attribute

**Decision:** When `<ui-progress>` has no `value` attribute (or `value` is removed), it enters indeterminate mode with an animated sliding bar.

**Why:** Matches the native `<progress>` pattern where absence of value = indeterminate. No separate component needed.

### 9. Change events follow native patterns

**Decision:** Form components dispatch native `change` and `input` events where applicable. Custom events only for non-native interactions (alert dismiss).

**Why:** Consistent with the design system's principle of native-first events. `<ui-checkbox>`, `<ui-radio>`, `<ui-toggle>` all fire native `change`. `<ui-alert>` fires a `dismiss` CustomEvent since there's no native equivalent.

### 10. Consistent size variants

**Decision:** All new components support `size` attribute with `sm`/`md`/`lg` where it makes sense (select, textarea, toggle, progress). Checkbox and radio are fixed-size controls (only the label text scales don't need explicit sizing).

**Why:** Matches the existing button/input/badge sizing pattern. Consistent API across the system.
