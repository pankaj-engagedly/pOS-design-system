## MODIFIED Requirements

### Requirement: Button renders native button in Shadow DOM
`<ui-button>` SHALL render a native `<button>` element inside its Shadow DOM with a `<slot>` for content projection.

#### Scenario: Default rendering
- **WHEN** `<ui-button>Click me</ui-button>` is rendered
- **THEN** a native `<button>` with slotted text "Click me" SHALL be visible

### Requirement: Button variant attribute
`<ui-button>` SHALL support a `variant` attribute with values: `solid` (default), `outline`, `ghost`, `danger`.

#### Scenario: Solid variant uses action primary color
- **WHEN** `<ui-button variant="solid">` is rendered
- **THEN** background SHALL use `--pos-color-action-primary`
- **AND** text SHALL use a contrasting color

#### Scenario: Outline variant
- **WHEN** `<ui-button variant="outline">` is rendered
- **THEN** background SHALL be transparent
- **AND** border SHALL use `--pos-color-action-primary`

#### Scenario: Ghost variant
- **WHEN** `<ui-button variant="ghost">` is rendered
- **THEN** background and border SHALL be transparent
- **AND** hover SHALL show a subtle background

#### Scenario: Danger variant
- **WHEN** `<ui-button variant="danger">` is rendered
- **THEN** background SHALL use a danger/red color

### Requirement: Button size variants
`<ui-button>` SHALL support `size` attribute with values `sm`, `md` (default), `lg`. Size affects padding, font-size, and min-height.

#### Scenario: Small button
- **WHEN** `<ui-button size="sm">` is rendered
- **THEN** it SHALL use `--pos-font-size-xs` and smaller padding

#### Scenario: Large button
- **WHEN** `<ui-button size="lg">` is rendered
- **THEN** it SHALL use `--pos-font-size-md` and larger padding

### Requirement: Button disabled state
`<ui-button>` SHALL mirror the `disabled` attribute to the internal `<button>`. A disabled button SHALL have reduced opacity and `cursor: not-allowed`.

#### Scenario: Disabled button
- **WHEN** `<ui-button disabled>` is rendered
- **THEN** the internal button SHALL be disabled
- **AND** opacity SHALL be reduced

### Requirement: Button uses semantic tokens only
All colors in `<ui-button>` styles SHALL reference `--pos-*` semantic tokens. No hardcoded hex values.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references

### Requirement: Button focus ring
`<ui-button>` SHALL display a visible focus ring on `:focus-visible` using `--pos-color-action-primary`.

#### Scenario: Keyboard focus shows ring
- **WHEN** the button receives focus via keyboard navigation
- **THEN** a `2px solid` outline using `--pos-color-action-primary` SHALL be visible with `2px` offset
