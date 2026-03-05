## Context

The design system has a working token pipeline (raw JSON → semantic JSON → CSS custom properties) and two proof-of-concept components (`ui-button`, `ui-input`) that validate Shadow DOM isolation and native event bubbling. However, the components use old token names from v0 (`--pos-color-accent`, `--pos-color-bg`), there is no dark theme, no CSS reset, and no base components beyond button/input. Before consuming projects can build higher-level widgets (navbars, page shells), this base layer needs to be solid and theme-aware.

Current state:
- `tokens/build-tokens.js` outputs a single light theme to `dist/tokens/theme.css`
- `PosBaseElement` attaches Shadow DOM and provides `adoptStyles(css)` but doesn't cache sheets
- `ui-button` and `ui-input` reference old semantic token names
- No CSS reset, base styles, or typography utilities exist
- No container, overlay, or indicator components

## Goals / Non-Goals

**Goals:**
- Dark theme generated alongside light theme from the same token source files
- Project-level theme override pattern that doesn't require forking the system
- CSS reset + base styles + typography utilities in a single `base.css`
- Refactored button/input using real semantic token names + size variants
- Universal primitives: badge, tag, spinner, icon, card, dialog, tooltip, divider

**Non-Goals:**
- Component-level theming (e.g., per-button color overrides) — use CSS custom property overrides at the consumer level
- High-contrast / accessibility themes — future phase
- Animation system or transition tokens
- Form validation logic (belongs in consuming projects)
- Complex positioning (popovers, dropdowns) — tooltip covers the simple case
- Toast/notification system (involves state management, project-level concern)
- Distribution packaging (npm, CDN) — next phase

## Decisions

### Decision 1: Dark theme via a second token file, not runtime toggle

Create `tokens/semantic/dark.json` with the same structure as `base.json` but different value mappings (e.g., background flips from neutral.0 to neutral.900). The build script outputs both light and dark blocks in the same `theme.css`. No JavaScript runtime needed — just set `data-pos-theme="dark"` on a parent element.

**Alternative considered:** JavaScript theme switcher that swaps stylesheets → adds runtime complexity for something CSS can do natively.

### Decision 2: Project-level overrides via CSS specificity, not a config file

Projects override tokens by declaring their own `[data-pos-theme="project-name"]` block after importing `theme.css`. This uses standard CSS specificity — no build step, no config merging. Example:

```css
@import 'pos-design-system/dist/tokens/theme.css';

[data-pos-theme="my-project"] {
  --pos-color-action-primary: #E91E63;
}
```

**Alternative considered:** JSON override file merged at build time → requires re-running the build for every project, harder to debug.

### Decision 3: Base styles + typography utilities in a single `dist/base.css`

A standalone CSS file that imports `theme.css` and includes:
- Box-sizing border-box reset
- Body typography defaults (font-family, color, background from tokens)
- Link color from action tokens
- Focus-visible ring using token values
- Minimal normalize (margin reset on body/h1-h6/p)
- Typography utility classes (`.pos-heading`, `.pos-body`, `.pos-caption`, `.pos-label`)
- Text color utilities (`.pos-text-primary`, `.pos-text-secondary`, `.pos-text-disabled`)

Typography utilities live in `base.css` rather than as a separate file or web component. Text styling doesn't need Shadow DOM isolation — it's applied to light DOM content.

Kept separate from `theme.css` so projects can choose: tokens-only (for full control) or tokens+base (for quick setup).

### Decision 4: CSS custom properties cascade naturally — keep base element thin

CSS custom properties defined on `:root` already cascade into Shadow DOM. No theme sheet injection needed. Components just reference `var(--pos-*)` and it works. The only enhancement to `PosBaseElement` is stylesheet caching — a module-level `Map<string, CSSStyleSheet>` so identical CSS strings share a single parsed sheet.

### Decision 5: Size variants via a `size` attribute with 3 stops

All sizable components (button, input, badge, spinner, icon) support `size="sm"`, `size="md"` (default), `size="lg"`. Sizing affects padding, font-size, and dimensions. Mapped to existing spacing and font-size tokens — no new size-specific tokens.

### Decision 6: Component tag naming convention

All components use the `ui-` prefix: `ui-button`, `ui-input`, `ui-badge`, `ui-tag`, `ui-spinner`, `ui-icon`, `ui-card`, `ui-dialog`, `ui-tooltip`, `ui-divider`. Short, memorable, and avoids conflict with `pos-` which is used for CSS variable naming.

### Decision 7: Card as a slotted container, not a layout component

`<ui-card>` provides visual treatment (radius, shadow, background, border) with named slots (`header`, default/body, `footer`). It does NOT impose internal layout (no grid, no flex direction). Consuming projects control layout within the card. This keeps it universally reusable.

### Decision 8: Dialog wraps native `<dialog>` element

`<ui-dialog>` wraps the native `<dialog>` element to get browser-provided focus trapping, Escape-to-close, and `::backdrop` styling for free. The component adds:
- Styled backdrop using token colors
- Close button (optional via attribute)
- `open()`/`close()` methods on the host element that delegate to `showModal()`/`close()`
- Header/body/footer slots matching `ui-card` structure

**Alternative considered:** Custom overlay with manual focus trap → reimplements what the browser already provides, worse a11y.

### Decision 9: Tooltip uses native popover API

`<ui-tooltip>` uses the `popover` attribute for positioning and show/hide behavior. The trigger element gets `popovertarget` wired up automatically. CSS anchoring handles positioning. Pure CSS + HTML APIs, no JavaScript positioning library.

**Fallback:** For browsers without anchor positioning, tooltip appears centered above the trigger with a simple CSS transform. Acceptable degradation.

### Decision 10: Divider is the simplest possible component

`<ui-divider>` renders a styled `<hr>` with token-based border color. Supports `orientation="vertical"` for flex layouts. No slots, no variants — just a line.

## Risks / Trade-offs

- **Dark theme token values are manually authored** → We'll need to maintain two sets of semantic mappings. Mitigation: keep the semantic token set small and stable.
- **No runtime theme switching** → Switching themes requires changing the `data-pos-theme` attribute on the DOM. This is a one-liner in JS but means no animated transitions between themes. Acceptable.
- **Shadow DOM and base.css don't mix** → `base.css` affects light DOM only. Components inside Shadow DOM are isolated. By design — components style themselves via tokens, base.css handles everything else.
- **Native `<dialog>` focus management** → Browser implementations vary slightly in focus restoration after close. Acceptable — much better than reimplementing.
- **Popover/anchor positioning support** → Not yet universal. Tooltip degrades gracefully to a simpler CSS position. Components that need complex positioning (dropdowns, popovers) are explicitly excluded from this phase.

## Open Questions

- Should `ui-icon` support both Font Awesome Pro and Free? For now, assume Pro (the Figma file uses it) but allow the family to be overridden via a CSS variable.
- Should `ui-tag` support an `on-remove` callback or just dispatch a native event? Leaning toward a `remove` CustomEvent with `{ bubbles: true, composed: true }` since there's no native equivalent.
