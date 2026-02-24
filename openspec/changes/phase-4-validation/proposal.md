## Why

We need a single HTML page that exercises every architectural hypothesis: token cascading through Shadow DOM, native event bubbling, plugin loading, and tenant theming override. This is the proof-of-concept that validates the entire v0 stack.

## What Changes

- Create `examples/index.html` that loads theme CSS and all components
- Demonstrate token cascading by rendering components inside a themed container
- Demonstrate tenant theming by showing a `[data-pos-theme="tenant-acme"]` override section
- Demonstrate plugin loading with the example plugin
- Add an event log that shows native and custom events bubbling from components
- Build all outputs via `npm run build`

## Capabilities

### New Capabilities
- `validation-page`: Single HTML page exercising token cascading, event bubbling, plugin loading, and tenant theming
- `build-pipeline`: `npm run build` runs token build + esbuild to produce all dist outputs

### Modified Capabilities
<!-- None -->

## Impact

- Creates `examples/index.html`
- Updates `package.json` build script to chain token build + esbuild
- Creates `src/index.js` barrel export
- Generates `dist/` outputs
