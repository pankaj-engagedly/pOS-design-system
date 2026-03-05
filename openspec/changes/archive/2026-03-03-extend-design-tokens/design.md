## Context

The pOS Design System uses a two-tier token architecture: raw primitives → semantic aliases, compiled to CSS custom properties via a Node.js build script. Currently only color tokens exist (12 raw in `tokens/raw/colors.json`, 9 semantic in `tokens/semantic/base.json`). The build script (`tokens/build-tokens.js`) is hardcoded to read these two files and only handles color values.

Components use semantic tokens exclusively (`var(--pos-color-accent)`) and never reference raw values directly. Tenant theming works via `[data-pos-theme]` attribute scoping. This architecture is sound and will be preserved — we're extending it, not replacing it.

## Goals / Non-Goals

**Goals:**
- Define a complete raw token palette covering: colors (expanded), spacing, typography, radii, shadows, sizing, opacity, z-index
- Define a semantic token layer using Category+Role naming for all categories
- Update the build pipeline to dynamically discover and process all token types
- Maintain the existing two-tier architecture (raw → semantic)
- Maintain backward compatibility in the build output format (CSS custom properties under `:root, [data-pos-theme="light"]`)

**Non-Goals:**
- Component updates (follow-up change)
- Component-tier tokens (third tier — future work)
- Dark theme (separate change)
- Token documentation site or Figma sync
- Runtime token API changes (plugin SDK `getToken()` continues to work as-is)

## Decisions

### 1. One file per token category under `tokens/raw/` and `tokens/semantic/`

**Decision**: Each category gets its own JSON file (e.g., `tokens/raw/spacing.json`, `tokens/semantic/spacing.json`).

**Alternatives considered**:
- Single monolithic file per tier → rejected: hard to navigate, noisy diffs, poor separation of concerns
- Directory per category with multiple files → rejected: over-engineering for current scale

**Rationale**: One-file-per-category keeps things scannable and diff-friendly while the build script discovers files dynamically via `fs.readdirSync`.

### 2. Category+Role semantic naming convention

**Decision**: Semantic tokens follow `pos.<category>.<subcategory>.<role>` pattern.

Color examples:
- `pos.color.background.primary` → `--pos-color-background-primary`
- `pos.color.text.secondary` → `--pos-color-text-secondary`
- `pos.color.action.primary` → `--pos-color-action-primary`
- `pos.color.feedback.error` → `--pos-color-feedback-error`

Non-color examples:
- `pos.space.md` → `--pos-space-md`
- `pos.font.size.md` → `--pos-font-size-md`
- `pos.radius.md` → `--pos-radius-md`
- `pos.shadow.md` → `--pos-shadow-md`
- `pos.z.overlay` → `--pos-z-overlay`

**Alternatives considered**:
- Keep flat naming (`pos.color.bg`) → rejected: doesn't scale, ambiguous when adding variants
- Component-intent naming (`pos.color.surface.default`) → rejected: blends well with Category+Role, considered for future blend

**Rationale**: Groups naturally in autocomplete, self-documenting, easy to extend without naming collisions.

### 3. Breaking rename of existing semantic color tokens

**Decision**: Rename existing 9 semantic tokens to the new convention. Old names will NOT be preserved as aliases.

| Old | New |
|-----|-----|
| `--pos-color-bg` | `--pos-color-background-primary` |
| `--pos-color-fg` | `--pos-color-text-primary` |
| `--pos-color-muted` | `--pos-color-text-secondary` |
| `--pos-color-border` | `--pos-color-border-default` |
| `--pos-color-accent` | `--pos-color-action-primary` |
| `--pos-color-accent-hover` | `--pos-color-action-primary-hover` |
| `--pos-color-danger` | `--pos-color-feedback-error` |
| `--pos-color-success` | `--pos-color-feedback-success` |
| `--pos-color-focus` | `--pos-color-action-focus` |

**Rationale**: v0 system with no external consumers yet. Clean break now avoids legacy baggage. Component updates handled in a follow-up change.

### 4. Purpose-based z-index naming (not component-based)

**Decision**: Z-index semantic tokens describe stacking intent, not which component uses them.

