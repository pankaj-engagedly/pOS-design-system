## ADDED Requirements

### Requirement: Nav item renders selectable row
`<ui-nav-item>` SHALL render a selectable row with a text label via the default slot. It SHALL extend `PosBaseElement` and use Shadow DOM.

#### Scenario: Default rendering
- **WHEN** `<ui-nav-item>Inbox</ui-nav-item>` is rendered
- **THEN** a row with text "Inbox" SHALL be visible
- **AND** cursor SHALL be `pointer`

### Requirement: Nav item selected state
`<ui-nav-item>` SHALL support a `selected` boolean attribute. When selected, the row SHALL have an active background color using `--pos-color-bg-active`.

#### Scenario: Selected item
- **WHEN** `<ui-nav-item selected>Inbox</ui-nav-item>` is rendered
- **THEN** background SHALL use `--pos-color-bg-active`
- **AND** text SHALL use `--pos-color-text-accent`

#### Scenario: Unselected item
- **WHEN** `<ui-nav-item>Inbox</ui-nav-item>` is rendered without `selected`
- **THEN** background SHALL be transparent
- **AND** hover SHALL show `--pos-color-bg-hover`

### Requirement: Nav item count badge
`<ui-nav-item>` SHALL support a `count` attribute that displays a numeric badge on the right side of the row.

#### Scenario: Count displayed
- **WHEN** `<ui-nav-item count="5">Inbox</ui-nav-item>` is rendered
- **THEN** the number "5" SHALL be displayed on the right side
- **AND** it SHALL use `--pos-color-text-secondary` and `--pos-font-size-sm`

#### Scenario: No count attribute
- **WHEN** `<ui-nav-item>Inbox</ui-nav-item>` is rendered without `count`
- **THEN** no badge SHALL be displayed

### Requirement: Nav item icon slot
`<ui-nav-item>` SHALL support a named `icon` slot rendered before the label text.

#### Scenario: Icon provided
- **WHEN** `<ui-nav-item><ui-icon slot="icon" name="folder"></ui-icon>Tasks</ui-nav-item>` is rendered
- **THEN** the icon SHALL appear before the label text with `--pos-space-sm` gap

#### Scenario: No icon
- **WHEN** `<ui-nav-item>Tasks</ui-nav-item>` is rendered without an icon slot
- **THEN** only the label text SHALL be visible with no extra gap

### Requirement: Nav item click emits event
`<ui-nav-item>` SHALL dispatch a `nav-select` CustomEvent when clicked, with the element reference in `detail`.

#### Scenario: Click fires event
- **WHEN** user clicks on a `<ui-nav-item>`
- **THEN** a `nav-select` CustomEvent SHALL be dispatched
- **AND** it SHALL bubble and be composed (crosses shadow boundaries)

### Requirement: Nav item uses design tokens for all styles
`<ui-nav-item>` SHALL use design tokens for all visual properties: spacing (`--pos-space-*`), border-radius (`--pos-radius-*`), typography (`--pos-font-*`), and colors (`--pos-color-*`).

#### Scenario: No hardcoded values
- **WHEN** the component CSS is inspected
- **THEN** all spacing, radius, font-size, and color values SHALL reference `--pos-*` CSS custom properties
