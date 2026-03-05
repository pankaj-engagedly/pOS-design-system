## ADDED Requirements

### Requirement: Category+Role color naming convention
The system SHALL use Category+Role naming for all semantic color tokens. Colors SHALL be organized into subcategories: `background`, `text`, `border`, `action`, and `feedback`. Each subcategory SHALL have role variants (e.g., `primary`, `secondary`, `default`).

#### Scenario: Background color tokens
- **WHEN** the build processes semantic color tokens
- **THEN** the following CSS variables SHALL be present:
  - `--pos-color-background-primary` referencing `{color.neutral.0}`
  - `--pos-color-background-secondary` referencing `{color.neutral.100}`

#### Scenario: Text color tokens
- **WHEN** the build processes semantic color tokens
- **THEN** the following CSS variables SHALL be present:
  - `--pos-color-text-primary` referencing `{color.neutral.900}`
  - `--pos-color-text-secondary` referencing `{color.neutral.600}`
  - `--pos-color-text-disabled` referencing `{color.neutral.400}`

#### Scenario: Border color tokens
- **WHEN** the build processes semantic color tokens
- **THEN** the following CSS variables SHALL be present:
  - `--pos-color-border-default` referencing `{color.neutral.400}`
  - `--pos-color-border-strong` referencing `{color.neutral.600}`

#### Scenario: Action color tokens
- **WHEN** the build processes semantic color tokens
- **THEN** the following CSS variables SHALL be present:
  - `--pos-color-action-primary` referencing `{color.blue.600}`
  - `--pos-color-action-primary-hover` referencing `{color.blue.700}`
  - `--pos-color-action-focus` referencing `{color.blue.500}`

#### Scenario: Feedback color tokens
- **WHEN** the build processes semantic color tokens
- **THEN** the following CSS variables SHALL be present:
  - `--pos-color-feedback-error` referencing `{color.red.600}`
  - `--pos-color-feedback-success` referencing `{color.green.600}`
  - `--pos-color-feedback-warning` referencing `{color.yellow.600}`

### Requirement: Old semantic color tokens removed
The system SHALL NOT output the old flat-named semantic color tokens. The following CSS variables SHALL be removed: `--pos-color-bg`, `--pos-color-fg`, `--pos-color-muted`, `--pos-color-border`, `--pos-color-accent`, `--pos-color-accent-hover`, `--pos-color-danger`, `--pos-color-success`, `--pos-color-focus`.

#### Scenario: Old token names absent
- **WHEN** the build generates `dist/tokens/theme.css`
- **THEN** none of the old semantic color variable names (`--pos-color-bg`, `--pos-color-fg`, etc.) SHALL appear in the output

### Requirement: Semantic spacing tokens
The system SHALL provide semantic spacing tokens in `tokens/semantic/spacing.json` using a t-shirt size scale. Each token SHALL reference a raw spacing token. The scale SHALL include: xs (spacing.1 / 4px), sm (spacing.2 / 8px), md (spacing.4 / 16px), lg (spacing.6 / 24px), xl (spacing.8 / 32px), 2xl (spacing.12 / 48px).

#### Scenario: Spacing semantic tokens generated
- **WHEN** the build processes `tokens/semantic/spacing.json`
- **THEN** CSS variables `--pos-space-xs` through `--pos-space-2xl` SHALL be present, each referencing the corresponding raw spacing token via `var()`

#### Scenario: Spacing token references resolve
- **WHEN** `--pos-space-md` is used in CSS
- **THEN** it SHALL resolve to `var(--pos-raw-spacing-4)` which equals `16px`

### Requirement: Semantic typography tokens
The system SHALL provide semantic typography tokens in `tokens/semantic/typography.json` covering font families, font sizes, font weights, and line heights. Each token SHALL reference a raw typography token.

#### Scenario: Font family semantic tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-font-family-default` and `--pos-font-family-mono` SHALL be present, each referencing the corresponding raw font family token

#### Scenario: Font size semantic tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-font-size-sm`, `--pos-font-size-md`, and `--pos-font-size-lg` SHALL be present, each referencing the corresponding raw font size token

#### Scenario: Font weight semantic tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-font-weight-regular`, `--pos-font-weight-medium`, and `--pos-font-weight-bold` SHALL be present, each referencing the corresponding raw font weight token

#### Scenario: Line height semantic tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-line-height-tight` and `--pos-line-height-normal` SHALL be present, each referencing the corresponding raw line height token

### Requirement: Semantic text role tokens
The system SHALL provide semantic text role tokens in `tokens/semantic/typography.json` under the `pos.text` namespace. Each role SHALL define size, weight, and leading (line-height) properties referencing raw typography tokens. Roles SHALL describe typographic purpose, NOT specific components.

The roles SHALL include: heading, body, caption, label.

