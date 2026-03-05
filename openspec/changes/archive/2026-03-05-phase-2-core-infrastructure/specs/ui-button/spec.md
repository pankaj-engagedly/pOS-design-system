## ADDED Requirements

### Requirement: ui-button uses native button
`<ui-button>` SHALL render a native `<button>` inside Shadow DOM. The default slot provides the label.

#### Scenario: Native button rendering
- **WHEN** `<ui-button>Save</ui-button>` is rendered
- **THEN** the Shadow DOM SHALL contain `<button><slot></slot></button>`

### Requirement: ui-button variants
`<ui-button>` SHALL support `variant` attribute with values: solid (default), outline, ghost, danger.

#### Scenario: Solid variant
- **WHEN** `variant="solid"` or no variant is set
- **THEN** the button SHALL use `--pos-color-accent` background and white text

#### Scenario: Danger variant
- **WHEN** `variant="danger"` is set
- **THEN** the button SHALL use `--pos-color-danger` background

### Requirement: ui-button disabled state
`<ui-button>` SHALL mirror its `disabled` attribute to the internal `<button>`.

#### Scenario: Disabled
- **WHEN** `disabled` is set on `<ui-button>`
- **THEN** the internal `<button>` SHALL be disabled and visually dimmed

### Requirement: Native click events bubble
`<ui-button>` SHALL NOT suppress or replace native `click` events. The native click from the internal `<button>` SHALL bubble through Shadow DOM naturally.

#### Scenario: Click bubbling
- **WHEN** the internal button is clicked
- **THEN** the native `click` event SHALL be observable on `<ui-button>` and its ancestors

### Requirement: Token-only colors
`<ui-button>` SHALL use only `--pos-color-*` tokens for all color values. No hardcoded hex in the stylesheet.

#### Scenario: No hardcoded colors
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL reference `var(--pos-color-*)` tokens

### Requirement: Focus ring
`<ui-button>` SHALL show a focus ring using `--pos-color-focus` on `:focus-visible`.

#### Scenario: Keyboard focus
- **WHEN** the button is focused via keyboard
- **THEN** a visible focus ring SHALL appear
