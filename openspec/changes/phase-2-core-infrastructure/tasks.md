## 1. Core

- [x] 1.1 Create `src/core/pos-base-element.js` — extends HTMLElement, attachShadow open mode, `adoptStyles(css)` method using CSSStyleSheet + adoptedStyleSheets
- [x] 1.2 Create `src/core/define.js` — `define(tagName, elementClass)` with duplicate-safe registration

## 2. ui-button

- [x] 2.1 Create `src/components/ui-button.js` — single file with inline styles, native `<button>` in Shadow DOM
- [x] 2.2 Implement `variant` (solid/outline/ghost/danger), `disabled` attributes
- [x] 2.3 All colors via `--pos-color-*` tokens, focus ring via `--pos-color-focus`
- [x] 2.4 Verify native click events bubble through Shadow DOM without suppression

## 3. ui-input

- [x] 3.1 Create `src/components/ui-input.js` — single file with inline styles, native `<input>` in Shadow DOM
- [x] 3.2 Implement `type`, `value`, `placeholder`, `disabled` attributes mirrored to internal input
- [x] 3.3 Expose `value` property that syncs with internal input
- [x] 3.4 All colors via `--pos-color-*` tokens, focus ring via `--pos-color-focus`
- [x] 3.5 Verify native input/change/focus/blur events bubble naturally
