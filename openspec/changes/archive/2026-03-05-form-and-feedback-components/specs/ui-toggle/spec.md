## ADDED Requirements

### Requirement: Toggle renders as a switch control
`<ui-toggle>` SHALL render a track with a sliding thumb indicator and a `<label>` wrapping a `<slot>` for label text. It wraps a hidden `<input type="checkbox">` with `role="switch"`.

#### Scenario: Default rendering
- **WHEN** `<ui-toggle>Dark mode</ui-toggle>` is rendered
- **THEN** a track/thumb switch and "Dark mode" label SHALL be visible
- **AND** the internal input SHALL have `role="switch"`

### Requirement: Toggle checked state
`<ui-toggle>` SHALL support a `checked` attribute and property. When checked, the thumb slides to the right and the track shows the active color.

#### Scenario: Toggling on
- **WHEN** the user clicks an unchecked toggle
- **THEN** the thumb SHALL slide to the right
- **AND** the track SHALL use `--pos-color-action-primary` background
- **AND** the `checked` property SHALL be `true`

#### Scenario: Toggling off
- **WHEN** the user clicks a checked toggle
- **THEN** the thumb SHALL slide to the left
- **AND** the track SHALL use a neutral background

### Requirement: Toggle size variants
`<ui-toggle>` SHALL support `size` attribute with values `sm`, `md` (default), `lg`.

#### Scenario: Small toggle
- **WHEN** `<ui-toggle size="sm">` is rendered
- **THEN** the track and thumb SHALL be visually smaller

#### Scenario: Large toggle
- **WHEN** `<ui-toggle size="lg">` is rendered
- **THEN** the track and thumb SHALL be visually larger

### Requirement: Toggle disabled state
`<ui-toggle>` SHALL support a `disabled` attribute that prevents interaction and applies reduced opacity.

#### Scenario: Disabled toggle
- **WHEN** `<ui-toggle disabled>Locked</ui-toggle>` is rendered
- **THEN** clicking SHALL NOT toggle the state
- **AND** the component SHALL have reduced opacity

### Requirement: Toggle fires change event
`<ui-toggle>` SHALL dispatch a native `change` event when toggled.

#### Scenario: Change event
- **WHEN** the user toggles the switch
- **THEN** a `change` event SHALL fire
- **AND** `event.target.checked` SHALL reflect the new state

### Requirement: Toggle uses semantic tokens only
All colors SHALL reference `--pos-*` semantic tokens.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references
