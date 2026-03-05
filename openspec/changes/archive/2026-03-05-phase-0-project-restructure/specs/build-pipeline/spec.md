## MODIFIED Requirements

### Requirement: Build script
`npm run build` SHALL run `node tokens/build-tokens.js` then `node esbuild.config.js` to produce all outputs. This command SHALL be executed from within the `design-system/` directory. The esbuild config SHALL use `src/index.js` as entry point (relative to `design-system/`) and output to `dist/pos-design-system.js` (relative to `design-system/`).

#### Scenario: Full build from design-system directory
- **WHEN** `cd design-system && npm run build` is executed
- **THEN** `design-system/dist/tokens/theme.css` and `design-system/dist/pos-design-system.js` SHALL exist

#### Scenario: Build from root via Makefile
- **WHEN** `make build-ds` is executed from the repository root
- **THEN** it delegates to `cd design-system && npm run build`
- **AND** the same output files are produced

### Requirement: Barrel export
`src/index.js` SHALL import and register all 17 components (ui-button, ui-input, ui-badge, ui-tag, ui-spinner, ui-icon, ui-card, ui-divider, ui-dialog, ui-tooltip, ui-checkbox, ui-radio, ui-toggle, ui-select, ui-textarea, ui-alert, ui-progress) and export `loadPlugin` and `createHostSDK`. The file location moves from `src/index.js` to `design-system/src/index.js` but its content and relative imports remain unchanged.

#### Scenario: Single script loads everything
- **WHEN** `design-system/dist/pos-design-system.js` is loaded via `<script type="module">`
- **THEN** all 17 components SHALL be registered as custom elements
- **AND** `loadPlugin` and `createHostSDK` SHALL be available as named exports
