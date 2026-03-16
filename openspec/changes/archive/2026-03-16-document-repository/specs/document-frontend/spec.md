## ADDED Requirements

### Requirement: Documents module with routing

The frontend documents module SHALL be located at `frontend/modules/documents/` and SHALL register routes: `#/documents` (main page), `#/documents/shared` (shared with me), `#/documents/recent` (recent documents). The module SHALL be loaded dynamically by the app shell.

#### Scenario: Navigate to documents
- **WHEN** a user clicks "Documents" in the sidebar
- **THEN** the app navigates to `#/documents` and renders the documents page

#### Scenario: Navigate to shared documents
- **WHEN** a user clicks "Shared with me"
- **THEN** the app navigates to `#/documents/shared` and renders the shared documents page

### Requirement: Documents main page with folder tree

The documents main page SHALL display a folder tree sidebar on the left and a document list on the right. Clicking a folder in the tree SHALL filter the document list to show only documents in that folder. The root view (no folder selected) SHALL show all documents.

#### Scenario: Folder tree displays user's folders
- **WHEN** the documents page loads
- **THEN** the folder tree shows all root-level folders, expandable to show children

#### Scenario: Select folder filters documents
- **WHEN** a user clicks the "Insurance" folder in the tree
- **THEN** the document list updates to show only documents in the Insurance folder

### Requirement: Document upload flow

The documents module SHALL support file upload via a dedicated upload area. The upload flow SHALL be: (1) user selects or drops files, (2) frontend uploads to attachments service, (3) frontend creates document record in documents service with the returned attachment_id. Progress indication SHALL be shown during upload.

#### Scenario: Upload via file picker
- **WHEN** a user clicks the upload button and selects a file
- **THEN** the file is uploaded to the attachments service, a document record is created, and the document appears in the current folder

#### Scenario: Upload via drag and drop
- **WHEN** a user drags a file onto the document list area
- **THEN** the same upload flow is triggered with the dropped file

#### Scenario: Upload progress
- **WHEN** a file is uploading
- **THEN** a progress indicator is shown until the upload completes

### Requirement: Document list with grid and list views

The document list SHALL support both list view (table with columns: name, type, size, date) and grid view (card tiles with icon and name). A toggle SHALL allow switching between views. The selected view SHALL persist.

#### Scenario: List view shows document details
- **WHEN** the user is in list view
- **THEN** documents are displayed as rows with name, content type icon, file size, and last modified date

#### Scenario: Grid view shows document cards
- **WHEN** the user is in grid view
- **THEN** documents are displayed as cards with a file type icon and name

#### Scenario: View toggle persists
- **WHEN** a user switches from list view to grid view
- **THEN** the preference is saved and maintained on next visit

### Requirement: Document actions

Each document SHALL support context actions: rename, move to folder, add/remove tags, share, download, and delete. Actions SHALL be accessible via a context menu or action buttons.

#### Scenario: Rename document
- **WHEN** a user renames a document from "scan.pdf" to "Insurance Policy 2025.pdf"
- **THEN** the document name is updated via PATCH and the list refreshes

#### Scenario: Move document to folder
- **WHEN** a user moves a document to a different folder
- **THEN** a folder picker dialog appears, the user selects a folder, and the document is moved

#### Scenario: Download document
- **WHEN** a user clicks download on a document
- **THEN** the file is downloaded from the attachments service

#### Scenario: Delete document
- **WHEN** a user deletes a document
- **THEN** a confirmation dialog appears, and on confirm the document and attachment are deleted

### Requirement: Sharing dialog

A sharing dialog SHALL allow users to share documents or folders by entering an email address. The dialog SHALL show current shares and allow revoking them.

#### Scenario: Share a document
- **WHEN** a user opens the share dialog for a document and enters an email
- **THEN** the share is created and the recipient's email appears in the shared list

#### Scenario: Revoke share
- **WHEN** a user clicks "Remove" next to a shared email in the dialog
- **THEN** the share is revoked

### Requirement: Shared with me page

The shared-with-me page SHALL list all documents and folders shared with the current user, grouped by who shared them. Shared documents SHALL be downloadable but not editable.

#### Scenario: View shared documents
- **WHEN** a user navigates to #/documents/shared
- **THEN** they see documents and folders shared with them, grouped by sharer name

### Requirement: Recent documents page

The recent documents page SHALL show the user's most recently accessed documents, ordered by last access time.

#### Scenario: View recent documents
- **WHEN** a user navigates to #/documents/recent
- **THEN** they see up to 20 recently accessed documents ordered newest first

### Requirement: Tag management in documents

The documents module SHALL allow adding and removing tags on documents. A tag filter SHALL be available in the sidebar or toolbar to filter the document list by tag.

#### Scenario: Add tag to document
- **WHEN** a user adds a tag "tax-2025" to a document
- **THEN** the tag is created (if new) and associated with the document

#### Scenario: Filter by tag
- **WHEN** a user clicks a tag in the sidebar filter
- **THEN** the document list filters to show only documents with that tag

### Requirement: Documents store and API service

The documents module SHALL have a store (`store.js`) managing local state (current folder, documents list, folders tree, view mode) and an API service (`services/documents-api.js`) wrapping all HTTP calls to the documents and attachments services.

#### Scenario: Store tracks current folder
- **WHEN** a user navigates into a folder
- **THEN** the store updates currentFolderId and triggers a document list refresh

#### Scenario: API service handles upload flow
- **WHEN** the upload function is called with a file
- **THEN** it uploads to attachments, creates the document record, and returns the combined result
