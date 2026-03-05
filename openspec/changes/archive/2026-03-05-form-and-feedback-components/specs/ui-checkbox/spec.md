## ADDED Requirements

### Requirement: Checkbox renders native input with label
`<ui-checkbox>` SHALL render a hidden native `<input type="checkbox">` alongside a styled visual indicator and a `<label>` wrapping a `<slot>` for label text.

#### Scenario: Default rendering
- **WHEN** `<ui-checkbox>Check me</ui-checkbox>` is rendered
- **THEN** a styled checkbox indicator and "Check me" label text SHALL be visible
- **AND** clicking the label text SHALL toggle the checkbox

### Requirement: Checkbox checked state
`<ui-checkbox>` SHALL support a `checked` attribute and property that reflects the internal checkbox state.

#### Scenario: Initially checked
- **WHEN** `<ui-checkbox checked>Opted in</ui-checkbox>` is rendered
- **THEN** the checkbox SHALL appear checked with a visible checkmark

#### Scenario: Toggling via click
- **WHEN** the user clicks an unchecked checkbox
- **THEN** the `checked` property SHALL become `true`
- **AND** the visual indicator SHALL show a checkmark

### Requirement: Checkbox indeterminate state
`<ui-checkbox>` SHALL support an `indeterminate` property that shows a dash/minus indicator instead of a checkmark.

#### Scenario: Indeterminate display
- **WHEN** `element.indeterminate = true` is set
- **THEN** the checkbox SHALL display a horizontal dash indicator
- **AND** clicking it SHALL clear indeterminate and set checked to true

### Requirement: Checkbox disabled state
`<ui-checkbox>` SHALL support a `disabled` attribute that prevents interaction and applies reduced opacity.

#### Scenario: Disabled checkbox
- **WHEN** `<ui-checkbox disabled>Can't touch</ui-checkbox>` is rendered
- **THEN** clicking SHALL NOT toggle the state
- **AND** the component SHALL have reduced opacity (0.45)

### Requirement: Checkbox fires change event
`<ui-checkbox>` SHALL dispatch a native `change` event when toggled.

#### Scenario: Change event on toggle
- **WHEN** the user clicks the checkbox
- **THEN** a `change` event SHALL fire
- **AND** `event.target.checked` SHALL reflect the new state

### Requirement: Checkbox uses semantic tokens only
All colors in `<ui-checkbox>` styles SHALL reference `--pos-*` semantic tokens. The checked indicator SHALL use `--pos-color-action-primary`.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references
