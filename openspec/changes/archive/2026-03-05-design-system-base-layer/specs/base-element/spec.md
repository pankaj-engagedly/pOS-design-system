## MODIFIED Requirements

### Requirement: PosBaseElement attaches open-mode Shadow DOM
`PosBaseElement` SHALL extend `HTMLElement`, call `super()` in the constructor, and attach an open-mode Shadow DOM stored as `this.shadow`.

#### Scenario: Shadow DOM is attached
- **WHEN** a class extending `PosBaseElement` is instantiated
- **THEN** `this.shadow` SHALL be an open-mode ShadowRoot

### Requirement: adoptStyles method
`PosBaseElement` SHALL expose an `adoptStyles(css)` method that creates a `CSSStyleSheet`, calls `replaceSync(css)`, and assigns it to `this.shadow.adoptedStyleSheets`.

#### Scenario: Styles are adopted
- **WHEN** `adoptStyles(css)` is called
- **THEN** the Shadow DOM SHALL have the CSS applied via `adoptedStyleSheets`

### Requirement: Static stylesheet caching
`adoptStyles` SHALL cache the `CSSStyleSheet` per CSS string so that multiple instances of the same component share a single parsed stylesheet.

#### Scenario: Two instances share stylesheet
- **WHEN** two instances of the same component call `adoptStyles` with the same CSS string
- **THEN** both SHALL reference the same `CSSStyleSheet` object
