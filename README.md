# pOS Design System

Browser-native UI platform using Web Components, Shadow DOM, and CSS Custom Properties. No frameworks. Zero runtime dependencies.

**Status:** v0 — experimental architecture validation

---

## What This Validates

1. **Token cascading** — CSS custom properties flowing through Shadow DOM boundaries
2. **Native event bubbling** — `click`, `input`, `change` events crossing Shadow DOM without suppression
3. **Plugin loading** — Dynamic `import()` with SDK injection via property assignment
4. **Tenant theming** — `[data-pos-theme]` attribute overrides scoping to DOM subtrees

---

## Architecture

```
Raw Tokens (JSON)  →  Semantic Tokens (JSON)  →  CSS Custom Properties (theme.css)
                                                        ↓
                                              Shadow DOM Components
                                              (inherit --pos-* vars)
                                                        ↓
                                              Native Events Bubble Up
```

- **Two-tier tokens:** raw literal values → semantic purpose-driven aliases
- **9 semantic tokens:** bg, fg, muted, border, accent, accent-hover, danger, success, focus
- **2 components:** `ui-button`, `ui-input` (native elements inside Shadow DOM)
- **Plugin runtime:** `loadPlugin()` + `createHostSDK()` — no registry, no manifests

---

## Implementation Phases

### Phase 1: Foundation & Tokens
> Minimal token pipeline — raw colors → semantic aliases → CSS custom properties

| Artifact | Path |
|----------|------|
| Proposal | [proposal.md](openspec/changes/phase-1-foundation-and-tokens/proposal.md) |
| Design   | [design.md](openspec/changes/phase-1-foundation-and-tokens/design.md) |
| Tasks    | [tasks.md](openspec/changes/phase-1-foundation-and-tokens/tasks.md) |
| Spec: Raw Tokens | [specs/raw-tokens/spec.md](openspec/changes/phase-1-foundation-and-tokens/specs/raw-tokens/spec.md) |
| Spec: Semantic Tokens | [specs/semantic-tokens/spec.md](openspec/changes/phase-1-foundation-and-tokens/specs/semantic-tokens/spec.md) |
| Spec: Token Build | [specs/token-build/spec.md](openspec/changes/phase-1-foundation-and-tokens/specs/token-build/spec.md) |

### Phase 2: Core & Components
> Base element class, `ui-button`, `ui-input` — validate Shadow DOM + token cascading + native events

| Artifact | Path |
|----------|------|
| Proposal | [proposal.md](openspec/changes/phase-2-core-infrastructure/proposal.md) |
| Design   | [design.md](openspec/changes/phase-2-core-infrastructure/design.md) |
| Tasks    | [tasks.md](openspec/changes/phase-2-core-infrastructure/tasks.md) |
| Spec: Base Element | [specs/base-element/spec.md](openspec/changes/phase-2-core-infrastructure/specs/base-element/spec.md) |
| Spec: Element Registration | [specs/element-registration/spec.md](openspec/changes/phase-2-core-infrastructure/specs/element-registration/spec.md) |
| Spec: ui-button | [specs/ui-button/spec.md](openspec/changes/phase-2-core-infrastructure/specs/ui-button/spec.md) |
| Spec: ui-input | [specs/ui-input/spec.md](openspec/changes/phase-2-core-infrastructure/specs/ui-input/spec.md) |

### Phase 3: Plugin Runtime
> Thin plugin loader — dynamic import, custom element registration, host SDK injection

| Artifact | Path |
|----------|------|
| Proposal | [proposal.md](openspec/changes/phase-3-plugin-runtime/proposal.md) |
| Design   | [design.md](openspec/changes/phase-3-plugin-runtime/design.md) |
| Tasks    | [tasks.md](openspec/changes/phase-3-plugin-runtime/tasks.md) |
| Spec: Plugin Loader | [specs/plugin-loader/spec.md](openspec/changes/phase-3-plugin-runtime/specs/plugin-loader/spec.md) |
| Spec: Host SDK | [specs/host-sdk/spec.md](openspec/changes/phase-3-plugin-runtime/specs/host-sdk/spec.md) |

