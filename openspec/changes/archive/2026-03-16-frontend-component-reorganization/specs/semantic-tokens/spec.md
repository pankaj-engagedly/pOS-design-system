## MODIFIED Requirements

### Requirement: Minimal semantic token set
The system SHALL define semantic color tokens mapping to raw color references. In addition to the existing 9 tokens, the set SHALL include 4 priority color tokens:

- `--pos-color-bg` — page/component background
- `--pos-color-fg` — primary text
- `--pos-color-muted` — secondary/muted text
- `--pos-color-border` — borders and dividers
- `--pos-color-accent` — primary action color
- `--pos-color-accent-hover` — hover state of accent
- `--pos-color-danger` — error/destructive actions
- `--pos-color-success` — success states
- `--pos-color-focus` — focus ring indicator
- `--pos-color-priority-low` — low priority indicator (blue)
- `--pos-color-priority-medium` — medium priority indicator (yellow)
- `--pos-color-priority-high` — high priority indicator (orange)
- `--pos-color-priority-urgent` — urgent priority indicator (red)

#### Scenario: All tokens present
- **WHEN** `tokens/semantic/base.json` is read
- **THEN** it SHALL contain all 13 semantic color keys listed above, each referencing a raw color token
