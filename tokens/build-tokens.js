import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// --- Load token files ---
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'raw/colors.json'), 'utf8'));
const semantic = JSON.parse(fs.readFileSync(path.join(__dirname, 'semantic/base.json'), 'utf8'));

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

// --- Resolve a semantic reference like "{color.neutral.0}" ---
function resolveRef(ref, rawMap) {
  const match = ref.match(/^\{(.+)\}$/);
  if (!match) return null;
  const key = match[1];
  if (!rawMap[key]) throw new Error(`Unknown raw token reference: "${ref}" (key: "${key}")`);
  return rawKeyToCssVar(key);
}

// --- Build CSS lines ---
const rawMap = flattenRaw(raw);

const lines = [
  ':root,',
  '[data-pos-theme="light"] {',
  '',
  '  /* Raw color tokens */',
];

for (const [key, value] of Object.entries(rawMap)) {
  lines.push(`  ${rawKeyToCssVar(key)}: ${value};`);
}

lines.push('');
lines.push('  /* Semantic tokens */');

// Flatten semantic tokens: pos.color.accent → --pos-color-accent
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

for (const [key, ref] of flattenSemantic(semantic)) {
  const cssVarName = `--${key}`;  // e.g. --pos-color-accent
  const rawVar = resolveRef(ref, rawMap);
  lines.push(`  ${cssVarName}: var(${rawVar});`);
}

lines.push('}');
lines.push('');

// --- Write output ---
const outDir = path.join(root, 'dist/tokens');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'theme.css'), lines.join('\n'), 'utf8');

console.log('✓ dist/tokens/theme.css generated');
