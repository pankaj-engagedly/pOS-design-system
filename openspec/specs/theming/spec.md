## ADDED Requirements

### Requirement: Dark theme token set
The system SHALL provide a `tokens/semantic/dark.json` file with the same structure as `base.json` but with inverted color mappings appropriate for dark backgrounds (e.g., background maps to dark neutrals, text maps to light neutrals).

#### Scenario: Dark theme file structure matches light
- **WHEN** `tokens/semantic/dark.json` is loaded
- **THEN** it SHALL contain the same key paths as `tokens/semantic/base.json`
- **AND** all values SHALL be valid references to raw tokens

### Requirement: Build script generates multi-theme output
The build script SHALL output both light and dark theme blocks in `dist/tokens/theme.css`. The light theme SHALL be scoped to `:root, [data-pos-theme="light"]`. The dark theme SHALL be scoped to `[data-pos-theme="dark"]`.

#### Scenario: Light theme output
- **WHEN** `build-tokens.js` runs
- **THEN** `dist/tokens/theme.css` SHALL contain a `:root, [data-pos-theme="light"]` block with all raw and semantic tokens

#### Scenario: Dark theme output
- **WHEN** `build-tokens.js` runs
- **THEN** `dist/tokens/theme.css` SHALL contain a `[data-pos-theme="dark"]` block that re-declares only semantic tokens with dark-appropriate values

#### Scenario: Raw tokens shared across themes
- **WHEN** the dark theme block is generated
- **THEN** it SHALL NOT redeclare raw tokens (they are theme-independent)
- **AND** it SHALL only redeclare semantic tokens that differ from light

### Requirement: Theme activation via data attribute
Themes SHALL be activated by setting `data-pos-theme` on any DOM element. The theme applies to that element and all descendants via CSS specificity.

#### Scenario: Activating dark theme
- **WHEN** `data-pos-theme="dark"` is set on `<html>` or `<body>`
- **THEN** all semantic token values within that subtree SHALL reflect dark theme mappings

#### Scenario: Nested theme override
- **WHEN** a parent has `data-pos-theme="dark"` and a child has `data-pos-theme="light"`
- **THEN** the child subtree SHALL use light theme values

### Requirement: Project-level theme override pattern
Projects SHALL be able to override any semantic token by declaring a `[data-pos-theme="project-name"]` CSS block after importing `theme.css`. No build step required.

#### Scenario: Project overrides action color
- **WHEN** a project declares `[data-pos-theme="my-app"] { --pos-color-action-primary: #E91E63; }`
- **AND** `data-pos-theme="my-app"` is set on a DOM element
- **THEN** `--pos-color-action-primary` SHALL resolve to `#E91E63` within that subtree
