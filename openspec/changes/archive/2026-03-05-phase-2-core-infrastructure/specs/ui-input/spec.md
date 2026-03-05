## ADDED Requirements

### Requirement: ui-input uses native input
`<ui-input>` SHALL render a native `<input>` inside Shadow DOM wrapped in a styled container.

#### Scenario: Native input rendering
- **WHEN** `<ui-input>` is rendered
- **THEN** the Shadow DOM SHALL contain a native `<input>` element

### Requirement: ui-input attributes
`<ui-input>` SHALL support `type` (text, email, password, number — default text), `value`, `placeholder`, and `disabled` attributes, all mirrored to the internal `<input>`.

#### Scenario: Attribute mirroring
- **WHEN** `type="email" placeholder="you@example.com"` is set
- **THEN** the internal `<input>` SHALL have `type="email"` and `placeholder="you@example.com"`

### Requirement: Native events bubble
`<ui-input>` SHALL NOT suppress or replace native `input`, `change`, `focus`, or `blur` events. They SHALL bubble through Shadow DOM naturally.

#### Scenario: Input event bubbling
- **WHEN** the user types in the internal input
- **THEN** the native `input` event SHALL be observable on `<ui-input>` and ancestors

#### Scenario: Change event bubbling
- **WHEN** the input value changes and blurs
- **THEN** the native `change` event SHALL bubble through

### Requirement: Value property sync
`<ui-input>` SHALL expose a `value` property that reads from and writes to the internal `<input>`.

#### Scenario: Programmatic value access
- **WHEN** `document.querySelector('ui-input').value` is read
- **THEN** it SHALL return the internal input's current value

### Requirement: Token-only colors
`<ui-input>` SHALL use only `--pos-color-*` tokens for colors. No hardcoded hex.

#### Scenario: Border uses token
- **WHEN** the input is rendered
- **THEN** its border color SHALL be `var(--pos-color-border)`

### Requirement: Focus ring
`<ui-input>` SHALL show a focus ring using `--pos-color-focus` when the internal input is focused.

#### Scenario: Focus visible
- **WHEN** the input is focused
- **THEN** a focus ring SHALL appear using `--pos-color-focus`
