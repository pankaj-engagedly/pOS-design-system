import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/pos-design-system.js',
  target: ['es2022'],
  // Minimal config for v0 — no minification, source maps for debugging
  sourcemap: true,
});

console.log('Build complete → dist/pos-design-system.js');
