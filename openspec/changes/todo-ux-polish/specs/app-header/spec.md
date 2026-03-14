## ADDED Requirements

### Requirement: App header renders top bar
The app shell SHALL render a top header bar above the main content area. The header SHALL contain the app name/logo on the left, a search input in the center, and user profile with settings on the right.

#### Scenario: Header visible when authenticated
- **WHEN** user is logged in
- **THEN** the header bar SHALL be visible at the top of the viewport
- **AND** it SHALL span the full width of the viewport

#### Scenario: Header hidden when not authenticated
- **WHEN** user is on the login/register page
- **THEN** the header bar SHALL NOT be visible

### Requirement: Header user section
The header SHALL display the user's name/email and a logout button on the right side, replacing the sidebar user section.

#### Scenario: User info displayed
- **WHEN** user is logged in
- **THEN** the header SHALL show the user's name or email
- **AND** a logout button SHALL be available

#### Scenario: Logout from header
- **WHEN** user clicks the logout button in the header
- **THEN** the user SHALL be logged out and redirected to login

### Requirement: Header search placeholder
The header SHALL contain a search input in the center area. This is a placeholder for future search functionality.

#### Scenario: Search input visible
- **WHEN** user is logged in
- **THEN** a search input with placeholder text SHALL be visible in the header
