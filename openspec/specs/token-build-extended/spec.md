## ADDED Requirements

### Requirement: Dynamic file discovery
The build script SHALL dynamically discover all `*.json` files in `tokens/raw/` and `tokens/semantic/` directories using filesystem scanning. The script SHALL NOT hardcode specific file names.

#### Scenario: New raw token file automatically included
- **WHEN** a new file `tokens/raw/newcategory.json` is added
- **THEN** running `npm run build:tokens` SHALL include its tokens in the output without any build script changes

#### Scenario: New semantic token file automatically included
- **WHEN** a new file `tokens/semantic/newcategory.json` is added
- **THEN** running `npm run build:tokens` SHALL include its tokens in the output without any build script changes

### Requirement: Unified raw token map
The build script SHALL merge all raw token files into a single flat lookup map before resolving semantic references. This allows semantic tokens in any file to reference raw tokens from any category.

#### Scenario: Cross-category reference resolution
- **WHEN** a semantic token in `tokens/semantic/elevation.json` references `{shadow.md}`
- **THEN** the build script SHALL resolve it against the unified raw map containing tokens from `tokens/raw/shadows.json`

#### Scenario: No duplicate raw keys
- **WHEN** two raw token files contain the same flattened key
- **THEN** the build script SHALL throw an error indicating the duplicate

### Requirement: Multi-type CSS output
The build script SHALL correctly output CSS custom properties for all token types, not just colors. Values SHALL be output in their native CSS format.

#### Scenario: Dimension tokens output
- **WHEN** a raw token has `$value: "16px"` and `$type: "dimension"`
- **THEN** the CSS output SHALL be `--pos-raw-spacing-4: 16px;`

#### Scenario: Number tokens output
- **WHEN** a raw token has `$value: 1.5` and `$type: "number"`
- **THEN** the CSS output SHALL be `--pos-raw-line-height-normal: 1.5;`

#### Scenario: FontWeight tokens output
- **WHEN** a raw token has `$value: 700` and `$type: "fontWeight"`
- **THEN** the CSS output SHALL be `--pos-raw-font-weight-bold: 700;`

#### Scenario: FontFamily tokens output
- **WHEN** a raw token has `$value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"` and `$type: "fontFamily"`
- **THEN** the CSS output SHALL be `--pos-raw-font-family-default: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;`

#### Scenario: Shadow tokens output
- **WHEN** a raw token has `$value: "0 1px 3px rgba(0,0,0,0.12)"` and `$type: "shadow"`
- **THEN** the CSS output SHALL be `--pos-raw-shadow-sm: 0 1px 3px rgba(0,0,0,0.12);`

### Requirement: Categorized CSS output with comments
The build script SHALL group CSS output by category with comment headers for readability. Raw tokens SHALL be grouped by their source file name. Semantic tokens SHALL be grouped by their source file name.

#### Scenario: Raw tokens grouped by category
- **WHEN** the build generates `dist/tokens/theme.css`
- **THEN** raw tokens from `colors.json` SHALL appear under a `/* Raw color tokens */` comment, tokens from `spacing.json` under `/* Raw spacing tokens */`, etc.

#### Scenario: Semantic tokens grouped by category
- **WHEN** the build generates `dist/tokens/theme.css`
- **THEN** semantic tokens from `base.json` SHALL appear under a `/* Semantic color tokens */` comment (or derived from filename), tokens from `spacing.json` under `/* Semantic spacing tokens */`, etc.

### Requirement: Semantic reference and direct value support
The build script SHALL support two forms of semantic `$value`:
1. **Reference**: A string matching `{...}` pattern SHALL be resolved to `var(--pos-raw-<key>)` using the unified raw token map.
2. **Direct value**: Any other string or number SHALL be output as-is in the CSS.

#### Scenario: Reference value resolved
- **WHEN** a semantic token has `$value: "{color.blue.600}"`
- **THEN** the output SHALL be `var(--pos-raw-color-blue-600)`

#### Scenario: Direct string value passed through
- **WHEN** a semantic token has `$value: "0 2px 8px rgba(0,0,0,0.15)"`
- **THEN** the output SHALL be `0 2px 8px rgba(0,0,0,0.15)` (no var wrapping)

#### Scenario: Direct number value passed through
- **WHEN** a semantic token has `$value: 1.5`
- **THEN** the output SHALL be `1.5` (no var wrapping)

#### Scenario: Invalid reference throws error
- **WHEN** a semantic token has `$value: "{nonexistent.token}"`
- **THEN** the build script SHALL throw an error with a descriptive message

### Requirement: Output file format preserved
The build script SHALL continue to output a single `dist/tokens/theme.css` file. All tokens SHALL be scoped under `:root, [data-pos-theme="light"]`. The raw token CSS variable prefix SHALL remain `--pos-raw-`. The semantic token CSS variable prefix SHALL remain `--pos-`.

#### Scenario: Output structure
- **WHEN** the build completes
- **THEN** `dist/tokens/theme.css` SHALL contain a single rule block with selector `:root, [data-pos-theme="light"]` containing all raw and semantic CSS custom properties

#### Scenario: Raw variable naming
- **WHEN** a raw token at path `spacing.4` is processed
- **THEN** the CSS variable name SHALL be `--pos-raw-spacing-4`

#### Scenario: Semantic variable naming
- **WHEN** a semantic token at path `pos.space.md` is processed
- **THEN** the CSS variable name SHALL be `--pos-space-md`
