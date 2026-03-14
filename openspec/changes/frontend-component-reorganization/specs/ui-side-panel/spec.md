## ADDED Requirements

### Requirement: Side panel renders vertical panel
`<ui-side-panel>` SHALL render a vertical panel with a header area and scrollable content area. It SHALL extend `PosBaseElement` and use Shadow DOM.

#### Scenario: Default rendering
- **WHEN** `<ui-side-panel>` is rendered with content
- **THEN** a vertical panel SHALL be displayed with border on the right side
- **AND** content area SHALL be scrollable when content overflows

### Requirement: Side panel width attribute
`<ui-side-panel>` SHALL support a `width` attribute to set the panel width. Default width SHALL be `240px`.

#### Scenario: Default width
- **WHEN** `<ui-side-panel>` is rendered without a `width` attribute
- **THEN** the panel width SHALL be `240px`

#### Scenario: Custom width
- **WHEN** `<ui-side-panel width="300">` is rendered
- **THEN** the panel width SHALL be `300px`

### Requirement: Side panel header slot
`<ui-side-panel>` SHALL support a named `header` slot rendered at the top of the panel with a bottom border separator.

#### Scenario: Header provided
- **WHEN** `<ui-side-panel><h3 slot="header">Lists</h3></ui-side-panel>` is rendered
- **THEN** the header text SHALL appear at the top with a bottom border

#### Scenario: No header
- **WHEN** `<ui-side-panel>` is rendered without a header slot
- **THEN** the header area SHALL be hidden (no empty space)

### Requirement: Side panel footer slot
`<ui-side-panel>` SHALL support a named `footer` slot rendered at the bottom of the panel, pinned below the scrollable content.

#### Scenario: Footer provided
- **WHEN** `<ui-side-panel><div slot="footer">Create new</div></ui-side-panel>` is rendered
- **THEN** the footer SHALL appear at the bottom, below the scrollable content area
- **AND** it SHALL have a top border separator

#### Scenario: No footer
- **WHEN** `<ui-side-panel>` is rendered without a footer slot
- **THEN** no footer area SHALL be displayed

### Requirement: Side panel uses design tokens
`<ui-side-panel>` SHALL use design tokens for all visual properties including background, borders, padding, and spacing.

#### Scenario: Token usage
- **WHEN** the component CSS is inspected
- **THEN** background SHALL use `--pos-color-background-secondary`
- **AND** borders SHALL use `--pos-color-border-default`
- **AND** padding SHALL use `--pos-space-*` tokens
