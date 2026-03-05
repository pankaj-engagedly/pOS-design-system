## ADDED Requirements

### Requirement: PosBaseElement class
`PosBaseElement` SHALL extend `HTMLElement`, attach an open-mode Shadow DOM in the constructor, and expose an `adoptStyles(css)` method.

#### Scenario: Shadow DOM initialization
- **WHEN** a class extending `PosBaseElement` is instantiated
- **THEN** the element SHALL have `shadowRoot` with `mode: "open"`

### Requirement: adoptStyles method
`adoptStyles(css)` SHALL create a `CSSStyleSheet`, call `replaceSync(css)`, and assign it to `shadowRoot.adoptedStyleSheets`.

#### Scenario: Style adoption
- **WHEN** `this.adoptStyles(cssString)` is called
- **THEN** the Shadow DOM SHALL have the stylesheet applied

### Requirement: No event helper
`PosBaseElement` SHALL NOT include an `emit()` helper. Components rely on native DOM events. If a component needs a custom event, it creates one directly.

#### Scenario: No emit method
- **WHEN** `PosBaseElement` is inspected
- **THEN** it SHALL NOT have an `emit` method
