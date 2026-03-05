## ADDED Requirements

### Requirement: Token cascading validation
The page SHALL render `ui-button` and `ui-input` components that visibly use `--pos-color-*` tokens.

#### Scenario: Components use theme tokens
- **WHEN** the page is loaded with `theme.css`
- **THEN** `ui-button` SHALL render with the accent color from the theme and `ui-input` SHALL render with the border color from the theme

### Requirement: Tenant theming validation
The page SHALL include a section with `data-pos-theme="tenant-acme"` that overrides `--pos-color-accent` to a different color.

#### Scenario: Tenant override visible
- **WHEN** the page is viewed
- **THEN** components inside the tenant section SHALL render with the overridden accent color, visibly different from the default section

### Requirement: Event bubbling validation
The page SHALL include an event log area that captures and displays native events bubbling from components.

#### Scenario: Button click logged
- **WHEN** a `ui-button` is clicked
- **THEN** the event log SHALL show the `click` event with the target element

#### Scenario: Input events logged
- **WHEN** text is typed in a `ui-input`
- **THEN** the event log SHALL show `input` events

### Requirement: Plugin loading validation
The page SHALL load the example plugin via `loadPlugin()` and render it on the page.

#### Scenario: Plugin renders
- **WHEN** the page loads
- **THEN** the example plugin SHALL be visible, styled using `--pos-*` tokens from the host theme

#### Scenario: Plugin event logged
- **WHEN** the plugin emits an event via `sdk.emit()`
- **THEN** the event log SHALL capture and display it
