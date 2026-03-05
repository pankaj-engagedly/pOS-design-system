## ADDED Requirements

### Requirement: Safe define wrapper
`define(tagName, elementClass)` SHALL call `customElements.define()` only if the tag is not already registered.

#### Scenario: First registration
- **WHEN** `define('ui-button', UiButton)` is called and `ui-button` is not registered
- **THEN** the element SHALL be registered

#### Scenario: Duplicate registration ignored
- **WHEN** `define('ui-button', UiButton)` is called twice
- **THEN** no error SHALL be thrown
