## ADDED Requirements

### Requirement: CSS reset
`dist/base.css` SHALL include a minimal CSS reset that applies:
- `box-sizing: border-box` on all elements (via `*, *::before, *::after`)
- Margin reset on `body`, `h1`–`h6`, `p`, `ul`, `ol`
- `line-height` set from `--pos-line-height-normal` on `body`

#### Scenario: Box-sizing applied globally
- **WHEN** `base.css` is imported
- **THEN** all elements SHALL use `border-box` box model

#### Scenario: Margin reset on typography elements
- **WHEN** `base.css` is imported
- **THEN** `body`, `h1`–`h6`, `p` SHALL have `margin: 0`

### Requirement: Base typography
`base.css` SHALL set default typography on `body` using token values:
- `font-family` from `--pos-font-family-default`
- `font-size` from `--pos-font-size-md`
- `color` from `--pos-color-text-primary`
- `background-color` from `--pos-color-background-primary`

#### Scenario: Body uses token-driven typography
- **WHEN** `base.css` is imported and a theme is active
- **THEN** the body element SHALL use the font family, size, color, and background defined by semantic tokens

### Requirement: Link styling
`base.css` SHALL style `<a>` elements with `color` from `--pos-color-action-primary` and underline on hover.

#### Scenario: Links use action color
- **WHEN** an `<a>` element is rendered
- **THEN** its color SHALL match `--pos-color-action-primary`
- **AND** it SHALL show underline on `:hover`

### Requirement: Focus ring
`base.css` SHALL apply a visible focus ring on `:focus-visible` elements using `--pos-color-action-primary` with `2px` outline and `2px` offset.

#### Scenario: Focus ring on interactive elements
- **WHEN** an interactive element receives focus via keyboard
- **THEN** it SHALL display a `2px solid` outline using `--pos-color-action-primary`
- **AND** the outline offset SHALL be `2px`

### Requirement: base.css imports theme.css
`base.css` SHALL import `theme.css` so that consumers only need a single import to get both tokens and base styles.

#### Scenario: Single import setup
- **WHEN** a project imports only `dist/base.css`
- **THEN** all token CSS custom properties SHALL be available
- **AND** base styles SHALL be applied

### Requirement: Typography utility classes
`base.css` SHALL include utility classes for standard text styles. Each class SHALL set `font-family`, `font-size`, `font-weight`, and `line-height` from semantic tokens.

Classes:
- `.pos-heading` — heading text style
- `.pos-body` — body text style (default reading text)
- `.pos-caption` — small caption/helper text
- `.pos-label` — label text (form labels, UI labels)

#### Scenario: Heading class applies heading tokens
- **WHEN** `.pos-heading` is applied to an element
- **THEN** the element SHALL use `--pos-text-heading-size`, `--pos-text-heading-weight`, `--pos-text-heading-leading`, and `--pos-font-family-default`

#### Scenario: Body class applies body tokens
- **WHEN** `.pos-body` is applied to an element
- **THEN** the element SHALL use `--pos-text-body-size`, `--pos-text-body-weight`, `--pos-text-body-leading`

#### Scenario: Caption class applies caption tokens
- **WHEN** `.pos-caption` is applied to an element
- **THEN** the element SHALL use `--pos-text-caption-size`, `--pos-text-caption-weight`, `--pos-text-caption-leading`

#### Scenario: Label class applies label tokens
- **WHEN** `.pos-label` is applied to an element
- **THEN** the element SHALL use `--pos-text-label-size`, `--pos-text-label-weight`, `--pos-text-label-leading`

### Requirement: Text color utility classes
`base.css` SHALL include text color utilities:
- `.pos-text-primary` — `--pos-color-text-primary`
- `.pos-text-secondary` — `--pos-color-text-secondary`
- `.pos-text-disabled` — `--pos-color-text-disabled`

#### Scenario: Secondary text color
- **WHEN** `.pos-text-secondary` is applied to an element
- **THEN** the element's `color` SHALL be `--pos-color-text-secondary`