### Phase 4: Validation
> Single HTML page proving tokens + components + plugins + tenant theming work end-to-end

| Artifact | Path |
|----------|------|
| Proposal | [proposal.md](openspec/changes/phase-4-validation/proposal.md) |
| Design   | [design.md](openspec/changes/phase-4-validation/design.md) |
| Tasks    | [tasks.md](openspec/changes/phase-4-validation/tasks.md) |
| Spec: Validation Page | [specs/validation-page/spec.md](openspec/changes/phase-4-validation/specs/validation-page/spec.md) |
| Spec: Build Pipeline | [specs/build-pipeline/spec.md](openspec/changes/phase-4-validation/specs/build-pipeline/spec.md) |

---

## Folder Structure

```
pOS-design-system/
├── README.md
├── package.json
├── esbuild.config.js
├── .gitignore
│
├── tokens/
│   ├── raw/
│   │   └── colors.json                   ← raw color palette
│   ├── semantic/
│   │   └── base.json                     ← 9 semantic token aliases
│   └── build-tokens.js                   ← JSON → CSS build script
│
├── src/
│   ├── core/
│   │   ├── pos-base-element.js           ← base class (Shadow DOM + adoptStyles)
│   │   └── define.js                     ← safe customElements.define wrapper
│   ├── components/
│   │   ├── ui-button.js                  ← button (single file, styles inline)
│   │   └── ui-input.js                   ← input (single file, styles inline)
│   ├── plugins/
│   │   ├── host-sdk.js                   ← createHostSDK(element) → { emit, getToken }
│   │   └── loader.js                     ← loadPlugin({ url, tagName })
│   └── index.js                          ← barrel export
│
├── examples/
│   ├── index.html                        ← validation page (all hypotheses)
│   └── plugins/
│       └── hello-plugin.js               ← example plugin
│
├── dist/                                  ← build output (gitignored)
│   ├── tokens/
│   │   └── theme.css                     ← generated CSS custom properties
│   └── pos-design-system.js              ← ESM bundle
│
└── openspec/                              ← specs & change tracking
    ├── config.yaml
    └── changes/
        ├── phase-1-foundation-and-tokens/
        │   ├── proposal.md
        │   ├── design.md
        │   ├── tasks.md
        │   └── specs/
        │       ├── raw-tokens/spec.md
        │       ├── semantic-tokens/spec.md
        │       └── token-build/spec.md
        ├── phase-2-core-infrastructure/
        │   ├── proposal.md
        │   ├── design.md
        │   ├── tasks.md
        │   └── specs/
        │       ├── base-element/spec.md
        │       ├── element-registration/spec.md
        │       ├── ui-button/spec.md
        │       └── ui-input/spec.md
        ├── phase-3-plugin-runtime/
        │   ├── proposal.md
        │   ├── design.md
        │   ├── tasks.md
        │   └── specs/
        │       ├── plugin-loader/spec.md
        │       └── host-sdk/spec.md
        └── phase-4-validation/
            ├── proposal.md
            ├── design.md
            ├── tasks.md
            └── specs/
                ├── validation-page/spec.md
                └── build-pipeline/spec.md
```

---

## Semantic Tokens (v0)

| Token | Purpose |
|-------|---------|
| `--pos-color-bg` | Page/component background |
| `--pos-color-fg` | Primary text |
| `--pos-color-muted` | Secondary/muted text |
| `--pos-color-border` | Borders and dividers |
| `--pos-color-accent` | Primary action color |
| `--pos-color-accent-hover` | Hover state of accent |
| `--pos-color-danger` | Error/destructive actions |
| `--pos-color-success` | Success states |
| `--pos-color-focus` | Focus ring indicator |

---

## Key Constraints

- **Plain JavaScript** — no TypeScript, no build-time types
- **No event suppression** — native DOM events bubble naturally through Shadow DOM
- **No hardcoded colors** — components use `var(--pos-color-*)` exclusively
- **Single file per component** — styles inline, no separate `.styles.js`
- **No tests in v0** — focus on architecture validation
- **No dark theme in v0** — single light theme