#### Scenario: Heading text role tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-text-heading-size` (referencing `{font.size.2xl}`), `--pos-text-heading-weight` (referencing `{font.weight.bold}`), and `--pos-text-heading-leading` (referencing `{line-height.tight}`) SHALL be present

#### Scenario: Body text role tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-text-body-size` (referencing `{font.size.md}`), `--pos-text-body-weight` (referencing `{font.weight.regular}`), and `--pos-text-body-leading` (referencing `{line-height.normal}`) SHALL be present

#### Scenario: Caption text role tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-text-caption-size` (referencing `{font.size.xs}`), `--pos-text-caption-weight` (referencing `{font.weight.regular}`), and `--pos-text-caption-leading` (referencing `{line-height.normal}`) SHALL be present

#### Scenario: Label text role tokens
- **WHEN** the build processes `tokens/semantic/typography.json`
- **THEN** CSS variables `--pos-text-label-size` (referencing `{font.size.sm}`), `--pos-text-label-weight` (referencing `{font.weight.medium}`), and `--pos-text-label-leading` (referencing `{line-height.tight}`) SHALL be present

### Requirement: Semantic border radius tokens
The system SHALL provide semantic border radius tokens in `tokens/semantic/borders.json` using a generic size scale. Tokens SHALL describe radius purpose, NOT specific components. Each token SHALL reference a raw radius token.

The scale SHALL include: sm, md, lg, full.

#### Scenario: Radius semantic tokens generated
- **WHEN** the build processes `tokens/semantic/borders.json`
- **THEN** CSS variables `--pos-radius-sm`, `--pos-radius-md`, `--pos-radius-lg`, and `--pos-radius-full` SHALL be present

#### Scenario: No component-specific radius tokens
- **WHEN** the build generates semantic radius tokens
- **THEN** no tokens named after specific components (e.g., `--pos-radius-button`, `--pos-radius-input`, `--pos-radius-card`) SHALL exist

### Requirement: Semantic elevation tokens
The system SHALL provide semantic elevation (shadow) tokens in `tokens/semantic/elevation.json` using a generic size scale. Tokens SHALL describe elevation level, NOT specific components. Each token SHALL reference a raw shadow token.

The scale SHALL include: sm, md, lg.

#### Scenario: Shadow semantic tokens generated
- **WHEN** the build processes `tokens/semantic/elevation.json`
- **THEN** CSS variables `--pos-shadow-sm`, `--pos-shadow-md`, and `--pos-shadow-lg` SHALL be present

#### Scenario: No component-specific shadow tokens
- **WHEN** the build generates semantic shadow tokens
- **THEN** no tokens named after specific components (e.g., `--pos-shadow-card`, `--pos-shadow-dropdown`) SHALL exist

### Requirement: Semantic z-index tokens
The system SHALL provide semantic z-index tokens in `tokens/semantic/z-index.json` using purpose-based naming. Tokens SHALL describe stacking intent, NOT specific components. Each token SHALL reference a raw z-index token.

The scale SHALL include: base, raised, overlay, top.

#### Scenario: Z-index semantic tokens generated
- **WHEN** the build processes `tokens/semantic/z-index.json`
- **THEN** CSS variables `--pos-z-base`, `--pos-z-raised`, `--pos-z-overlay`, and `--pos-z-top` SHALL be present

#### Scenario: No component-specific z-index tokens
- **WHEN** the build generates semantic z-index tokens
- **THEN** no tokens named after specific components (e.g., `--pos-z-dropdown`, `--pos-z-modal`, `--pos-z-toast`) SHALL exist

### Requirement: Semantic tokens reference raw tokens or use direct values
Each semantic token `$value` SHALL be either a reference to a raw token using the `{category.key}` syntax, or a direct CSS value. References SHALL resolve to `var(--pos-raw-*)` in the output. Direct values SHALL be output as-is.

#### Scenario: Reference value resolution
- **WHEN** a semantic token has `$value: "{spacing.4}"`
- **THEN** the generated CSS variable SHALL output `var(--pos-raw-spacing-4)`

#### Scenario: Direct value passthrough
- **WHEN** a semantic token has `$value: "0 1px 3px rgba(0,0,0,0.12)"`
- **THEN** the generated CSS variable SHALL output the value as-is without `var()` wrapping

### Requirement: One semantic file per category
Each semantic token category SHALL be stored in its own JSON file under `tokens/semantic/`. The existing `base.json` SHALL be updated to contain only color semantic tokens with the new Category+Role naming.

#### Scenario: Semantic file organization
- **WHEN** a developer looks for semantic spacing tokens
- **THEN** they SHALL find them in `tokens/semantic/spacing.json` and nowhere else

#### Scenario: base.json contains only colors
- **WHEN** a developer opens `tokens/semantic/base.json`
- **THEN** it SHALL contain only color semantic tokens using the Category+Role naming convention
