## MODIFIED Requirements

### Requirement: App shell layout with header
The app shell SHALL render a top header bar, a collapsible sidebar, and main content area. The layout SHALL be: header on top spanning full width, sidebar on the left below the header, main content filling the remainder.

#### Scenario: Authenticated layout
- **WHEN** user is logged in
- **THEN** the layout SHALL show header (top), sidebar (left), and content (right)
- **AND** the sidebar SHALL be collapsible

#### Scenario: Unauthenticated layout
- **WHEN** user is not logged in
- **THEN** only the content area SHALL be visible (no header, no sidebar)

### Requirement: User section moved to header
The user name and logout button SHALL be in the top header bar, not in the sidebar footer.

#### Scenario: No user section in sidebar
- **WHEN** the app renders
- **THEN** the sidebar SHALL NOT contain user name or logout button
- **AND** those elements SHALL be in the header instead

### Requirement: Sidebar selected state improvement
The active/selected navigation item SHALL use a more visually distinct highlight color.

#### Scenario: Selected nav item visible
- **WHEN** a nav item is selected/active
- **THEN** it SHALL have a clearly visible background highlight
- **AND** the text color SHALL contrast well with the background
