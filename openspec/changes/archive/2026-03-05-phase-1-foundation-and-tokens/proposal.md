## Why

Before anything can be built, we need the minimal token pipeline that validates CSS custom property inheritance through Shadow DOM. This phase creates just enough tokens to prove the architecture works — not a complete design system.

## What Changes

- Create minimal project scaffolding (`package.json`, `esbuild.config.js`)
- Define raw color tokens only (neutral, blue, red, green) — no spacing/typography/shadow/z-index token files
- Define a minimal semantic token set (9 tokens)
- Build script that generates a single `theme.css` from JSON sources
- Validate that `[data-pos-theme="tenant"]` overrides work

## Capabilities

### New Capabilities
- `raw-tokens`: Raw color palette JSON (neutral, blue, red, green scales)
- `semantic-tokens`: Minimal purpose-driven aliases (9 tokens: bg, fg, muted, border, accent, accent-hover, danger, success, focus)
- `token-build`: Script that resolves semantic → raw references and outputs a single CSS file
- `project-scaffolding`: Minimal package.json and esbuild config

### Modified Capabilities
<!-- None — greenfield -->

## Impact

- Creates `package.json`, `esbuild.config.js`
- Creates `tokens/raw/colors.json`
- Creates `tokens/semantic/base.json`
- Creates `tokens/build-tokens.js`
- Generates `dist/tokens/theme.css`
