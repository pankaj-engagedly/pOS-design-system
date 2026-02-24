## Context

Greenfield project. This phase creates the minimal token pipeline to validate that CSS custom properties cascade through Shadow DOM boundaries and that tenant theming works.

## Goals / Non-Goals

**Goals:**
- Validate raw → semantic token indirection via CSS `var()` references
- Validate `[data-pos-theme]` attribute-based theming
- Produce a single `theme.css` file from JSON sources

**Non-Goals:**
- Full design token coverage (spacing, typography, shadow, z-index)
- Dark theme
- Style Dictionary or any token framework
- Test infrastructure

## Decisions

### Decision 1: Colors only
Only color tokens go through the pipeline. Spacing, radius, font sizes stay as hardcoded values in components. This reduces the token surface area to validate the architecture without boilerplate.

### Decision 2: Single theme file
One `theme.css` scoped to `:root, [data-pos-theme="light"]`. Tenants override with `[data-pos-theme="tenant-name"]`. No dark theme in v0.

### Decision 3: Plain Node.js build script
`tokens/build-tokens.js` uses only `fs` and `path`. No Style Dictionary, no framework. The script is ~50 lines.

## Risks / Trade-offs

- **Limited token coverage:** Components will hardcode non-color values. Acceptable for v0 — we're validating the mechanism, not the coverage.
