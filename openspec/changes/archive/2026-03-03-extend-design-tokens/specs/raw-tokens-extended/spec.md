## ADDED Requirements

### Requirement: Raw color palette expansion
The system SHALL provide raw color tokens for yellow, orange, and purple hues in addition to the existing neutral, blue, red, and green palettes. Each new hue SHALL include at least steps 500, 600, and 700. All color tokens SHALL use `$type: "color"` and hex `#rrggbb` format.

#### Scenario: Yellow color tokens exist
- **WHEN** the build processes `tokens/raw/colors.json`
- **THEN** raw CSS variables `--pos-raw-color-yellow-500`, `--pos-raw-color-yellow-600`, and `--pos-raw-color-yellow-700` SHALL be present in the output

#### Scenario: Orange color tokens exist
- **WHEN** the build processes `tokens/raw/colors.json`
- **THEN** raw CSS variables `--pos-raw-color-orange-500`, `--pos-raw-color-orange-600`, and `--pos-raw-color-orange-700` SHALL be present in the output

#### Scenario: Purple color tokens exist
- **WHEN** the build processes `tokens/raw/colors.json`
- **THEN** raw CSS variables `--pos-raw-color-purple-500`, `--pos-raw-color-purple-600`, and `--pos-raw-color-purple-700` SHALL be present in the output

#### Scenario: Existing color tokens preserved
- **WHEN** the build processes `tokens/raw/colors.json`
- **THEN** all existing neutral, blue, red, and green raw color tokens SHALL remain present with unchanged values

### Requirement: Raw spacing tokens
The system SHALL provide raw spacing tokens in `tokens/raw/spacing.json` following a 4px base scale. Each token SHALL use `$type: "dimension"` and pixel string values. The scale SHALL include: 0 (0px), 1 (4px), 2 (8px), 3 (12px), 4 (16px), 5 (20px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px).

#### Scenario: Spacing tokens generated
- **WHEN** the build processes `tokens/raw/spacing.json`
- **THEN** CSS variables `--pos-raw-spacing-0` through `--pos-raw-spacing-16` SHALL be present with correct pixel values

#### Scenario: Spacing token format
- **WHEN** a spacing token has `$value: "16px"` and `$type: "dimension"`
- **THEN** the generated CSS variable SHALL output the value `16px`

### Requirement: Raw typography tokens
The system SHALL provide raw typography tokens in `tokens/raw/typography.json` covering font families, font sizes, font weights, and line heights.

Font families SHALL include `default` (system sans-serif stack) and `mono` (system monospace stack), using `$type: "fontFamily"`.

Font sizes SHALL follow a named scale: xs (12px), sm (14px), md (16px), lg (18px), xl (20px), 2xl (24px), 3xl (30px), 4xl (36px), using `$type: "dimension"`.

Font weights SHALL include: light (300), regular (400), medium (500), semibold (600), bold (700), using `$type: "fontWeight"`.

Line heights SHALL include: tight (1.25), normal (1.5), loose (1.75), using `$type: "number"`.

#### Scenario: Font family tokens generated
- **WHEN** the build processes `tokens/raw/typography.json`
- **THEN** CSS variables `--pos-raw-font-family-default` and `--pos-raw-font-family-mono` SHALL be present with system font stack values

#### Scenario: Font size scale generated
- **WHEN** the build processes `tokens/raw/typography.json`
- **THEN** CSS variables `--pos-raw-font-size-xs` (12px) through `--pos-raw-font-size-4xl` (36px) SHALL be present

#### Scenario: Font weight tokens generated
- **WHEN** the build processes `tokens/raw/typography.json`
- **THEN** CSS variables `--pos-raw-font-weight-light` (300) through `--pos-raw-font-weight-bold` (700) SHALL be present

#### Scenario: Line height tokens generated
- **WHEN** the build processes `tokens/raw/typography.json`
- **THEN** CSS variables `--pos-raw-line-height-tight` (1.25), `--pos-raw-line-height-normal` (1.5), and `--pos-raw-line-height-loose` (1.75) SHALL be present

### Requirement: Raw border radius tokens
The system SHALL provide raw border radius tokens in `tokens/raw/radius.json` using `$type: "dimension"`. The scale SHALL include: none (0px), sm (4px), md (8px), lg (12px), xl (16px), full (9999px).

#### Scenario: Radius tokens generated
- **WHEN** the build processes `tokens/raw/radius.json`
- **THEN** CSS variables `--pos-raw-radius-none` (0px) through `--pos-raw-radius-full` (9999px) SHALL be present

### Requirement: Raw shadow tokens
The system SHALL provide raw shadow tokens in `tokens/raw/shadows.json` using `$type: "shadow"`. The scale SHALL include sm, md, and lg elevation levels with CSS box-shadow string values.

#### Scenario: Shadow tokens generated
- **WHEN** the build processes `tokens/raw/shadows.json`
- **THEN** CSS variables `--pos-raw-shadow-sm`, `--pos-raw-shadow-md`, and `--pos-raw-shadow-lg` SHALL be present with valid CSS box-shadow values

### Requirement: Raw sizing tokens
The system SHALL provide raw sizing tokens in `tokens/raw/sizing.json` using `$type: "dimension"`. The scale SHALL include: 4 (16px), 6 (24px), 8 (32px), 10 (40px), 12 (48px), 16 (64px).

#### Scenario: Sizing tokens generated
- **WHEN** the build processes `tokens/raw/sizing.json`
- **THEN** CSS variables `--pos-raw-size-4` (16px) through `--pos-raw-size-16` (64px) SHALL be present

### Requirement: Raw opacity tokens
The system SHALL provide raw opacity tokens in `tokens/raw/opacity.json` using `$type: "number"`. The scale SHALL include: 0 (0), 25 (0.25), 50 (0.5), 75 (0.75), 100 (1).

#### Scenario: Opacity tokens generated
- **WHEN** the build processes `tokens/raw/opacity.json`
- **THEN** CSS variables `--pos-raw-opacity-0` (0) through `--pos-raw-opacity-100` (1) SHALL be present

### Requirement: Raw z-index tokens
The system SHALL provide raw z-index tokens in `tokens/raw/z-index.json` using `$type: "number"`. The scale SHALL include: base (0), raised (100), overlay (400), top (700).

#### Scenario: Z-index tokens generated
- **WHEN** the build processes `tokens/raw/z-index.json`
- **THEN** CSS variables `--pos-raw-z-base` (0), `--pos-raw-z-raised` (100), `--pos-raw-z-overlay` (400), and `--pos-raw-z-top` (700) SHALL be present

### Requirement: DTCG-compliant token format
All raw token files SHALL use the DTCG (Design Tokens Community Group) format with `$value` for the token value and `$type` for the token type. Each token entry MUST include both `$value` and `$type` fields.

#### Scenario: Token entry structure
- **WHEN** any raw token JSON file is read
- **THEN** every leaf token object SHALL contain a `$value` field and a `$type` field

### Requirement: One file per token category
Each token category SHALL be stored in its own JSON file under `tokens/raw/`. The file name SHALL match the category name in kebab-case (e.g., `spacing.json`, `z-index.json`).

#### Scenario: File organization
- **WHEN** a developer looks for spacing tokens
- **THEN** they SHALL find them in `tokens/raw/spacing.json` and nowhere else
