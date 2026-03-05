## ADDED Requirements

### Requirement: Dialog wraps native dialog element
`<ui-dialog>` SHALL render a native `<dialog>` element inside its Shadow DOM. Opening the dialog SHALL use `showModal()` to get browser-native focus trapping, Escape-to-close, and top-layer rendering.

#### Scenario: Dialog uses native showModal
- **WHEN** the dialog is opened
- **THEN** the internal `<dialog>` SHALL be opened via `showModal()`
- **AND** focus SHALL be trapped within the dialog

### Requirement: Dialog open and close methods
`<ui-dialog>` SHALL expose `open()` and `close()` methods on the host element. `open()` calls `showModal()` on the internal dialog. `close()` calls `close()` on the internal dialog.

#### Scenario: Opening dialog programmatically
- **WHEN** `document.querySelector('ui-dialog').open()` is called
- **THEN** the dialog SHALL become visible with a backdrop

#### Scenario: Closing dialog programmatically
- **WHEN** `document.querySelector('ui-dialog').close()` is called
- **THEN** the dialog SHALL close and focus SHALL return to the previously focused element

### Requirement: Dialog close on Escape
The native `<dialog>` element handles Escape-to-close automatically. `<ui-dialog>` SHALL NOT override or suppress this behavior.

#### Scenario: Escape key closes dialog
- **WHEN** the dialog is open and the user presses Escape
- **THEN** the dialog SHALL close

### Requirement: Dialog backdrop styling
The `::backdrop` pseudo-element SHALL be styled with a semi-transparent dark overlay using `rgba(0, 0, 0, 0.5)`.

#### Scenario: Backdrop is visible
- **WHEN** the dialog is open
- **THEN** a dark semi-transparent overlay SHALL cover the rest of the page

### Requirement: Dialog close button
`<ui-dialog>` SHALL support a `closable` attribute. When present, a close (×) button SHALL render in the top-right corner of the dialog. Clicking it SHALL call `close()`.

#### Scenario: Closable dialog shows close button
- **WHEN** `<ui-dialog closable>` is rendered and opened
- **THEN** a × button SHALL be visible in the top-right corner

#### Scenario: Non-closable dialog has no close button
- **WHEN** `<ui-dialog>` has no `closable` attribute
- **THEN** no close button SHALL render (dialog closes via Escape or programmatic `close()`)

### Requirement: Dialog named slots
`<ui-dialog>` SHALL support `header`, default (body), and `footer` named slots, matching the same pattern as `<ui-card>`.

#### Scenario: Dialog with header and body
- **WHEN** `<ui-dialog><span slot="header">Confirm</span>Are you sure?</ui-dialog>` is opened
- **THEN** "Confirm" SHALL appear in the header area
- **AND** "Are you sure?" SHALL appear in the body area

### Requirement: Dialog dispatches close event
When the dialog closes (by any mechanism), `<ui-dialog>` SHALL dispatch a `close` CustomEvent with `{ bubbles: true, composed: true }`.

#### Scenario: Close event dispatched
- **WHEN** the dialog is closed
- **THEN** a `close` CustomEvent SHALL bubble from the host element

### Requirement: Dialog uses semantic tokens only
All colors, spacing, and radii in `<ui-dialog>` styles SHALL reference `--pos-*` semantic tokens.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all visual values SHALL be `var(--pos-*)` references
