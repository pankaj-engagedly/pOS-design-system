## 1. Build Pipeline

- [ ] 1.1 Create `src/index.js` — imports and registers ui-button, ui-input; exports loadPlugin, createHostSDK
- [ ] 1.2 Update `esbuild.config.js` to bundle `src/index.js` → `dist/pos-design-system.js` as ESM
- [ ] 1.3 Update `package.json` build script: `node tokens/build-tokens.js && node esbuild.config.js`

## 2. Validation Page

- [ ] 2.1 Create `examples/index.html` loading `dist/tokens/theme.css` and `dist/pos-design-system.js`
- [ ] 2.2 Add default themed section with ui-button (all variants) and ui-input
- [ ] 2.3 Add tenant override section with `data-pos-theme="tenant-acme"` and inline `<style>` overriding `--pos-color-accent`
- [ ] 2.4 Add event log `<pre>` that captures click, input, and custom events via document listeners
- [ ] 2.5 Add plugin loading section that calls `loadPlugin()` and renders the example plugin

## 3. Verify

- [ ] 3.1 Run `npm run build` — verify `dist/tokens/theme.css` and `dist/pos-design-system.js` exist
- [ ] 3.2 Serve and open `examples/index.html` — verify components render with theme tokens
- [ ] 3.3 Verify tenant section shows different accent color
- [ ] 3.4 Verify event log captures native click and input events from components
- [ ] 3.5 Verify plugin renders and its events appear in the log
