## Why

We need the base class and two real components to validate that Shadow DOM isolation, token cascading, and native event bubbling actually work together. The base class is thin — just Shadow DOM setup and a style helper. Components are single-file, using native elements internally.

## What Changes

- Create `PosBaseElement` base class with Shadow DOM and `adoptStyles()` helper
- Create `define()` safe registration wrapper
- Create `ui-button` component (single file, native `<button>` inside Shadow DOM)
- Create `ui-input` component (single file, native `<input>` inside Shadow DOM)
- Native DOM events bubble naturally — no suppression, no replacement
- Styles inline in each component file

## Capabilities

### New Capabilities
- `base-element`: `PosBaseElement` with Shadow DOM setup and `adoptStyles()` — no event helper needed since we rely on native events
- `element-registration`: Safe `define()` wrapper for CDN multi-load safety
- `ui-button`: Button component with variant/size/disabled attributes, native `<button>` in Shadow DOM, native click events bubble naturally
- `ui-input`: Input component with type/value/placeholder/disabled attributes, native `<input>` in Shadow DOM, native input/change/focus/blur events bubble naturally

### Modified Capabilities
<!-- None -->

## Impact

- Creates `src/core/pos-base-element.js`
- Creates `src/core/define.js`
- Creates `src/components/ui-button.js` (single file)
- Creates `src/components/ui-input.js` (single file)
