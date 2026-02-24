## ADDED Requirements

### Requirement: Build script
`npm run build` SHALL run `node tokens/build-tokens.js` then `node esbuild.config.js` to produce all outputs.

#### Scenario: Full build
- **WHEN** `npm run build` is executed
- **THEN** `dist/tokens/theme.css` and `dist/pos-design-system.js` SHALL exist

### Requirement: Barrel export
`src/index.js` SHALL import and register `ui-button` and `ui-input`, and export `loadPlugin` and `createHostSDK`.

#### Scenario: Single script loads everything
- **WHEN** `dist/pos-design-system.js` is loaded via `<script type="module">`
- **THEN** `ui-button` and `ui-input` SHALL be registered as custom elements
