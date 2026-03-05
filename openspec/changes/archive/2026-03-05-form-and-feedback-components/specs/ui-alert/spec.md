## ADDED Requirements

### Requirement: Alert renders inline feedback banner
`<ui-alert>` SHALL render an inline banner with a left border accent, subtle background tint, and a default `<slot>` for content.

#### Scenario: Default rendering
- **WHEN** `<ui-alert>Something happened</ui-alert>` is rendered
- **THEN** an inline banner with info styling SHALL be visible

### Requirement: Alert variant attribute
`<ui-alert>` SHALL support a `variant` attribute with values `info` (default), `success`, `warning`, `danger`. Each variant uses a distinct left border color and background tint.

#### Scenario: Success alert
- **WHEN** `<ui-alert variant="success">Saved!</ui-alert>` is rendered
- **THEN** the alert SHALL display with a green-toned left border and subtle background

#### Scenario: Danger alert
- **WHEN** `<ui-alert variant="danger">Error occurred</ui-alert>` is rendered
- **THEN** the alert SHALL display with a red/dark-toned left border and subtle background

### Requirement: Alert dismissible
`<ui-alert>` SHALL support a `dismissible` attribute that shows a close button. Clicking the close button SHALL hide the alert and dispatch a `dismiss` CustomEvent with `{ bubbles: true, composed: true }`.

#### Scenario: Dismissible alert
- **WHEN** `<ui-alert dismissible>Notice</ui-alert>` is rendered
- **THEN** a close button (x) SHALL be visible on the right side

#### Scenario: Dismissing
- **WHEN** the user clicks the close button
- **THEN** the alert SHALL be hidden (display: none)
- **AND** a `dismiss` CustomEvent SHALL fire

### Requirement: Alert header slot
`<ui-alert>` SHALL support a named `header` slot for a title/heading above the body content.

#### Scenario: Alert with header
- **WHEN** `<ui-alert><span slot="header">Title</span>Body text</ui-alert>` is rendered
- **THEN** "Title" SHALL appear bold above "Body text"
- **AND** the header slot SHALL be hidden when empty

### Requirement: Alert uses semantic tokens only
All colors SHALL reference `--pos-*` semantic tokens. Variant colors SHALL derive from existing token values.

#### Scenario: Token-only styling
- **WHEN** the component stylesheet is inspected
- **THEN** all color values SHALL be `var(--pos-*)` references
