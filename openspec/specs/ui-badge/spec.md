## ADDED Requirements

### Requirement: Badge renders inline status indicator
`<ui-badge>` SHALL render as an inline element displaying slotted text content with a colored background and rounded shape.

#### Scenario: Default badge rendering
- **WHEN** `<ui-badge>Active</ui-badge>` is rendered
- **THEN** it SHALL display "Active" with the default (neutral) color scheme
- **AND** it SHALL have rounded corners using `--pos-radius-full`

### Requirement: Badge color variants
`<ui-badge>` SHALL support a `variant` attribute with values: `neutral` (default), `primary`, `success`, `warning`, `danger`, `purple`.

#### Scenario: Primary variant
- **WHEN** `<ui-badge variant="primary">New</ui-badge>` is rendered
- **THEN** the background SHALL use `--pos-color-action-primary`
- **AND** the text SHALL use a contrasting color (white)

#### Scenario: Default variant when attribute omitted
- **WHEN** `<ui-badge>` has no `variant` attribute
- **THEN** it SHALL use the `neutral` color scheme

### Requirement: Badge size variants
`<ui-badge>` SHALL support `size` attribute with values `sm`, `md` (default), `lg`. Size affects padding and font-size.

#### Scenario: Small badge
- **WHEN** `<ui-badge size="sm">` is rendered
- **THEN** it SHALL use smaller padding and `--pos-font-size-xs` font size

#### Scenario: Default size
- **WHEN** `size` attribute is omitted
- **THEN** the badge SHALL render at `md` size using `--pos-font-size-sm`
