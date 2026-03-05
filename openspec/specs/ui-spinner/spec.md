## ADDED Requirements

### Requirement: Spinner renders animated loading indicator
`<ui-spinner>` SHALL render a circular spinning animation using CSS only (no JavaScript animation loop, no SVG). It SHALL use `--pos-color-action-primary` as the spinner color.

#### Scenario: Default spinner rendering
- **WHEN** `<ui-spinner></ui-spinner>` is rendered
- **THEN** it SHALL display a circular spinning animation
- **AND** the animation SHALL use CSS `@keyframes` with `border` technique or equivalent

### Requirement: Spinner size variants
`<ui-spinner>` SHALL support `size` attribute with values `sm` (16px), `md` (24px, default), `lg` (32px).

#### Scenario: Small spinner
- **WHEN** `<ui-spinner size="sm">` is rendered
- **THEN** the spinner SHALL be 16×16px

#### Scenario: Default size
- **WHEN** `size` attribute is omitted
- **THEN** the spinner SHALL be 24×24px

### Requirement: Spinner accessibility
`<ui-spinner>` SHALL include `role="status"` and `aria-label="Loading"` on the internal element for screen reader support.

#### Scenario: Screen reader announces loading
- **WHEN** `<ui-spinner>` is rendered
- **THEN** the internal element SHALL have `role="status"` and `aria-label="Loading"`
