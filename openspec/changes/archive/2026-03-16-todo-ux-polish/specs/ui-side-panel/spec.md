## MODIFIED Requirements

### Requirement: Side panel collapsible behavior
`<ui-side-panel>` SHALL support a `collapsible` boolean attribute. When collapsible, a toggle button SHALL appear that collapses the panel to a narrow strip showing only icons.

#### Scenario: Collapsible panel expanded
- **WHEN** `<ui-side-panel collapsible>` is rendered and not collapsed
- **THEN** the panel SHALL display at its full width with all content visible
- **AND** a collapse toggle button SHALL be visible

#### Scenario: Collapsible panel collapsed
- **WHEN** the user clicks the collapse toggle
- **THEN** the panel SHALL shrink to a narrow width (e.g., 48px)
- **AND** only slotted icons SHALL remain visible
- **AND** text content SHALL be hidden via CSS overflow

#### Scenario: Non-collapsible panel
- **WHEN** `<ui-side-panel>` is rendered without `collapsible` attribute
- **THEN** no toggle button SHALL appear
- **AND** the panel SHALL behave as before
