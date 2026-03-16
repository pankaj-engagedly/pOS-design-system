## ADDED Requirements

### Requirement: App layout renders two-panel split
`<ui-app-layout>` SHALL render a horizontal two-panel layout with a sidebar slot on the left and main content (default slot) on the right. It SHALL extend `PosBaseElement` and use Shadow DOM.

#### Scenario: Default rendering
- **WHEN** `<ui-app-layout>` is rendered with sidebar and main content
- **THEN** sidebar SHALL appear on the left
- **AND** main content SHALL fill the remaining horizontal space

### Requirement: App layout sidebar width
`<ui-app-layout>` SHALL support a `sidebar-width` attribute controlling the sidebar area width. Default SHALL be `240px`.

#### Scenario: Default sidebar width
- **WHEN** `<ui-app-layout>` is rendered without `sidebar-width`
- **THEN** the sidebar area SHALL be `240px` wide

#### Scenario: Custom sidebar width
- **WHEN** `<ui-app-layout sidebar-width="300">` is rendered
- **THEN** the sidebar area SHALL be `300px` wide

### Requirement: App layout sidebar slot
`<ui-app-layout>` SHALL support a named `sidebar` slot for the left panel content.

#### Scenario: Sidebar content
- **WHEN** `<ui-app-layout><ui-side-panel slot="sidebar">...</ui-side-panel><main>...</main></ui-app-layout>` is rendered
- **THEN** the side panel SHALL appear in the sidebar area
- **AND** the main element SHALL fill the remaining space

### Requirement: App layout full height
`<ui-app-layout>` SHALL take full height of its container by default.

#### Scenario: Full height
- **WHEN** `<ui-app-layout>` is rendered inside a container with defined height
- **THEN** the layout SHALL stretch to fill the container height
- **AND** both sidebar and main areas SHALL be independently scrollable

### Requirement: App layout uses design tokens
`<ui-app-layout>` SHALL use design tokens for all visual properties.

#### Scenario: Token usage
- **WHEN** the component CSS is inspected
- **THEN** all spacing and color values SHALL reference `--pos-*` CSS custom properties
