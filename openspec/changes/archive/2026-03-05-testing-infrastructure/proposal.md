## Why

The design system has 17 components with zero test coverage. Before distributing to multiple projects or building real apps on top, we need confidence that components render correctly, handle attributes properly, and fire the right events. Automated tests catch regressions early.

## What Changes

- Install `@web/test-runner`, `@esm-bundle/chai`, and `@open-wc/testing-helpers` as dev dependencies
- Add web-test-runner config file
- Add `test` and `test:watch` npm scripts
- Write component tests for all 17 components covering: rendering, attributes, properties, events, accessibility
- Write a build script test for token generation

## Capabilities

### New Capabilities
- `component-testing`: Test infrastructure for Web Components using @web/test-runner with real browser execution. Tests cover rendering, attribute reflection, property access, event dispatching, and ARIA/accessibility for all components.

### Modified Capabilities
_(none)_

## Impact

- **New files:** `web-test-runner.config.js`, `test/*.test.js` (one per component + build test)
- **Modified files:** `package.json` (devDependencies + scripts)
- **No production code changes** — tests only
