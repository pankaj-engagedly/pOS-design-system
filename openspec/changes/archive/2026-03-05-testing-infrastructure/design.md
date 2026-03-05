## Design Decisions

### 1. @web/test-runner over Vitest

**Decision:** Use @web/test-runner for all tests.

**Why:** Components use Shadow DOM, adoptedStyleSheets, custom elements, and composed events. These require a real browser. Vitest's jsdom/happy-dom has incomplete support for these APIs. @web/test-runner runs in real Chromium — zero fidelity gap.

### 2. One test file per component

**Decision:** `test/ui-button.test.js`, `test/ui-checkbox.test.js`, etc.

**Why:** Keeps tests focused and easy to run individually. Matches the 1:1 component file structure.

### 3. Test pattern: fixture → assert → cleanup

**Decision:** Use `@open-wc/testing-helpers` `fixture()` and `html` to mount components, assert with `@esm-bundle/chai`, automatic cleanup between tests.

**Why:** `fixture()` handles creating elements, waiting for them to connect, and cleaning up. This is the standard Open WC pattern and avoids manual DOM management.

### 4. What to test per component

**Decision:** Each component test covers:
- **Rendering:** Component creates Shadow DOM with expected structure
- **Attributes:** Setting attributes reflects in the rendered output
- **Properties:** Getter/setter works correctly (value, checked, etc.)
- **Events:** Correct events fire on interaction
- **A11y:** Roles, ARIA attributes, focus behavior where applicable

**Why:** These are the contract surfaces. If these pass, the component works as specified.

### 5. No visual regression tests in v0

**Decision:** Skip screenshot/visual comparison tests for now.

**Why:** Visual regression requires baseline images, CI infrastructure, and maintenance overhead. Not worth it at v0 scale. Component behavior tests give us the coverage we need.

### 6. Import source files directly, not the bundle

**Decision:** Tests import from `src/components/ui-*.js` directly, not from `dist/`.

**Why:** Tests should run without a build step. @web/test-runner resolves ES module imports with `--node-resolve`. This also gives better error traces.
