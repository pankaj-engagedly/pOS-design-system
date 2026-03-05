## ADDED Requirements

### Requirement: Minimal semantic token set
The system SHALL define exactly 9 semantic color tokens mapping to raw color references:

- `--pos-color-bg` — page/component background
- `--pos-color-fg` — primary text
- `--pos-color-muted` — secondary/muted text
- `--pos-color-border` — borders and dividers
- `--pos-color-accent` — primary action color
- `--pos-color-accent-hover` — hover state of accent
- `--pos-color-danger` — error/destructive actions
- `--pos-color-success` — success states
- `--pos-color-focus` — focus ring indicator

#### Scenario: All 9 tokens present
- **WHEN** `tokens/semantic/base.json` is read
- **THEN** it SHALL contain exactly the 9 semantic keys listed above, each referencing a raw color token

### Requirement: Tenant theming override
Semantic tokens SHALL be scoped to `:root, [data-pos-theme="light"]`. Tenants SHALL be able to override by defining `[data-pos-theme="tenant-name"]` with different values.

#### Scenario: Tenant override cascades through Shadow DOM
- **WHEN** a DOM subtree has `data-pos-theme="tenant-acme"` overriding `--pos-color-accent`
- **THEN** all pOS components inside that subtree SHALL use the overridden value

### Requirement: No dark theme in v0
Only a single base (light) theme SHALL be generated. Dark theme is deferred.

#### Scenario: Single theme file
- **WHEN** the token build runs
- **THEN** only `dist/tokens/theme.css` SHALL be generated (no dark variant)