| Token | Value | Intent |
|-------|-------|--------|
| `pos.z.base` | 0 | Default stacking context |
| `pos.z.raised` | 100 | Above surrounding content |
| `pos.z.overlay` | 400 | Above everything, typically blocking |
| `pos.z.top` | 700 | Always on top (notifications, toasts) |

**Alternatives considered**:
- Component-named (`pos.z.dropdown`, `pos.z.modal`) → rejected: belongs in component-tier tokens

**Rationale**: Semantic layer describes purpose. Components map to these in the future third tier.

### 5. Raw token value conventions

**Decision**: Use consistent value systems per category:

| Category | `$type` | Value format | Scale approach |
|----------|---------|-------------|----------------|
| Colors | `color` | Hex `#rrggbb` | Named steps (0–900) |
| Spacing | `dimension` | `Xpx` strings | 4px base: 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Font sizes | `dimension` | `Xpx` strings | Named scale: xs(12), sm(14), md(16), lg(18), xl(20), 2xl(24), 3xl(30), 4xl(36) |
| Font weights | `fontWeight` | Number | 300, 400, 500, 600, 700 |
| Font families | `fontFamily` | CSS string | System font stacks |
| Line heights | `number` | Unitless ratio | tight(1.25), normal(1.5), loose(1.75) |
| Radius | `dimension` | `Xpx` or keyword | none(0), sm(4px), md(8px), lg(12px), xl(16px), full(9999px) |
| Shadows | `shadow` | CSS shadow string | sm, md, lg composite values |
| Sizing | `dimension` | `Xpx` strings | Fixed values: 4(16px), 6(24px), 8(32px), 10(40px), 12(48px), 16(64px) |
| Opacity | `number` | Decimal 0–1 | 0(0), 25(0.25), 50(0.5), 75(0.75), 100(1) |
| Z-index | `number` | Integer | base(0), raised(100), overlay(400), top(700) |

**Rationale**: Follows DTCG (Design Tokens Community Group) `$type` conventions where possible. Px strings for dimensions keep CSS output straightforward.

### 6. Build pipeline: dynamic file discovery

**Decision**: Replace hardcoded file reads with `fs.readdirSync` scanning `tokens/raw/` and `tokens/semantic/` for `*.json` files. Merge all raw files into a single lookup map, then resolve all semantic files against it.

**Key changes to `build-tokens.js`**:
- Scan `tokens/raw/*.json` → merge into unified raw map
- Scan `tokens/semantic/*.json` → resolve references and output
- Group CSS output by category with comment headers (e.g., `/* Raw color tokens */`, `/* Raw spacing tokens */`)
- Semantic references can now point to any raw category, not just colors
- Non-color values passed through as literal CSS values (no `var()` wrapping needed for direct values)

**Rationale**: Adding a new token category should only require creating two JSON files — no build script changes needed.

### 7. Semantic tokens can reference raw tokens OR use direct values

**Decision**: Semantic `$value` can be either:
- A reference: `"{color.neutral.0}"` → resolves to `var(--pos-raw-color-neutral-0)`
- A direct value: `"16px"` or `"1.5"` → output as-is

**Rationale**: Some semantic tokens (like shadows) may compose multiple raw values or use CSS functions. Direct values keep the system flexible without requiring every possible value to exist as a raw token.

## Risks / Trade-offs

**[Breaking change]** Existing semantic CSS variable names change → Components and tenant overrides will break.
→ *Mitigation*: This is v0 with no external consumers. Component updates are scoped as a separate follow-up change. Document the migration mapping (old → new) in this design doc (Decision 3).

**[Token bloat]** Adding all categories at once increases the CSS output significantly.
→ *Mitigation*: Only include tokens that serve a clear purpose. Avoid speculative tokens. The raw palette is intentionally minimal (not every step 0–900 for every hue).

**[Naming lock-in]** Category+Role naming is hard to change later once components adopt it.
→ *Mitigation*: Follow established conventions (Carbon, Polaris, Atlassian). The pattern is well-proven at scale.

## Open Questions

- Should we add a `color.warning` semantic alias that maps to yellow/amber, or wait until a component needs it? *Leaning yes — warning is a standard feedback role alongside error/success.*
