## ADDED Requirements

### Requirement: Icon wrapper provides consistent sizing
`<ui-icon>` SHALL render as an inline-flex container that centers its slotted content (an `<i>` or `<span>` with a Font Awesome class) at a consistent size.

#### Scenario: Default icon rendering
- **WHEN** `<ui-icon><i class="fa-solid fa-home"></i></ui-icon>` is rendered
- **THEN** the icon SHALL be centered within a container sized at `md` (20px)

### Requirement: Icon size variants
`<ui-icon>` SHALL support `size` attribute with values `sm` (16px), `md` (20px, default), `lg` (24px).

#### Scenario: Small icon
- **WHEN** `<ui-icon size="sm">` is rendered
- **THEN** the container and font-size SHALL be 16px

#### Scenario: Large icon
- **WHEN** `<ui-icon size="lg">` is rendered
- **THEN** the container and font-size SHALL be 24px

### Requirement: Icon color inheritance
`<ui-icon>` SHALL inherit text color from its parent by default. An optional `color` attribute SHALL allow overriding with a semantic token name.

#### Scenario: Color inherited from parent
- **WHEN** `<ui-icon>` has no `color` attribute
- **THEN** the icon color SHALL be `currentColor` (inherited from parent)

#### Scenario: Color override via attribute
- **WHEN** `<ui-icon color="action">` is rendered
- **THEN** the icon color SHALL use `--pos-color-action-primary`
