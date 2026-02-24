## Context

Components exist (Phase 2). Now we need to validate that third-party code can be loaded dynamically and integrate with the host's token system and event model.

## Goals / Non-Goals

**Goals:**
- Validate `dynamic import()` for plugin loading
- Validate SDK injection via property assignment
- Validate that plugin Shadow DOMs inherit `--pos-*` tokens
- Keep the implementation under ~40 lines total

**Non-Goals:**
- Plugin marketplace or discovery
- Manifest validation or semver enforcement
- Plugin sandboxing
- Theme change subscription

## Decisions

### Decision 1: Property injection over constructor argument
SDK is set as `element.hostSDK = createHostSDK(element)` after element creation. This avoids requiring plugins to accept SDK in their constructor (which would couple their implementation to pOS).

### Decision 2: getToken via getComputedStyle
`getToken(name)` calls `getComputedStyle(document.documentElement).getPropertyValue(name)`. Simple, no caching. Plugins that need many token values can call it multiple times — v0 doesn't need optimization.

### Decision 3: No theme change subscription in v0
Plugins can read current token values but don't get notified of changes. Acceptable for v0 — theme switching during a session is rare in experimentation.

## Risks / Trade-offs

- **No sandboxing:** Plugins run in the same JS context. Acceptable for controlled/trusted environments.
- **Property injection timing:** Plugin must check `this.hostSDK` in `connectedCallback`, not `constructor`. This is documented in the example.
