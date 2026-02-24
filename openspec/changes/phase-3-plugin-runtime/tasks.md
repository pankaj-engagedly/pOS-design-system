## 1. Host SDK

- [ ] 1.1 Create `src/plugins/host-sdk.js` — `createHostSDK(element)` returns plain object with `emit(eventName, payload)` and `getToken(name)`
- [ ] 1.2 `emit` dispatches CustomEvent from `element` with `{ bubbles: true, composed: true, detail: payload }`
- [ ] 1.3 `getToken` reads from `getComputedStyle(document.documentElement).getPropertyValue(name)`

## 2. Plugin Loader

- [ ] 2.1 Create `src/plugins/loader.js` — `loadPlugin({ url, tagName })` using `dynamic import(url)`
- [ ] 2.2 Register default export as custom element via `define(tagName, module.default)`
- [ ] 2.3 Return a factory function or the class so the host can create elements and inject SDK

## 3. Example Plugin

- [ ] 3.1 Create `examples/plugins/hello-plugin.js` — minimal custom element with Shadow DOM that reads `this.hostSDK.getToken()` in `connectedCallback` and emits an event on click
