import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// --- Dynamically discover and load all token files in a directory ---
function loadTokenDir(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  const result = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const name = path.basename(file, '.json'); // e.g. "colors", "spacing"
    result.push({ name, data });
  }
  return result;
}

// --- Flatten raw tokens to a lookup map ---
// e.g. "color.neutral.0" → "#ffffff"
function flattenRaw(obj, prefix = '') {
  const map = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && '$value' in val) {
      map[fullKey] = val.$value;
    } else if (val && typeof val === 'object') {
      Object.assign(map, flattenRaw(val, fullKey));
    }
  }
  return map;
}

// --- Convert a raw key to a CSS variable name ---
// e.g. "color.neutral.0" → "--pos-raw-color-neutral-0"
function rawKeyToCssVar(key) {
  return '--pos-raw-' + key.replaceAll('.', '-');
}

// --- Resolve a semantic value (reference or direct) ---
function resolveValue(val, rawMap) {
  if (typeof val === 'string') {
    const match = val.match(/^\{(.+)\}$/);
    if (match) {
      const key = match[1];
      if (!(key in rawMap)) throw new Error(`Unknown raw token reference: "${val}" (key: "${key}")`);
      return `var(${rawKeyToCssVar(key)})`;
    }
    return val; // direct string value
  }
  return String(val); // direct number value
}

// --- Flatten semantic tokens ---
// pos.color.accent → --pos-color-accent
function flattenSemantic(obj, prefix = '') {
  const entries = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}-${key}` : key;
    if (val && typeof val === 'object' && '$value' in val) {
      entries.push([fullKey, val.$value]);
    } else if (val && typeof val === 'object') {
      entries.push(...flattenSemantic(val, fullKey));
    }
  }
  return entries;
}

// --- Theme file configuration ---
// base.json = light theme, dark.json = dark theme
// Additional themes can be added by creating new semantic JSON files
// and adding them to this map.
const THEME_FILES = {
  'base': { selector: ':root,\n[data-pos-theme="light"]', includeRaw: true },
  'dark': { selector: '[data-pos-theme="dark"]', includeRaw: false },
};

// --- Load all raw token files and build unified map ---
const rawFiles = loadTokenDir(path.join(__dirname, 'raw'));
const rawMap = {};

for (const { name, data } of rawFiles) {
  const flat = flattenRaw(data);
  for (const key of Object.keys(flat)) {
    if (rawMap[key]) {
      throw new Error(`Duplicate raw token key: "${key}" (found in ${name}.json)`);
    }
  }
  Object.assign(rawMap, flat);
}

// --- Build CSS lines ---
const lines = [];

// Load semantic directory once to discover available files
const semanticDir = path.join(__dirname, 'semantic');
const allSemanticFiles = fs.readdirSync(semanticDir).filter(f => f.endsWith('.json')).sort();

for (const [themeFile, config] of Object.entries(THEME_FILES)) {
  const themeFilePath = path.join(semanticDir, `${themeFile}.json`);
  if (!fs.existsSync(themeFilePath)) continue;

  lines.push(`${config.selector} {`);

  // Raw tokens only in the primary (light) theme block
  if (config.includeRaw) {
    for (const { name, data } of rawFiles) {
      const flat = flattenRaw(data);
      const entries = Object.entries(flat);
      if (entries.length === 0) continue;

      lines.push('');
      lines.push(`  /* Raw ${name} tokens */`);
      for (const [key, value] of entries) {
        lines.push(`  ${rawKeyToCssVar(key)}: ${value};`);
      }
    }
  }

  // Semantic tokens: for the primary theme, include all semantic files.
  // For alternate themes (dark), only include the theme-specific file.
  const semanticFilesToLoad = config.includeRaw
    ? allSemanticFiles.filter(f => f !== 'dark.json')
    : [`${themeFile}.json`];

  for (const file of semanticFilesToLoad) {
    const filePath = path.join(semanticDir, file);
    if (!fs.existsSync(filePath)) continue;

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const name = path.basename(file, '.json');
    const entries = flattenSemantic(data);
    if (entries.length === 0) continue;

    lines.push('');
    lines.push(`  /* Semantic ${name} tokens */`);
    for (const [key, ref] of entries) {
      const cssVarName = `--${key}`;
      const resolved = resolveValue(ref, rawMap);
      lines.push(`  ${cssVarName}: ${resolved};`);
    }
  }

  lines.push('}');
  lines.push('');
}

// --- Write output ---
const outDir = path.join(root, 'dist/tokens');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'theme.css'), lines.join('\n'), 'utf8');

console.log('✓ dist/tokens/theme.css generated');

// --- Copy base.css to dist ---
const baseCssSrc = path.join(root, 'src/styles/base.css');
if (fs.existsSync(baseCssSrc)) {
  // Rewrite the @import to use relative path within dist
  let baseCss = fs.readFileSync(baseCssSrc, 'utf8');
  baseCss = baseCss.replace(
    /@import\s+['"].*?theme\.css['"];?/,
    "@import './tokens/theme.css';"
  );
  fs.writeFileSync(path.join(root, 'dist/base.css'), baseCss, 'utf8');
  console.log('✓ dist/base.css generated');
}
