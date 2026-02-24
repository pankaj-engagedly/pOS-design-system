## Context

Tokens exist (Phase 1). Now we need a base class and two real components to validate Shadow DOM isolation, token cascading, and native event bubbling.

## Goals / Non-Goals

**Goals:**
- Thin base class — Shadow DOM + style adoption only
- Two components that prove the architecture
- Native events bubble naturally, no suppression
- Single file per component (styles inline)

**Non-Goals:**
- Event contract system (rely on native events)
- Reactive property system
- Test files
- Additional components beyond button and input

## Decisions

### Decision 1: No emit() helper on base class
Native DOM events (`click`, `input`, `change`, `focus`, `blur`) already cross Shadow DOM boundaries when the internal element is a native `<button>` or `<input>`. No custom event helper needed. If a custom event is ever needed, the component creates one directly.

### Decision 2: Single file per component
`.styles.js` is eliminated. CSS lives as a template literal const inside the component `.js` file. Fewer files, faster iteration.

### Decision 3: Styles via adoptedStyleSheets
`CSSStyleSheet` + `adoptedStyleSheets` is used over `<style>` tags. More performant and the sheet is parsed once.

### Decision 4: Native elements for a11y
`<button>` inside `ui-button`, `<input>` inside `ui-input`. Inherits browser keyboard handling, focus management, and form participation without reimplementation.

## Risks / Trade-offs

- **Native event `target`:** When a native event bubbles out of Shadow DOM, `event.target` retargets to the host element. This is desired behavior — consumers see the `<ui-button>` as the target, not the internal `<button>`.
- **No composed custom events:** If we need component-specific events later (e.g., for composed components), we'll add them then.
