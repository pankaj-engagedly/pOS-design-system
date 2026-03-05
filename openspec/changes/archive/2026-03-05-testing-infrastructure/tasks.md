## 1. Setup

- [x] 1.1 Install dev dependencies: `@web/test-runner`, `@esm-bundle/chai`, `@open-wc/testing-helpers`
- [x] 1.2 Create `web-test-runner.config.js` with node-resolve, Chromium browser, `test/**/*.test.js` pattern
- [x] 1.3 Add `"test"` and `"test:watch"` scripts to `package.json`

## 2. Base Component Tests

- [x] 2.1 Create `test/ui-button.test.js`: rendering (shadow DOM, internal button), variants (solid/outline/ghost/danger), sizes (sm/md/lg), disabled state, click event
- [x] 2.2 Create `test/ui-input.test.js`: rendering, type/placeholder/disabled mirroring, value property, size variants, change event, focus ring
- [x] 2.3 Create `test/ui-badge.test.js`: rendering, variants (neutral/primary/success/warning/danger/purple), sizes
- [x] 2.4 Create `test/ui-tag.test.js`: rendering, variants, sizes, removable attribute shows close button, remove event fires on close click
- [x] 2.5 Create `test/ui-spinner.test.js`: rendering, sizes (sm/md/lg), role="status", aria-label="Loading"
- [x] 2.6 Create `test/ui-icon.test.js`: rendering, sizes, color attribute maps to token var

## 3. Container & Overlay Tests

- [x] 3.1 Create `test/ui-card.test.js`: rendering, slots (header/default/footer), padding attribute, empty slot hiding
- [x] 3.2 Create `test/ui-divider.test.js`: rendering, horizontal default, vertical orientation
- [x] 3.3 Create `test/ui-dialog.test.js`: rendering, open()/close() methods, closable attribute, close event
- [x] 3.4 Create `test/ui-tooltip.test.js`: rendering, text attribute, position attribute, role="tooltip", aria-describedby

## 4. Form Component Tests

- [x] 4.1 Create `test/ui-checkbox.test.js`: rendering, checked/indeterminate/disabled states, change event, label click toggles
- [x] 4.2 Create `test/ui-radio.test.js`: rendering, name grouping, checked state, value property, change event, mutual exclusion
- [x] 4.3 Create `test/ui-toggle.test.js`: rendering, checked state, sizes, role="switch", change event, disabled
- [x] 4.4 Create `test/ui-select.test.js`: rendering, options from light DOM, placeholder, value property, size variants, change event
- [x] 4.5 Create `test/ui-textarea.test.js`: rendering, placeholder/rows/disabled mirroring, value property, resize attribute, change event

## 5. Feedback Component Tests

- [x] 5.1 Create `test/ui-alert.test.js`: rendering, variants (info/success/warning/danger), dismissible attribute, dismiss event, header slot
- [x] 5.2 Create `test/ui-progress.test.js`: rendering, value/max fill percentage, indeterminate mode (no value), sizes, ARIA progressbar attributes

## 6. Verify

- [x] 6.1 Run full test suite and verify all tests pass
