## Why

The design system currently only has color tokens (12 raw, 9 semantic). All other visual properties — spacing, typography, border-radius, shadows, opacity, sizing, and z-index — are hardcoded in components. This makes theming incomplete, tenant customisation inconsistent, and future component work brittle. Extending the token system now establishes the full design language before more components are built.

## What Changes

- **Expand raw color palette**: Add yellow/amber, orange, and purple color scales for warning states and richer UI expression
- **Add new raw token files**: spacing, typography, radii, shadows, sizing, opacity, z-index — each as a separate JSON file under `tokens/raw/`
- **Restructure semantic color tokens**: Migrate from flat naming (`pos.color.bg`, `pos.color.accent`) to Category+Role convention (`pos.color.background.primary`, `pos.color.action.primary`) for better scalability and discoverability. **BREAKING** — existing semantic CSS variable names will change
- **Add new semantic token files**: spacing, typography, borders, elevation, z-index — each as a separate JSON file under `tokens/semantic/`
- **Semantic tokens describe purpose, not components**: e.g., `pos.z.overlay` not `pos.z.modal`; `pos.shadow.md` not `pos.shadow.card`. Component-tier tokens are a future concern
- **Update build pipeline**: `build-tokens.js` to dynamically scan all `tokens/raw/*.json` and `tokens/semantic/*.json` instead of hardcoded file paths, and support non-color `$type` values (dimension, fontFamily, fontWeight, number, shadow)

## Capabilities

### New Capabilities
- `raw-tokens-extended`: Expanded raw token definitions covering colors (new hues), spacing, typography, radii, shadows, sizing, opacity, and z-index
- `semantic-tokens-extended`: Comprehensive semantic token layer using Category+Role naming, covering color roles, spacing scale, typography roles, border-radius scale, elevation scale, and z-index purpose scale
- `token-build-extended`: Updated build pipeline that dynamically discovers token files and supports all token types (not just colors)

### Modified Capabilities
<!-- No existing specs in openspec/specs/ to modify. The phase-1 specs (raw-tokens, semantic-tokens, token-build) live only in archived changes. -->

## Impact

- **Token files**: New files under `tokens/raw/` and `tokens/semantic/`; existing `colors.json` and `base.json` modified
- **Generated CSS**: `dist/tokens/theme.css` will contain significantly more custom properties and renamed semantic variables
- **Build script**: `tokens/build-tokens.js` rewritten to handle dynamic file discovery and multiple token types
- **Components**: Not changed in this work, but existing components reference old semantic names (`--pos-color-bg`, `--pos-color-accent`, etc.) and will need updating in a follow-up change
- **Tenant themes**: Any tenant overrides using old semantic variable names will need updating
