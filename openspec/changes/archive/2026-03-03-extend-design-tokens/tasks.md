## 1. Expand Raw Color Palette

- [x] 1.1 Add yellow color tokens (500, 600, 700) to `tokens/raw/colors.json`
- [x] 1.2 Add orange color tokens (500, 600, 700) to `tokens/raw/colors.json`
- [x] 1.3 Add purple color tokens (500, 600, 700) to `tokens/raw/colors.json`

## 2. Create New Raw Token Files

- [x] 2.1 Create `tokens/raw/spacing.json` with 4px base scale (0–16)
- [x] 2.2 Create `tokens/raw/typography.json` with font families, sizes, weights, and line heights
- [x] 2.3 Create `tokens/raw/radius.json` with radius scale (none–full)
- [x] 2.4 Create `tokens/raw/shadows.json` with sm, md, lg elevation values
- [x] 2.5 Create `tokens/raw/sizing.json` with fixed size scale (4–16)
- [x] 2.6 Create `tokens/raw/opacity.json` with opacity scale (0–100)
- [x] 2.7 Create `tokens/raw/z-index.json` with purpose-based z-index values (base, raised, overlay, top)

## 3. Update Semantic Color Tokens

- [x] 3.1 Rewrite `tokens/semantic/base.json` with Category+Role naming (background, text, border, action, feedback subcategories)
- [x] 3.2 Verify old flat-named tokens (`pos.color.bg`, `pos.color.accent`, etc.) are fully removed

## 4. Create New Semantic Token Files

- [x] 4.1 Create `tokens/semantic/spacing.json` with t-shirt size scale (xs–2xl) referencing raw spacing tokens
- [x] 4.2 Create `tokens/semantic/typography.json` with font family, size, weight, line height, and text role tokens (heading, body, caption, label) referencing raw typography tokens
- [x] 4.3 Create `tokens/semantic/borders.json` with generic radius scale (sm–full) referencing raw radius tokens
- [x] 4.4 Create `tokens/semantic/elevation.json` with generic shadow scale (sm–lg) referencing raw shadow tokens
- [x] 4.5 Create `tokens/semantic/z-index.json` with purpose-based tokens (base, raised, overlay, top) referencing raw z-index tokens

## 5. Update Build Pipeline

- [x] 5.1 Refactor `tokens/build-tokens.js` to dynamically scan `tokens/raw/*.json` and `tokens/semantic/*.json`
- [x] 5.2 Merge all raw files into a unified flat lookup map with duplicate key detection
- [x] 5.3 Support all `$type` values (dimension, fontFamily, fontWeight, number, shadow) in CSS output
- [x] 5.4 Support semantic `$value` as either raw token reference (`{key}`) or direct value passthrough
- [x] 5.5 Group CSS output by category with comment headers (e.g., `/* Raw spacing tokens */`)

## 6. Validate Output

- [x] 6.1 Run `npm run build:tokens` and verify `dist/tokens/theme.css` contains all expected raw and semantic CSS variables
- [x] 6.2 Verify no old semantic variable names appear in the output
- [x] 6.3 Verify no component-specific token names appear in the output (no `--pos-shadow-card`, `--pos-radius-button`, etc.)
