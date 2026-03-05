## ADDED Requirements

### Requirement: Token build script
`tokens/build-tokens.js` SHALL read `tokens/raw/colors.json` and `tokens/semantic/base.json`, resolve references, and output `dist/tokens/theme.css`.

#### Scenario: CSS generation
- **WHEN** `node tokens/build-tokens.js` is executed
- **THEN** `dist/tokens/theme.css` SHALL be generated with all `--pos-raw-*` and `--pos-color-*` CSS custom properties scoped to `:root, [data-pos-theme="light"]`

#### Scenario: Semantic references resolve to raw vars
- **WHEN** the generated CSS is inspected
- **THEN** `--pos-color-accent` SHALL reference `var(--pos-raw-color-blue-600)` (or equivalent), not a hardcoded hex

### Requirement: Auto-create dist directory
The build script SHALL create `dist/tokens/` if it does not exist.

#### Scenario: First-time build
- **WHEN** `node tokens/build-tokens.js` runs with no `dist/` directory
- **THEN** it SHALL create `dist/tokens/` and write `theme.css` without error
