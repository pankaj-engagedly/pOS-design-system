## ADDED Requirements

### Requirement: Tag renders removable label
`<ui-tag>` SHALL render as an inline-flex element displaying slotted text content with an optional close button.

#### Scenario: Default tag rendering
- **WHEN** `<ui-tag>JavaScript</ui-tag>` is rendered
- **THEN** it SHALL display "JavaScript" with a subtle background and border-radius

### Requirement: Tag removable behavior
When `<ui-tag>` has the `removable` attribute, it SHALL display a close (×) button. Clicking the close button SHALL dispatch a `remove` CustomEvent with `{ bubbles: true, composed: true }`.

#### Scenario: Removable tag shows close button
- **WHEN** `<ui-tag removable>React</ui-tag>` is rendered
- **THEN** a close (×) button SHALL be visible after the text

#### Scenario: Close button dispatches remove event
- **WHEN** the close button is clicked
- **THEN** a `remove` CustomEvent SHALL be dispatched on the `<ui-tag>` host element
- **AND** the event SHALL have `bubbles: true` and `composed: true`

#### Scenario: Non-removable tag has no close button
- **WHEN** `<ui-tag>` does not have the `removable` attribute
- **THEN** no close button SHALL be rendered

### Requirement: Tag color variants
`<ui-tag>` SHALL support a `variant` attribute with values: `neutral` (default), `primary`, `purple`, `orange`.

#### Scenario: Primary variant
- **WHEN** `<ui-tag variant="primary">Featured</ui-tag>` is rendered
- **THEN** the background and text color SHALL reflect the primary action color scheme

### Requirement: Tag size variants
`<ui-tag>` SHALL support `size` attribute with values `sm`, `md` (default).

#### Scenario: Small tag
- **WHEN** `<ui-tag size="sm">` is rendered
- **THEN** it SHALL use smaller padding and font-size
