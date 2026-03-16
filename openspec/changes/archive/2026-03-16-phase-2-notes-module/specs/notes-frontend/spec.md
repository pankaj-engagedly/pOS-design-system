## ADDED Requirements

### Requirement: Notes module store manages application state

The notes module SHALL have a reactive store at `frontend/modules/notes/store.js` using `createStore()`. The store SHALL hold: `folders` (array), `selectedFolderId` (string|null), `selectedView` (string — "all", "pinned", "trash"), `notes` (array — current view's notes), `selectedNoteId` (string|null), `selectedNote` (object|null — full note with content), `viewMode` ("list"|"grid"), `searchQuery` (string), `loading` (boolean), `error` (string|null).

#### Scenario: Store initializes with default state
- **WHEN** the notes module loads
- **THEN** the store has `selectedView: "all"`, `viewMode: "list"`, `folders: []`, `notes: []`, `loading: false`

#### Scenario: Store notifies subscribers on state change
- **WHEN** `setState({ folders: [...] })` is called
- **THEN** all subscribers are notified with the updated state

### Requirement: Notes API service wraps all backend endpoints

The notes module SHALL have an API service at `frontend/modules/notes/services/notes-api.js` that wraps all notes backend endpoints using the shared `apiFetch()` client.

#### Scenario: getFolders returns folder list
- **WHEN** `getFolders()` is called
- **THEN** it makes `GET /api/notes/folders` and returns the folder array

#### Scenario: createNote sends note data
- **WHEN** `createNote({ title, content, folder_id, color })` is called
- **THEN** it makes `POST /api/notes/notes` with the JSON body and returns the created note

#### Scenario: updateNote sends partial update
- **WHEN** `updateNote(id, { title, content })` is called
- **THEN** it makes `PATCH /api/notes/notes/:id` with only the changed fields

#### Scenario: deleteNote performs soft delete
- **WHEN** `deleteNote(id)` is called
- **THEN** it makes `DELETE /api/notes/notes/:id`

#### Scenario: searchNotes sends query
- **WHEN** `searchNotes(query)` is called
- **THEN** it makes `GET /api/notes/notes?search=:query` and returns matching notes

#### Scenario: getNotes supports filtering
- **WHEN** `getNotes({ folder_id, is_pinned, is_deleted, tag })` is called
- **THEN** it makes `GET /api/notes/notes` with the appropriate query parameters

### Requirement: Notes app page orchestrates three-panel layout

The `pos-notes-app` page component SHALL render a three-panel layout: folder sidebar (left), note list (middle), note editor (right). It SHALL use `ui-app-layout` or custom CSS grid for the panel arrangement. It SHALL subscribe to the notes store and re-render on state changes.

#### Scenario: Page renders three panels
- **WHEN** `<pos-notes-app>` is connected to the DOM
- **THEN** three panels are visible: folder sidebar, note list, and note editor area

#### Scenario: Page loads folders and notes on mount
- **WHEN** the notes page is first loaded
- **THEN** it fetches folders from the API and loads notes for the default view ("All Notes")

#### Scenario: Selecting a folder filters notes
- **WHEN** a user clicks a folder in the sidebar
- **THEN** the store updates with `selectedFolderId` and `selectedView: null`
- **AND** notes are fetched filtered by that folder

#### Scenario: Selecting a smart view filters notes
- **WHEN** a user clicks "All Notes", "Pinned", or "Trash" in the sidebar
- **THEN** the store updates with the selected view
- **AND** notes are fetched with appropriate filters

#### Scenario: Selecting a note loads its content
- **WHEN** a user clicks a note in the list
- **THEN** the full note (with content) is fetched from `GET /api/notes/notes/:id`
- **AND** the editor panel displays the note for editing

#### Scenario: Selection persists across visits
- **WHEN** the user returns to the notes module
- **THEN** the last selected folder/view is restored from localStorage

### Requirement: Folder sidebar component with smart views

The `pos-folder-sidebar` component SHALL display smart views ("All Notes", "Pinned", "Trash") at the top, followed by user-created folders, and a "New Folder" button at the bottom. It SHALL highlight the active selection. It SHALL show note counts per folder.

#### Scenario: Smart views are always present
- **WHEN** the sidebar renders
- **THEN** "All Notes", "Pinned", and "Trash" views are displayed at the top

#### Scenario: User folders are listed below smart views
- **WHEN** the user has folders "Work" and "Personal"
- **THEN** they appear below the smart views, ordered by position

#### Scenario: Creating a folder
- **WHEN** the user clicks "New Folder" and enters a name
- **THEN** a `folder-create` custom event is dispatched with the folder name

#### Scenario: Deleting a folder
- **WHEN** the user right-clicks or uses a context action on a folder and selects delete
- **THEN** a `folder-delete` custom event is dispatched with the folder id

#### Scenario: Renaming a folder
- **WHEN** the user double-clicks a folder name
- **THEN** the name becomes editable inline
- **AND** on blur or Enter, a `folder-rename` custom event is dispatched

#### Scenario: Note count is displayed per folder
- **WHEN** folders are rendered
- **THEN** each folder shows its note count as a badge

### Requirement: Note list component with list and grid views

The `pos-note-list` component SHALL display notes in either list or grid layout, controlled by a `view-mode` attribute ("list" or "grid"). It SHALL include a toolbar with: search input, view mode toggle, sort options, and a "New Note" button.

#### Scenario: List view renders note rows
- **WHEN** `view-mode="list"` is set
- **THEN** notes are rendered as rows showing title, preview_text (truncated), date, and pin indicator

#### Scenario: Grid view renders note cards
- **WHEN** `view-mode="grid"` is set
- **THEN** notes are rendered as cards in a responsive grid showing title, preview excerpt, color, and pin indicator

#### Scenario: Pinned notes appear first
- **WHEN** notes are displayed in any view mode
- **THEN** pinned notes appear at the top, visually distinguished (pin icon)

#### Scenario: Search filters notes in real-time
- **WHEN** the user types in the search input
- **THEN** after a 300ms debounce, the search query is sent to the API
- **AND** results replace the current note list

#### Scenario: View mode toggle
- **WHEN** the user clicks the list/grid toggle button
- **THEN** the view switches between list and grid layouts
- **AND** the preference is persisted in localStorage

#### Scenario: New Note button creates a note
- **WHEN** the user clicks "New Note"
- **THEN** a `note-create` custom event is dispatched
- **AND** the page creates a new empty note in the current folder and opens it in the editor

### Requirement: Note list item component for list view

The `pos-note-list-item` component SHALL render a single note as a compact row with: title (bold), preview_text (truncated, muted), date (relative — "2 hours ago", "Yesterday"), pin icon if pinned, and color indicator stripe.

#### Scenario: Renders note information
- **WHEN** the component receives note data via attributes
- **THEN** it displays the title, preview text, and relative date

#### Scenario: Click selects the note
- **WHEN** the user clicks the list item
- **THEN** a `note-select` custom event is dispatched with the note id

#### Scenario: Active state is visually distinct
- **WHEN** the note is the currently selected note
- **THEN** the list item has an active/highlighted style

### Requirement: Note card component for grid view

The `pos-note-card` component SHALL render a note as a card using `ui-card`, showing: title, preview excerpt (3-4 lines), color as background tint, pin icon, and tag badges. Cards SHALL have a fixed aspect ratio for consistent grid layout.

#### Scenario: Card displays note preview
- **WHEN** the component receives note data
- **THEN** it shows the title, up to 4 lines of preview text, and any tags as badges

#### Scenario: Card reflects note color
- **WHEN** the note has a color set (e.g., "yellow")
- **THEN** the card has a subtle background tint matching that color

#### Scenario: Click selects the note
- **WHEN** the user clicks the card
- **THEN** a `note-select` custom event is dispatched with the note id

### Requirement: Rich text editor component wrapping Tiptap

The `pos-note-editor` component SHALL wrap a Tiptap editor instance inside its Shadow DOM. It SHALL accept note data (title + content JSON) and emit changes. It SHALL include a title input field above the editor area.

#### Scenario: Editor initializes with note content
- **WHEN** a note is passed to the editor (via property or attribute)
- **THEN** the title input is populated with the note's title
- **AND** the Tiptap editor is initialized with the note's content JSON

#### Scenario: Editor initializes empty for new notes
- **WHEN** no note is selected or a new note is created
- **THEN** the title input is empty with placeholder "Untitled"
- **AND** the editor area is empty with placeholder "Start writing..."

#### Scenario: Content changes emit update events
- **WHEN** the user edits the note content
- **THEN** after a 500ms debounce, a `note-content-change` custom event is dispatched
- **AND** the event detail includes `{ title, content }` where content is Tiptap JSON

#### Scenario: Title changes emit update events
- **WHEN** the user edits the title
- **THEN** after a 500ms debounce, a `note-title-change` custom event is dispatched

#### Scenario: Editor supports paste
- **WHEN** the user pastes HTML content (e.g., from a webpage)
- **THEN** Tiptap converts it to its document format and inserts it at the cursor

#### Scenario: Editor displays empty state when no note selected
- **WHEN** no note is selected
- **THEN** the editor panel shows a placeholder message "Select a note or create a new one"

### Requirement: Editor toolbar for text formatting

The `pos-note-toolbar` component SHALL display formatting buttons for: Bold, Italic, Strikethrough, Heading (H1, H2, H3), Bullet List, Ordered List, Code, Code Block, Blockquote, Horizontal Rule, and Link. Active formats SHALL be visually highlighted.

#### Scenario: Toolbar reflects active formatting
- **WHEN** the cursor is inside bold text
- **THEN** the Bold button is visually active (highlighted)

#### Scenario: Clicking a format button toggles formatting
- **WHEN** the user clicks the Bold button
- **THEN** a `toolbar-action` custom event is dispatched with `{ action: "toggleBold" }`
- **AND** the editor toggles bold on the selection

#### Scenario: Heading dropdown allows level selection
- **WHEN** the user clicks the Heading button
- **THEN** options for H1, H2, H3, and normal paragraph are shown
- **AND** selecting one applies that heading level

### Requirement: Note actions (pin, color, move, delete)

The notes page SHALL support note management actions accessible from the note list (context menu or action buttons) and the editor panel.

#### Scenario: Pin/unpin a note
- **WHEN** the user toggles the pin action on a note
- **THEN** the note's `is_pinned` is toggled via `PATCH /api/notes/notes/:id`
- **AND** the note list re-sorts with pinned notes first

#### Scenario: Change note color
- **WHEN** the user selects a color from the color picker
- **THEN** the note's `color` is updated via `PATCH /api/notes/notes/:id`
- **AND** the note card/list item reflects the new color

#### Scenario: Move note to folder
- **WHEN** the user moves a note to a different folder
- **THEN** the note's `folder_id` is updated via `PATCH /api/notes/notes/:id`
- **AND** the note disappears from the current folder view if viewing a specific folder

#### Scenario: Delete note (to trash)
- **WHEN** the user deletes a note
- **THEN** the note is soft-deleted via `DELETE /api/notes/notes/:id`
- **AND** the note disappears from the current view

#### Scenario: Restore note from trash
- **WHEN** the user restores a note from the trash view
- **THEN** `POST /api/notes/notes/:id/restore` is called
- **AND** the note reappears in "All Notes"

#### Scenario: Permanently delete from trash
- **WHEN** the user permanently deletes a note from trash
- **THEN** a confirmation dialog is shown
- **AND** on confirm, `DELETE /api/notes/notes/:id/permanent` is called

### Requirement: Auto-save on edit

The notes page SHALL auto-save note changes. When the user edits a note's title or content, the changes SHALL be sent to the API after a debounce period (500ms for content, 500ms for title). There SHALL be a visual indicator showing save status (saving, saved, error).

#### Scenario: Content auto-saves after debounce
- **WHEN** the user stops typing in the editor for 500ms
- **THEN** the updated content is sent via `PATCH /api/notes/notes/:id`

#### Scenario: Save indicator shows status
- **WHEN** a save is in progress
- **THEN** a "Saving..." indicator is shown
- **AND** when complete, it changes to "Saved" with a timestamp

#### Scenario: Save error is shown
- **WHEN** a save request fails
- **THEN** an "Error saving" indicator is shown
- **AND** the save is retried on the next edit

### Requirement: Tag management in the editor

The note editor panel SHALL include a tag area below the toolbar where existing tags are shown as removable badges and new tags can be added via an input field.

#### Scenario: Tags are displayed as badges
- **WHEN** a note has tags
- **THEN** they are displayed as `ui-tag` components below the toolbar

#### Scenario: Adding a tag
- **WHEN** the user types a tag name and presses Enter
- **THEN** `POST /api/notes/notes/:id/tags` is called with the tag name
- **AND** the tag appears in the tag area

#### Scenario: Removing a tag
- **WHEN** the user clicks the remove button on a tag badge
- **THEN** `DELETE /api/notes/notes/:id/tags/:tag_id` is called
- **AND** the tag is removed from the display
