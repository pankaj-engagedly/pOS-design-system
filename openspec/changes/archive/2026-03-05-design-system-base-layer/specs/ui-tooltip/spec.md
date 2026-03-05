## ADDED Requirements

### Requirement: Tooltip renders positioned hint text
`<ui-tooltip>` SHALL render hint text that appears when the trigger element is hovered or focused. The tooltip content is provided via a `text` attribute.

#### Scenario: Tooltip on hover
- **WHEN** the user hovers over `<ui-tooltip text="Save file"><ui-button>Save</ui-button></ui-tooltip>`
- **THEN** "Save file" SHALL appear near the button

#### Scenario: Tooltip on focus
- **WHEN** the trigger element receives keyboard focus
- **THEN** the tooltip text SHALL appear

#### Scenario: Tooltip hides on mouse leave
- **WHEN** the user moves the mouse away from the trigger
- **THEN** the tooltip SHALL disappear

### Requirement: Tooltip position attribute
`<ui-tooltip>` SHALL support a `position` attribute with values `top` (default), `bottom`, `left`, `right`.

#### Scenario: Bottom position
- **WHEN** `<ui-tooltip text="Help" position="bottom">` is rendered and triggered
- **THEN** the tooltip SHALL appear below the trigger element

### Requirement: Tooltip styling
The tooltip popup SHALL have a dark background (`--pos-color-text-primary`), light text (`--pos-color-background-primary`), small border radius (`--pos-radius-sm`), and `--pos-font-size-sm` text.

#### Scenario: Tooltip visual style
- **WHEN** the tooltip is visible
- **THEN** it SHALL display as a small dark pill with light text

### Requirement: Tooltip uses slot for trigger content
The trigger element is provided as the default slot content. `<ui-tooltip>` wraps it in an inline container and attaches hover/focus listeners.

#### Scenario: Any element as trigger
- **WHEN** `<ui-tooltip text="Info"><ui-icon><i class="fa-solid fa-info"></i></ui-icon></ui-tooltip>` is rendered
- **THEN** the icon SHALL act as the trigger for the tooltip

### Requirement: Tooltip accessibility
The tooltip popup SHALL have `role="tooltip"`. The trigger element SHALL have `aria-describedby` pointing to the tooltip's ID.

#### Scenario: Screen reader announces tooltip
- **WHEN** the trigger element is focused
- **THEN** the screen reader SHALL announce the tooltip text as a description
