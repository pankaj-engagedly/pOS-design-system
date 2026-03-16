## ADDED Requirements

### Requirement: Priority color semantic tokens
The semantic token set SHALL include four priority color tokens for task/item priority levels:
- `--pos-color-priority-low` — mapped to blue raw token
- `--pos-color-priority-medium` — mapped to yellow raw token
- `--pos-color-priority-high` — mapped to orange raw token
- `--pos-color-priority-urgent` — mapped to red raw token

#### Scenario: All 4 priority tokens present
- **WHEN** `tokens/semantic/base.json` is read
- **THEN** it SHALL contain all 4 priority color tokens listed above

#### Scenario: Tokens available as CSS custom properties
- **WHEN** `dist/tokens/theme.css` is generated
- **THEN** all 4 priority tokens SHALL be available as `--pos-color-priority-*` CSS custom properties

### Requirement: Priority tokens support theming
Priority color tokens SHALL be overridable via `[data-pos-theme]` selectors, following the same theming mechanism as other semantic tokens.

#### Scenario: Dark theme override
- **WHEN** a dark theme is defined with overridden priority colors
- **THEN** components using `--pos-color-priority-*` SHALL reflect the overridden values
