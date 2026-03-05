## ADDED Requirements

### Requirement: Progress renders a bar indicator
`<ui-progress>` SHALL render a track div with an inner fill bar. The fill width represents the progress percentage.

#### Scenario: Default rendering
- **WHEN** `<ui-progress value="50" max="100"></ui-progress>` is rendered
- **THEN** a bar filled to 50% SHALL be visible

### Requirement: Progress value and max attributes
`<ui-progress>` SHALL support `value` and `max` (default 100) attributes. The fill width SHALL be `(value / max) * 100%`.

#### Scenario: Custom max
- **WHEN** `<ui-progress value="3" max="10">` is rendered
- **THEN** the bar SHALL be filled to 30%

#### Scenario: Value exceeds max
- **WHEN** `value` exceeds `max`
- **THEN** the bar SHALL be clamped to 100% fill

### Requirement: Progress indeterminate mode
When `<ui-progress>` has no `value` attribute, it SHALL enter indeterminate mode with an animated sliding bar.

#### Scenario: Indeterminate
- **WHEN** `<ui-progress></ui-progress>` is rendered (no value)
- **THEN** an animated bar SHALL slide back and forth continuously

#### Scenario: Switching to determinate
- **WHEN** a `value` attribute is set on an indeterminate progress
- **THEN** the animation SHALL stop and the bar SHALL show the specified fill

### Requirement: Progress size variants
`<ui-progress>` SHALL support `size` attribute with values `sm` (4px height), `md` (8px, default), `lg` (12px).

#### Scenario: Small progress
- **WHEN** `<ui-progress size="sm">` is rendered
- **THEN** the track height SHALL be 4px

#### Scenario: Large progress
- **WHEN** `<ui-progress size="lg">` is rendered
- **THEN** the track height SHALL be 12px

### Requirement: Progress accessibility
`<ui-progress>` SHALL have `role="progressbar"` with `aria-valuenow`, `aria-valuemin="0"`, and `aria-valuemax`. In indeterminate mode, `aria-valuenow` SHALL be absent.

#### Scenario: ARIA attributes in determinate mode
- **WHEN** `<ui-progress value="50" max="100">` is rendered
- **THEN** the element SHALL have `role="progressbar"`, `aria-valuenow="50"`, `aria-valuemin="0"`, `aria-valuemax="100"`

#### Scenario: ARIA in indeterminate mode
- **WHEN** `<ui-progress>` is rendered without value
- **THEN** `aria-valuenow` SHALL NOT be present

### Requirement: Progress uses semantic tokens only
The track SHALL use `--pos-color-background-secondary` and the fill SHALL use `--pos-color-action-primary`.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references
