## ADDED Requirements

### Requirement: Textarea renders native textarea in Shadow DOM
`<ui-textarea>` SHALL render a native `<textarea>` inside a styled wrapper div within its Shadow DOM.

#### Scenario: Default rendering
- **WHEN** `<ui-textarea placeholder="Enter text..."></ui-textarea>` is rendered
- **THEN** a styled multi-line text area SHALL be visible with the placeholder

### Requirement: Textarea attribute mirroring
`<ui-textarea>` SHALL mirror `placeholder`, `disabled`, and `rows` attributes to the internal `<textarea>`.

#### Scenario: Rows attribute
- **WHEN** `<ui-textarea rows="5">` is rendered
- **THEN** the textarea SHALL display approximately 5 visible rows

#### Scenario: Disabled attribute
- **WHEN** `<ui-textarea disabled>` is rendered
- **THEN** the textarea SHALL be non-interactive with reduced opacity

### Requirement: Textarea value property
`<ui-textarea>` SHALL expose a `value` getter/setter that reads from and writes to the internal `<textarea>`.

#### Scenario: Reading value
- **WHEN** the user types multi-line text
- **THEN** `element.value` SHALL return the full text content

### Requirement: Textarea resize control
`<ui-textarea>` SHALL support a `resize` attribute with values `none`, `vertical` (default), `horizontal`, `both`.

#### Scenario: No resize
- **WHEN** `<ui-textarea resize="none">` is rendered
- **THEN** the textarea SHALL NOT be resizable by the user

#### Scenario: Vertical resize (default)
- **WHEN** `<ui-textarea>` is rendered without resize attribute
- **THEN** the textarea SHALL be resizable only vertically

### Requirement: Textarea size variants
`<ui-textarea>` SHALL support `size` attribute with values `sm`, `md` (default), `lg` affecting padding and font-size.

#### Scenario: Small textarea
- **WHEN** `<ui-textarea size="sm">` is rendered
- **THEN** it SHALL use smaller padding and font-size

### Requirement: Textarea focus ring
The textarea wrapper SHALL display a visible focus ring on `:focus-within` using `--pos-color-action-primary`.

#### Scenario: Focus shows ring
- **WHEN** the textarea receives focus
- **THEN** a `2px solid` outline using `--pos-color-action-primary` SHALL appear

### Requirement: Textarea uses semantic tokens only
All colors SHALL reference `--pos-*` semantic tokens. Styling SHALL match `<ui-input>` visual patterns (border, radius, background).

#### Scenario: Visual consistency with input
- **WHEN** `<ui-textarea>` and `<ui-input>` are placed together
- **THEN** they SHALL share the same border, radius, and color styling
