## 1. Project Scaffolding

- [ ] 1.1 Create `package.json` with `"type": "module"`, `"name": "pos-design-system"`, esbuild as dev dependency, `build` script
- [ ] 1.2 Create `esbuild.config.js` with minimal ES module output config
- [ ] 1.3 Create `.gitignore` with `dist/` and `node_modules/`

## 2. Raw Tokens

- [ ] 2.1 Create `tokens/raw/colors.json` with neutral (0, 100, 200, 400, 600, 800, 900), blue (500, 600, 700), red (600), green (600)

## 3. Semantic Tokens

- [ ] 3.1 Create `tokens/semantic/base.json` with 9 semantic tokens (bg, fg, muted, border, accent, accent-hover, danger, success, focus) referencing raw colors

## 4. Token Build

- [ ] 4.1 Create `tokens/build-tokens.js` that reads raw + semantic JSON, resolves references, outputs `dist/tokens/theme.css`
- [ ] 4.2 Verify generated CSS has `--pos-color-*` semantic vars referencing `--pos-raw-*` vars
