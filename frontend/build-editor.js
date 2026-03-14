// Build script for the Tiptap editor bundle
// Run: node build-editor.js (from frontend/ directory)
// Output: modules/notes/editor.bundle.js

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const esbuild = path.resolve(__dirname, '../design-system/node_modules/.bin/esbuild');

const entry = path.resolve(__dirname, 'modules/notes/editor-entry.js');
const outfile = path.resolve(__dirname, 'modules/notes/editor.bundle.js');

execSync(
  `${esbuild} --bundle --format=esm --outfile=${outfile} --platform=browser --target=es2020 --tree-shaking=true ${entry}`,
  { stdio: 'inherit' }
);

console.log('Editor bundle built:', outfile);
