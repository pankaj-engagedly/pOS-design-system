## ADDED Requirements

### Requirement: Select wraps native select element
`<ui-select>` SHALL render a styled wrapper around a native `<select>` element inside Shadow DOM. Light DOM `<option>` children SHALL be slotted into the native select.

#### Scenario: Default rendering
- **WHEN** `<ui-select><option>A</option><option>B</option></ui-select>` is rendered
- **THEN** a styled select dropdown with options A and B SHALL be visible

### Requirement: Select value property
`<ui-select>` SHALL expose a `value` getter/setter that reads from and writes to the internal `<select>`.

#### Scenario: Reading value
- **WHEN** the user selects option "B"
- **THEN** `element.value` SHALL return `"B"`

### Requirement: Select placeholder
`<ui-select>` SHALL support a `placeholder` attribute that renders as a disabled, hidden first option.

#### Scenario: Placeholder shown
- **WHEN** `<ui-select placeholder="Choose..."><option>A</option></ui-select>` is rendered
- **THEN** "Choose..." SHALL appear as the initial unselectable text

### Requirement: Select size variants
`<ui-select>` SHALL support `size` attribute with values `sm`, `md` (default), `lg` affecting padding and font-size.

#### Scenario: Small select
- **WHEN** `<ui-select size="sm">` is rendered
- **THEN** it SHALL use smaller padding and `--pos-font-size-xs`

#### Scenario: Large select
- **WHEN** `<ui-select size="lg">` is rendered
- **THEN** it SHALL use larger padding and `--pos-font-size-md`

### Requirement: Select disabled state
`<ui-select>` SHALL support a `disabled` attribute that prevents interaction and applies reduced opacity.

#### Scenario: Disabled select
- **WHEN** `<ui-select disabled>` is rendered
- **THEN** the select SHALL be non-interactive with reduced opacity

### Requirement: Select fires change event
`<ui-select>` SHALL dispatch a native `change` event when the selection changes.

#### Scenario: Change event
- **WHEN** the user selects a different option
- **THEN** a `change` event SHALL fire

### Requirement: Select uses semantic tokens only
All colors SHALL reference `--pos-*` semantic tokens. Border, background, and text SHALL match `<ui-input>` styling.

#### Scenario: Visual consistency with input
- **WHEN** `<ui-select>` and `<ui-input>` are placed side by side at the same size
- **THEN** they SHALL have matching border, radius, and height
