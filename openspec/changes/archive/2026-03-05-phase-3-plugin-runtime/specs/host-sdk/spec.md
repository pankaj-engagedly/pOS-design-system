## ADDED Requirements

### Requirement: SDK emit function
`sdk.emit(eventName, payload)` SHALL dispatch a CustomEvent with `{ bubbles: true, composed: true, detail: payload }` from the plugin element.

#### Scenario: Plugin emits event
- **WHEN** `sdk.emit('plugin:action', { data: 'test' })` is called
- **THEN** a CustomEvent SHALL be dispatched from the plugin element, observable on ancestors

### Requirement: SDK getToken function
`sdk.getToken(name)` SHALL return the computed CSS value of the given custom property from the document.

#### Scenario: Read accent color
- **WHEN** `sdk.getToken('--pos-color-accent')` is called
- **THEN** it SHALL return the resolved CSS value (e.g., a hex or rgb string)

### Requirement: SDK is a plain object
The SDK SHALL be a plain object with `emit` and `getToken` functions. No classes, no prototype chain, no framework.

#### Scenario: Plain object
- **WHEN** the SDK is inspected
- **THEN** it SHALL have exactly `emit` and `getToken` as own properties (functions)

### Requirement: SDK is created per plugin element
Each plugin element instance SHALL receive its own SDK bound to that element (so `emit` dispatches from the correct element).

#### Scenario: Scoped emission
- **WHEN** two plugin elements exist and one calls `sdk.emit()`
- **THEN** the event SHALL originate from that specific element, not the other
