## ADDED Requirements

### Requirement: HTML entry point loads design system and app shell

The `frontend/shell/index.html` SHALL load the design system bundle and the app shell module. It SHALL include a `<pos-app-shell>` custom element as the root of the application.

#### Scenario: Entry point renders app shell
- **WHEN** a browser navigates to the frontend dev server root (`/`)
- **THEN** the page loads `pos-design-system.js` and `app-shell.js`
- **AND** a `<pos-app-shell>` element is rendered in the document body

### Requirement: App shell provides layout with sidebar and content area

The `<pos-app-shell>` Web Component SHALL render a layout with a collapsible sidebar navigation on the left and a content area on the right. The sidebar SHALL display navigation links for all planned modules: Todos, Notes, Knowledge Base, Vault, Feeds, Documents, Photos, and Settings.

#### Scenario: Layout renders sidebar and content
- **WHEN** the `<pos-app-shell>` element is connected to the DOM
- **THEN** a sidebar with navigation links is visible on the left
- **AND** a content area is visible on the right
- **AND** the sidebar includes links labeled: Todos, Notes, Knowledge Base, Vault, Feeds, Documents, Photos, Settings

#### Scenario: Sidebar uses design system components
- **WHEN** the sidebar renders
- **THEN** it uses `ui-button` or `ui-icon` components from the design system for navigation items

### Requirement: Hash-based client-side router

The app shell SHALL include a client-side router at `frontend/shared/services/router.js` that uses hash-based routing (e.g., `#/todos`, `#/notes`). The router SHALL map route patterns to module names and notify the app shell when the route changes.

#### Scenario: Route change updates content area
- **WHEN** the URL hash changes to `#/todos`
- **THEN** the router emits a route change event
- **AND** the app shell loads the corresponding module into the content area

#### Scenario: Default route
- **WHEN** the page loads with no hash (or `#/`)
- **THEN** the router navigates to a default route (Todos or a dashboard)

#### Scenario: Unknown route
- **WHEN** the URL hash changes to an unregistered route like `#/nonexistent`
- **THEN** the content area displays a "Page not found" message

### Requirement: Dynamic module loader

The app shell SHALL dynamically import micro-frontend modules on route activation. Each module is a JavaScript file that registers a Web Component (e.g., `<pos-todos-app>`). The loader SHALL insert the module's element into the content area and remove the previous module's element.

#### Scenario: Module loads on first navigation
- **WHEN** the user navigates to `#/todos` for the first time
- **THEN** the module loader dynamically imports `modules/todos/pages/pos-todos-app.js`
- **AND** a `<pos-todos-app>` element is inserted into the content area

#### Scenario: Module swaps on navigation
- **WHEN** the user navigates from `#/todos` to `#/notes`
- **THEN** the `<pos-todos-app>` element is removed from the content area
- **AND** the `<pos-notes-app>` element is inserted

#### Scenario: Placeholder module for unimplemented features
- **WHEN** a module has not yet been implemented
- **THEN** a placeholder component renders with the module name and "Coming soon" message

### Requirement: Global event bus for cross-module communication

The app shell SHALL provide a global event bus at `frontend/shared/services/event-bus.js`. The event bus SHALL be a shared `EventTarget` instance that modules use to communicate without direct references.

#### Scenario: Module publishes event
- **WHEN** a module dispatches a `CustomEvent` on the event bus with `detail` data
- **THEN** any other module that added a listener for that event type receives the event with the `detail` data

#### Scenario: Event bus is a singleton
- **WHEN** two different modules import the event bus
- **THEN** they receive the same `EventTarget` instance

### Requirement: Theme integration with design system

The app shell SHALL apply the design system's theming by setting the `data-pos-theme` attribute on the document root. It SHALL default to the light theme and provide a mechanism to toggle between light and dark themes.

#### Scenario: Default theme is applied
- **WHEN** the app shell loads
- **THEN** `document.documentElement` has `data-pos-theme="light"`
- **AND** design system CSS custom properties (e.g., `--pos-color-bg-primary`) resolve to light theme values

#### Scenario: Theme toggle switches theme
- **WHEN** the user activates the theme toggle in the sidebar or header
- **THEN** the `data-pos-theme` attribute toggles between `"light"` and `"dark"`
- **AND** the UI re-renders with the new theme's colors
