## ADDED Requirements

### Requirement: Two-panel vault layout
The frontend SHALL display the vault in a two-panel layout: left panel contains a tag sidebar and vault item list; right panel shows the selected item's detail view with fields.

#### Scenario: Initial load
- **WHEN** user navigates to `#/vault`
- **THEN** the left panel shows all vault items (favorites first) and the right panel shows an empty state prompt

#### Scenario: Select item
- **WHEN** user clicks a vault item in the list
- **THEN** the right panel shows the item's name, description, tags, and all fields

### Requirement: Vault item list
The frontend SHALL display vault items in a scrollable list showing item name, icon, tag badges, and field count. The list supports filtering by tag (clicking a tag in the sidebar) and searching by name.

#### Scenario: Filter by tag
- **WHEN** user clicks "banks" tag in the sidebar
- **THEN** the item list shows only items tagged with "banks"

#### Scenario: Search
- **WHEN** user types "kotak" in the search input
- **THEN** the item list filters to show only items matching "kotak"

#### Scenario: Create new item
- **WHEN** user clicks the "+" button in the item list header
- **THEN** a new vault item is created with a default name and the detail panel opens for editing

### Requirement: Inline field editing
The frontend SHALL allow users to add, edit, and delete fields directly in the item detail view without a separate edit mode. Each field row shows the field name, value (masked for secrets), type indicator, and action buttons.

#### Scenario: Add field
- **WHEN** user clicks "Add Field" in the detail panel
- **THEN** a new row appears with inputs for field name, value, and type selector

#### Scenario: Edit field value
- **WHEN** user clicks on a field value
- **THEN** the value becomes editable inline; on blur or Enter, the change is saved

#### Scenario: Delete field
- **WHEN** user clicks the delete button on a field row
- **THEN** the field is removed after confirmation

### Requirement: Secret field handling
The frontend SHALL mask secret field values by default, showing `••••••••`. Users can reveal the value with a toggle button, and copy the value to clipboard without revealing it visually.

#### Scenario: Reveal secret
- **WHEN** user clicks the eye icon on a secret field
- **THEN** the system calls the reveal API and shows the plaintext value temporarily

#### Scenario: Copy secret to clipboard
- **WHEN** user clicks the copy icon on a secret field
- **THEN** the system calls the reveal API, copies the plaintext to clipboard, and shows a brief "Copied!" confirmation without revealing the value on screen

### Requirement: Tag management in detail view
The frontend SHALL allow users to add and remove tags from the selected vault item directly in the detail view.

#### Scenario: Add tag
- **WHEN** user types a tag name in the tag input and presses Enter
- **THEN** the tag is added to the item and appears as a badge

#### Scenario: Remove tag
- **WHEN** user clicks the × on a tag badge
- **THEN** the tag association is removed from the item

### Requirement: Item deletion
The frontend SHALL allow users to delete a vault item with confirmation.

#### Scenario: Delete item
- **WHEN** user clicks "Delete" in the item detail and confirms
- **THEN** the item is deleted and the detail panel returns to empty state
