## ADDED Requirements

### Requirement: Card renders as a visual container
`<ui-card>` SHALL render as a block-level container with `--pos-color-background-primary` background, `--pos-radius-md` border radius, `--pos-shadow-sm` box shadow, and a `1px` border using `--pos-color-border-default`.

#### Scenario: Default card rendering
- **WHEN** `<ui-card>Content here</ui-card>` is rendered
- **THEN** it SHALL display a bordered, rounded, shadowed container with the content inside

### Requirement: Card named slots
`<ui-card>` SHALL support three named slots:
- `header` — rendered at the top with bottom border separator
- default (unnamed) — the body content area with padding
- `footer` — rendered at the bottom with top border separator

All slots are optional. If a slot has no content, its section (including separator border) SHALL NOT render.

#### Scenario: Card with header and body
- **WHEN** `<ui-card><span slot="header">Title</span>Body content</ui-card>` is rendered
- **THEN** "Title" SHALL appear in the header area with a bottom border
- **AND** "Body content" SHALL appear in the padded body area

#### Scenario: Card with body only
- **WHEN** `<ui-card>Just content</ui-card>` is rendered
- **THEN** only the body area SHALL render with padding
- **AND** no header or footer borders SHALL be visible

#### Scenario: Card with all three slots
- **WHEN** header, default, and footer slots all have content
- **THEN** they SHALL render top-to-bottom with border separators between sections

### Requirement: Card does not impose internal layout
`<ui-card>` SHALL NOT set `display: flex`, `display: grid`, or any layout direction on the body slot content. Layout within the card is the consumer's responsibility.

#### Scenario: Consumer controls body layout
- **WHEN** the consumer places flex or grid layout inside the card body
- **THEN** the card SHALL not interfere with or override that layout

### Requirement: Card padding variant
`<ui-card>` SHALL support a `padding` attribute with values `none`, `sm`, `md` (default), `lg` to control body padding.

#### Scenario: No padding
- **WHEN** `<ui-card padding="none">` is rendered
- **THEN** the body area SHALL have no padding (useful for full-bleed images or custom layouts)

#### Scenario: Large padding
- **WHEN** `<ui-card padding="lg">` is rendered
- **THEN** the body area SHALL use `--pos-space-lg` padding
