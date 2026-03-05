## ADDED Requirements

### Requirement: Test runner executes in real browser
Tests SHALL run in a real Chromium browser via @web/test-runner, not a simulated DOM.

#### Scenario: Running tests
- **WHEN** `npm test` is executed
- **THEN** @web/test-runner SHALL launch, discover `test/**/*.test.js`, and report pass/fail results

### Requirement: Each component has a dedicated test file
Every component in `src/components/` SHALL have a corresponding `test/<component-name>.test.js` file.

#### Scenario: Test file coverage
- **WHEN** the test directory is listed
- **THEN** there SHALL be a test file for each of the 17 components

### Requirement: Tests cover rendering
Each component test SHALL verify that the component creates a Shadow DOM with the expected internal structure.

#### Scenario: Shadow DOM created
- **WHEN** a component is instantiated via `fixture(html\`<ui-button>Text</ui-button>\`)`
- **THEN** `element.shadowRoot` SHALL NOT be null
- **AND** the expected internal elements SHALL be present

### Requirement: Tests cover attribute reflection
Each component test SHALL verify that setting attributes updates the rendered output.

#### Scenario: Attribute changes rendering
- **WHEN** an attribute is set (e.g., `variant="danger"`)
- **THEN** the internal element SHALL reflect that attribute in its data attributes or visual state

### Requirement: Tests cover properties
Components with getter/setter properties (value, checked) SHALL have tests verifying property access.

#### Scenario: Property getter
- **WHEN** a user interacts with a form component
- **THEN** the property getter SHALL return the current state

### Requirement: Tests cover events
Each interactive component SHALL have tests verifying correct event dispatching.

#### Scenario: Event fires on interaction
- **WHEN** a checkbox is clicked
- **THEN** a `change` event SHALL fire with `target.checked` reflecting the new state

### Requirement: Tests cover accessibility
Components with ARIA attributes SHALL have tests verifying correct roles and properties.

#### Scenario: ARIA attributes present
- **WHEN** `<ui-progress value="50">` is rendered
- **THEN** it SHALL have `role="progressbar"` and `aria-valuenow="50"`
