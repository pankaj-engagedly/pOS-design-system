## ADDED Requirements

### Requirement: Divider renders a horizontal separator
`<ui-divider>` SHALL render a horizontal line using a `1px` border with `--pos-color-border-default` color. It SHALL be a block-level element with vertical margin from `--pos-space-sm`.

#### Scenario: Default horizontal divider
- **WHEN** `<ui-divider></ui-divider>` is rendered
- **THEN** a horizontal line SHALL appear with token-based border color and vertical spacing

### Requirement: Divider vertical orientation
`<ui-divider>` SHALL support `orientation="vertical"` for use inside flex layouts. A vertical divider SHALL render as a `1px` wide, full-height element with horizontal margin from `--pos-space-sm`.

#### Scenario: Vertical divider in flex container
- **WHEN** `<ui-divider orientation="vertical">` is rendered inside a `display: flex` container
- **THEN** it SHALL render as a vertical line spanning the container height

### Requirement: Divider uses semantic tokens only
All colors and spacing SHALL reference `--pos-*` semantic tokens.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all visual values SHALL be `var(--pos-*)` references
