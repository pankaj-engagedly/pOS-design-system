## Context

All pieces exist (tokens, components, plugin loader). This phase wires them together into a single proof-of-concept page and build pipeline.

## Goals / Non-Goals

**Goals:**
- Single `npm run build` produces everything
- Single `index.html` validates all 4 architectural hypotheses
- Zero additional tooling — serve with any HTTP server

**Non-Goals:**
- Documentation site
- CI/CD
- npm publishing

## Decisions

### Decision 1: ESM bundle only
One output: `dist/pos-design-system.js` as an ES module. No IIFE bundle in v0.

### Decision 2: Inline tenant theme
The tenant override CSS (`[data-pos-theme="tenant-acme"]`) is a `<style>` block in `index.html`, not a separate file. Demonstrates the mechanism without file overhead.

### Decision 3: Event log via addEventListener
The event log is a simple `<pre>` element. A `document.addEventListener` for `click`, `input`, and any custom events appends text. Validates bubbling without a framework.

## Risks / Trade-offs

- **Manual HTTP server needed:** `file://` won't work for ES modules. User must serve via `npx serve dist` or similar. Documented in the example.
