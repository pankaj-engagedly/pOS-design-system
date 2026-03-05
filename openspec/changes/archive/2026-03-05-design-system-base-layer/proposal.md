## Why

The token pipeline and two proof-of-concept components (ui-button, ui-input) exist but use hardcoded values and old semantic token names (e.g., `--pos-color-accent`, `--pos-color-bg`). There is no theming infrastructure, no CSS reset, and no way for multiple projects to share the system with different visual identities. Before building higher-level components in consuming projects, we need the base layer to be solid: proper theming, normalized styles, and production-quality base components that use the real token contract.

## What Changes

- **Theming infrastructure**: Add dark theme support and a project-level override pattern using `[data-pos-theme]` selectors. Update `build-tokens.js` to generate multi-theme output.
- **CSS reset + base styles**: Create `base.css` that applies token-driven defaults (box-sizing, typography, link colors, focus rings, typography utility classes) so any project importing it immediately looks on-brand.
- **Refactor existing components**: Update `ui-button` and `ui-input` to use the current semantic token names (`--pos-color-action-primary`, `--pos-color-text-primary`, etc.) instead of the old v0 names.
- **New base components**: Add `ui-badge`, `ui-tag`, `ui-spinner`, `ui-icon`, `ui-card`, `ui-dialog`, `ui-tooltip`, `ui-divider` — the universal primitives needed across all consuming projects.

## Capabilities

### New Capabilities
- `theming`: Multi-theme support (light/dark) with project-level override pattern via CSS custom property re-declaration
- `base-styles`: CSS reset, global token-driven base styles, and typography utility classes (heading/body/caption/label)
- `ui-badge`: Status indicator component (color variants, sizes)
- `ui-tag`: Removable label component (color variants, optional close action)
- `ui-spinner`: Loading indicator component (sizes)
- `ui-icon`: Icon wrapper for consistent sizing and alignment
- `ui-card`: Container component with radius, shadow, and slots for header/body/footer
- `ui-dialog`: Modal overlay using native `<dialog>` element with backdrop and close behavior
- `ui-tooltip`: Positioned hint text on hover/focus using native popover API
- `ui-divider`: Styled horizontal/vertical separator

### Modified Capabilities
- `base-element`: Update `PosBaseElement` to cache stylesheets so multiple instances share a single parsed sheet
- `ui-button`: Refactor to use current semantic token names, add size variants (sm/md/lg)
- `ui-input`: Refactor to use current semantic token names, add size variants

## Impact

- **tokens/build-tokens.js**: Needs to output multiple theme blocks (light + dark)
- **dist/tokens/theme.css**: Will contain both `:root` / `[data-pos-theme="light"]` and `[data-pos-theme="dark"]` selectors
- **src/core/pos-base-element.js**: Modified to cache adopted stylesheets
- **src/components/ui-button.js**: Refactored styles and added size variants
- **src/components/ui-input.js**: Refactored styles and added size variants
- **New files**: `dist/base.css`, `src/components/ui-badge.js`, `src/components/ui-tag.js`, `src/components/ui-spinner.js`, `src/components/ui-icon.js`, `src/components/ui-card.js`, `src/components/ui-dialog.js`, `src/components/ui-tooltip.js`, `src/components/ui-divider.js`
- **No breaking changes** to the component API surface (tag names, attribute names stay the same)
