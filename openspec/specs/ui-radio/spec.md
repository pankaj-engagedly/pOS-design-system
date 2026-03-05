## ADDED Requirements

### Requirement: Radio renders native input with label
`<ui-radio>` SHALL render a hidden native `<input type="radio">` alongside a styled circular indicator and a `<label>` wrapping a `<slot>` for label text.

#### Scenario: Default rendering
- **WHEN** `<ui-radio name="color">Red</ui-radio>` is rendered
- **THEN** a styled radio circle and "Red" label text SHALL be visible

### Requirement: Radio grouping via name attribute
`<ui-radio>` elements with the same `name` attribute SHALL be mutually exclusive — selecting one deselects others in the group.

#### Scenario: Mutual exclusion
- **WHEN** two radios share `name="size"` and the user clicks the second
- **THEN** the first SHALL become unchecked
- **AND** the second SHALL become checked

### Requirement: Radio checked state
`<ui-radio>` SHALL support a `checked` attribute and property.

#### Scenario: Initially checked
- **WHEN** `<ui-radio name="opt" checked>Default</ui-radio>` is rendered
- **THEN** the radio SHALL appear selected with a filled inner circle

### Requirement: Radio value attribute
`<ui-radio>` SHALL support a `value` attribute that identifies the radio's value within its group.

#### Scenario: Value accessible
- **WHEN** `<ui-radio name="opt" value="a" checked>Option A</ui-radio>` is rendered
- **THEN** `element.value` SHALL return `"a"`

### Requirement: Radio disabled state
`<ui-radio>` SHALL support a `disabled` attribute that prevents interaction and applies reduced opacity.

#### Scenario: Disabled radio
- **WHEN** `<ui-radio disabled>Unavailable</ui-radio>` is rendered
- **THEN** clicking SHALL NOT change the state
- **AND** the component SHALL have reduced opacity

### Requirement: Radio fires change event
`<ui-radio>` SHALL dispatch a native `change` event when selected.

#### Scenario: Change event on select
- **WHEN** the user clicks an unselected radio
- **THEN** a `change` event SHALL fire on the newly selected radio

### Requirement: Radio uses semantic tokens only
All colors SHALL reference `--pos-*` semantic tokens. The selected indicator SHALL use `--pos-color-action-primary`.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references
