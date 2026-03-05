## 1. Theming Infrastructure

- [x] 1.1 Create `tokens/semantic/dark.json` with inverted color mappings (background → dark neutrals, text → light neutrals), same key structure as `base.json`
- [x] 1.2 Update `tokens/build-tokens.js` to discover and load theme files (light from `base.json`, dark from `dark.json`), outputting light theme under `:root, [data-pos-theme="light"]` and dark theme under `[data-pos-theme="dark"]` — dark block re-declares only semantic tokens, not raw tokens
- [x] 1.3 Run build and verify `dist/tokens/theme.css` contains both light and dark blocks with correct scoping

## 2. Base Styles

- [x] 2.1 Create `src/styles/base.css` with CSS reset (box-sizing, margin reset), body typography defaults from tokens, link styling from `--pos-color-action-primary`, and `:focus-visible` ring
- [x] 2.2 Add typography utility classes to `base.css`: `.pos-heading`, `.pos-body`, `.pos-caption`, `.pos-label` using semantic text tokens
- [x] 2.3 Add text color utility classes: `.pos-text-primary`, `.pos-text-secondary`, `.pos-text-disabled`
- [x] 2.4 Update build to copy/bundle `base.css` (with `@import` of `theme.css`) to `dist/base.css`

## 3. Base Element Enhancement

- [x] 3.1 Add static stylesheet caching to `PosBaseElement.adoptStyles()` — use a module-level `Map<string, CSSStyleSheet>` so multiple instances of the same component share one parsed sheet

## 4. Refactor Existing Components

- [x] 4.1 Refactor `ui-button`: replace old token names (`--pos-color-accent`, `--pos-color-bg`, etc.) with current semantic tokens (`--pos-color-action-primary`, `--pos-color-background-primary`, etc.), add `size` attribute (sm/md/lg) affecting padding and font-size
- [x] 4.2 Refactor `ui-input`: replace old token names with current semantic tokens, add `size` attribute (sm/md/lg) affecting padding and font-size
- [x] 4.3 Verify both components render correctly with light and dark themes

## 5. New Components — Badge & Tag

- [x] 5.1 Create `src/components/ui-badge.js`: extends `PosBaseElement`, supports `variant` (neutral/primary/success/warning/danger/purple) and `size` (sm/md/lg) attributes, uses `--pos-radius-full`, all colors from tokens
- [x] 5.2 Create `src/components/ui-tag.js`: extends `PosBaseElement`, supports `variant` (neutral/primary/purple/orange), `size` (sm/md), and `removable` attribute with close button dispatching `remove` CustomEvent `{ bubbles: true, composed: true }`

## 6. New Components — Spinner & Icon

- [x] 6.1 Create `src/components/ui-spinner.js`: CSS-only spinning animation, `size` attribute (sm=16px/md=24px/lg=32px), `role="status"` and `aria-label="Loading"`
- [x] 6.2 Create `src/components/ui-icon.js`: inline-flex centered container, `size` attribute (sm=16px/md=20px/lg=24px), `color` attribute for optional token-based override, default `currentColor`

## 7. New Components — Card & Divider

- [x] 7.1 Create `src/components/ui-card.js`: visual container with radius, shadow, border; named slots for `header`, default body, `footer` with border separators; `padding` attribute (none/sm/md/lg); no internal layout imposed
- [x] 7.2 Create `src/components/ui-divider.js`: horizontal/vertical separator with `orientation` attribute, token-based border color and spacing

## 8. New Components — Dialog & Tooltip

- [x] 8.1 Create `src/components/ui-dialog.js`: wraps native `<dialog>` with `showModal()`, `open()`/`close()` methods on host, `closable` attribute for × button, `::backdrop` styling, header/body/footer slots, dispatches `close` CustomEvent
- [x] 8.2 Create `src/components/ui-tooltip.js`: positioned hint text via `text` attribute, `position` attribute (top/bottom/left/right), show on hover/focus, `role="tooltip"` + `aria-describedby` for a11y

## 9. Registration & Demo

- [x] 9.1 Update `src/index.js` to import and register all new components (`ui-badge`, `ui-tag`, `ui-spinner`, `ui-icon`, `ui-card`, `ui-divider`, `ui-dialog`, `ui-tooltip`)
- [x] 9.2 Create or update `demo/index.html` showing all components in both light and dark themes as a visual smoke test
