## ADDED Requirements

### Requirement: Dynamic plugin loading
`loadPlugin({ url, tagName })` SHALL dynamically import the module at `url`, then register its default export as a custom element with the given `tagName`.

#### Scenario: Load and register
- **WHEN** `loadPlugin({ url: './plugins/my-widget.js', tagName: 'plugin-my-widget' })` is called
- **THEN** the module SHALL be imported and its default export registered as `plugin-my-widget`

#### Scenario: Duplicate load is safe
- **WHEN** `loadPlugin()` is called twice with the same `tagName`
- **THEN** the second call SHALL skip registration without error

### Requirement: SDK injection
After loading a plugin, the loader SHALL create `<tagName>` element instances with a `hostSDK` property set to the host SDK object.

#### Scenario: SDK available on element
- **WHEN** a plugin element is created via `document.createElement(tagName)` after loading
- **THEN** the host SHALL be able to set `element.hostSDK = sdk` before appending to DOM

### Requirement: No manifest validation
The loader SHALL NOT require or validate any manifest, version, or metadata from the plugin. It only needs `url` and `tagName`.

#### Scenario: Minimal contract
- **WHEN** `loadPlugin()` is called
- **THEN** only `url` and `tagName` SHALL be required parameters
