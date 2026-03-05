## MODIFIED Requirements

### Requirement: Input renders native input in Shadow DOM
`<ui-input>` SHALL render a native `<input>` inside a styled wrapper div within its Shadow DOM.

#### Scenario: Default rendering
- **WHEN** `<ui-input placeholder="Enter text"></ui-input>` is rendered
- **THEN** a native `<input>` with the placeholder text SHALL be visible inside a bordered wrapper

### Requirement: Input attribute mirroring
`<ui-input>` SHALL mirror `type`, `value`, `placeholder`, and `disabled` attributes to the internal `<input>` element.

#### Scenario: Type attribute mirrored
- **WHEN** `<ui-input type="email">` is rendered
- **THEN** the internal input SHALL have `type="email"`

#### Scenario: Disabled attribute mirrored
- **WHEN** `<ui-input disabled>` is rendered
- **THEN** the internal input SHALL be disabled
- **AND** the wrapper SHALL have reduced opacity

### Requirement: Input value property
`<ui-input>` SHALL expose a `value` getter/setter that reads from and writes to the internal `<input>`.

#### Scenario: Reading value
- **WHEN** the user types "hello" into the input
- **THEN** `element.value` SHALL return "hello"

### Requirement: Input size variants
`<ui-input>` SHALL support `size` attribute with values `sm`, `md` (default), `lg`. Size affects padding, font-size, and height.

#### Scenario: Small input
- **WHEN** `<ui-input size="sm">` is rendered
- **THEN** it SHALL use `--pos-font-size-xs` and smaller padding

#### Scenario: Large input
- **WHEN** `<ui-input size="lg">` is rendered
- **THEN** it SHALL use `--pos-font-size-md` and larger padding

### Requirement: Input uses semantic tokens only
All colors in `<ui-input>` styles SHALL reference `--pos-*` semantic tokens. No hardcoded hex values.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references

### Requirement: Input focus ring
The input wrapper SHALL display a visible focus ring on `:focus-within` using `--pos-color-action-primary`.

#### Scenario: Focus shows ring
- **WHEN** the internal input receives focus
- **THEN** the wrapper SHALL display a `2px solid` outline using `--pos-color-action-primary`
