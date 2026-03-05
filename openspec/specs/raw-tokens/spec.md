## ADDED Requirements

### Requirement: Raw color tokens
The system SHALL define raw color tokens in `tokens/raw/colors.json` using `{ "$value": "<hex>", "$type": "color" }` format. Only color tokens are needed for v0.

#### Scenario: Neutral scale
- **WHEN** `tokens/raw/colors.json` is read
- **THEN** it SHALL contain `color.neutral` entries for steps 0 (white), 100, 200, 400, 600, 800, 900 (near-black)

#### Scenario: Brand color scales
- **WHEN** `tokens/raw/colors.json` is read
- **THEN** it SHALL contain `color.blue` (500, 600, 700), `color.red` (600), and `color.green` (600) entries

### Requirement: No non-color raw tokens in v0
Spacing, typography, radius, shadow, and z-index SHALL be hardcoded in components as needed. Only color tokens go through the raw → semantic pipeline.

#### Scenario: Only colors.json exists
- **WHEN** `tokens/raw/` directory is listed
- **THEN** it SHALL contain only `colors.json`
