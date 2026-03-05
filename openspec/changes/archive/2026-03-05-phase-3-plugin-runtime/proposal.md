## Why

The platform must support third-party plugins. Before building a full registry, we need to validate the minimal loading ergonomics: can we dynamically import a plugin, register its custom element, and inject a host SDK — all without a framework?

## What Changes

- Create a thin plugin loader using `dynamic import(url)`
- Create a minimal `hostSDK` with `emit(eventName, payload)` and `getToken(name)`
- SDK is injected via property assignment on the plugin element — no global state
- No manifest validation, no semver enforcement, no marketplace

## Capabilities

### New Capabilities
- `plugin-loader`: `loadPlugin(url)` function that dynamically imports a module, registers its custom element, and injects the host SDK
- `host-sdk`: Minimal SDK object with `emit()` and `getToken()` — injected as a property on the plugin element

### Modified Capabilities
<!-- None -->

## Impact

- Creates `src/plugins/loader.js`
- Creates `src/plugins/host-sdk.js`
