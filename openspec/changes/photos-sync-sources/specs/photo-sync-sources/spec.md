## ADDED Requirements

### Requirement: Source CRUD management
The system SHALL allow users to create, list, update, and delete photo sync sources. Each source has a provider type (`folder` or `apple_photos`), a filesystem path, an optional label, and an active/inactive toggle. The combination of (user_id, provider, source_path) MUST be unique.

#### Scenario: Add a folder source
- **WHEN** user creates a source with provider `folder` and path `/Users/pankaj/Google Drive/Photos`
- **THEN** system creates a PhotoSource record with `sync_status="idle"`, `is_active=true`, `photo_count=0`

#### Scenario: Add an Apple Photos source
- **WHEN** user creates a source with provider `apple_photos` and path `/Users/pankaj/Pictures/Photos Library.photoslibrary`
- **THEN** system creates a PhotoSource record and validates that the path ends with `.photoslibrary`

#### Scenario: Prevent duplicate sources
- **WHEN** user creates a source with the same provider and path as an existing source
- **THEN** system returns a 409 conflict error

#### Scenario: Update source label and active status
- **WHEN** user patches a source with `label="Family Photos"` and `is_active=false`
- **THEN** system updates the source record and the scheduler stops syncing this source

#### Scenario: Delete a source
- **WHEN** user deletes a source
- **THEN** system removes the PhotoSource record but does NOT delete any photos that were imported from this source

#### Scenario: List sources with status
- **WHEN** user requests the source list
- **THEN** system returns all sources with their current `sync_status`, `last_sync_at`, `photo_count`, and `last_error`

---

### Requirement: Folder watcher sync
The system SHALL poll configured folder sources recursively, discover new image and video files, copy them into pOS storage, and process them through the standard thumbnail/metadata pipeline. Source files MUST never be modified, moved, or deleted.

#### Scenario: Discover and import new photos from a folder
- **WHEN** a sync cycle runs for a folder source containing 5 new JPEG files not yet in pOS
- **THEN** system copies each file to pOS storage, creates Photo records with `source_type="folder"` and `source_id` set to the relative file path, and queues background processing for thumbnails and EXIF extraction

#### Scenario: Skip already-imported files (source_id match)
- **WHEN** a sync cycle finds a file whose relative path matches an existing photo's `source_id` for this source
- **THEN** system skips the file without reading or hashing it

#### Scenario: Skip cross-source duplicates (file_hash match)
- **WHEN** a sync cycle finds a new file whose SHA-256 hash matches an existing photo from any source
- **THEN** system skips the file (does not create a duplicate Photo record)

#### Scenario: Supported file types
- **WHEN** a sync cycle scans a folder
- **THEN** system discovers files with extensions: jpg, jpeg, png, heic, heif, webp, tiff, tif, gif, bmp, mp4, mov, avi, mkv, m4v (case-insensitive)
- **AND** ignores files starting with `.` (hidden files), files named `Thumbs.db` or `.DS_Store`, and directories named `@eaDir`

#### Scenario: Nested subdirectories
- **WHEN** a folder source contains nested subdirectories
- **THEN** system scans all subdirectories recursively, using the relative path from the source root as the `source_id`

#### Scenario: Incremental sync via modification time
- **WHEN** a sync cycle runs and `last_sync_at` is set on the source
- **THEN** system only considers files with a filesystem modification time newer than `last_sync_at` (minus a 60-second buffer for clock skew)

---

### Requirement: Apple Photos Library sync
The system SHALL read macOS Photos Library packages via the `osxphotos` Python library, importing photos/videos with their Apple metadata (albums, keywords, people, favourites, scene labels). The library MUST be read in read-only mode — no modifications to the Photos database.

#### Scenario: Import photos with Apple metadata
- **WHEN** a sync cycle runs for an Apple Photos source
- **THEN** system reads the library via osxphotos, imports each photo's original file into pOS storage, and creates a Photo record with `source_type="apple_photos"` and `source_id` set to the Apple Photos UUID

#### Scenario: Map Apple albums to pOS albums
- **WHEN** an imported photo belongs to Apple album "Vacation 2025"
- **THEN** system creates (or finds existing) a pOS Album with `name="Vacation 2025"`, `album_type="apple_sync"`, and adds the photo to it

#### Scenario: Map Apple keywords to pOS tags
- **WHEN** an imported photo has Apple keywords ["travel", "paris"]
- **THEN** system adds tags "travel" and "paris" to the photo via the shared tag_service

#### Scenario: Map Apple scene labels to auto-prefixed tags
- **WHEN** an imported photo has Apple scene labels ["beach", "sunset"]
- **THEN** system adds tags "auto:beach" and "auto:sunset" to the photo

#### Scenario: Map Apple people to pOS people
- **WHEN** an imported photo has Apple person tags ["Alice", "Bob"]
- **THEN** system creates (or finds existing) Person records named "Alice" and "Bob" and links them to the photo via photo_people

#### Scenario: Map Apple favourites
- **WHEN** an imported photo is marked as favourite in Apple Photos
- **THEN** system sets `is_favourite=true` on the pOS Photo record

#### Scenario: Use Apple's date and GPS data
- **WHEN** an imported photo has date and GPS info from Apple Photos
- **THEN** system uses Apple's `taken_at` date and GPS coordinates (which may be more accurate than raw EXIF, especially for edited photos)

#### Scenario: Import edited version
- **WHEN** an Apple photo has an edited version
- **THEN** system imports the edited version as the primary photo file

#### Scenario: Graceful degradation when osxphotos unavailable
- **WHEN** the `osxphotos` package is not installed
- **THEN** system logs a warning at startup, disables the `apple_photos` provider, and the frontend hides the Apple Photos option in the add source dialog

---

### Requirement: Video file processing
The system SHALL extract thumbnails and metadata from video files using `ffmpeg`/`ffprobe` subprocess calls. Video files MUST be processed through the same pipeline as images (dedup, storage, thumbnail generation).

#### Scenario: Extract video thumbnail
- **WHEN** a video file (MP4, MOV, etc.) is imported
- **THEN** system extracts a frame at 1 second (or the first frame if video is shorter than 1 second) and generates sm/md/lg thumbnails from that frame

#### Scenario: Extract video metadata
- **WHEN** a video file is processed
- **THEN** system extracts and stores: `duration` (seconds), `width`, `height`, and `content_type` (e.g., `video/mp4`)

#### Scenario: Video without ffmpeg
- **WHEN** `ffmpeg` is not found on the system PATH
- **THEN** system logs a warning, imports the video file (creates Photo record with correct content_type), but does NOT generate thumbnails — the photo record has `processing_status="error"` with a note about missing ffmpeg

#### Scenario: Video content type detection
- **WHEN** a file with a video extension is imported
- **THEN** system sets `content_type` to the appropriate MIME type (video/mp4, video/quicktime, video/x-msvideo, video/x-matroska, video/x-m4v)

---

### Requirement: Sync scheduler
The system SHALL run a background scheduler that polls all active sources every 5 minutes. Each source syncs independently. The scheduler MUST prevent overlapping sync cycles for the same source.

#### Scenario: Scheduled sync cycle
- **WHEN** the 5-minute interval fires
- **THEN** scheduler iterates all sources where `is_active=true` and `sync_status != "syncing"`, and starts a sync task for each

#### Scenario: Prevent overlapping syncs
- **WHEN** a sync cycle starts for a source
- **THEN** system sets `sync_status="syncing"` on the source record
- **AND** if the scheduler fires again before sync completes, it skips that source

#### Scenario: Sync completion updates
- **WHEN** a sync cycle completes successfully
- **THEN** system updates the source with `sync_status="idle"`, `last_sync_at` to current time, and `photo_count` to total photos imported from this source

#### Scenario: Sync error handling
- **WHEN** a sync cycle fails with an exception
- **THEN** system sets `sync_status="error"`, stores the error message in `last_error`, and logs the full traceback
- **AND** the source is retried on the next scheduled cycle

#### Scenario: Manual sync trigger
- **WHEN** user sends POST to `/api/photos/sources/{id}/sync`
- **THEN** system starts an immediate sync for that source (if not already syncing) and returns 202 Accepted

#### Scenario: Scheduler lifecycle
- **WHEN** the photos service starts up
- **THEN** the APScheduler is initialized and begins polling
- **WHEN** the photos service shuts down
- **THEN** the scheduler is gracefully stopped

---

### Requirement: Orphan detection
The system SHALL detect when a previously-imported photo no longer exists at its source and mark it with `source_removed=true`. Orphaned photos MUST NOT be automatically deleted.

#### Scenario: Folder source file deleted
- **WHEN** a sync cycle runs and a previously-imported file no longer exists at its source path in the folder
- **THEN** system sets `source_removed=true` on the Photo record

#### Scenario: Apple Photos source photo deleted
- **WHEN** a sync cycle runs and a previously-imported Apple Photos UUID is no longer in the Photos library
- **THEN** system sets `source_removed=true` on the Photo record

#### Scenario: Orphaned photo restored at source
- **WHEN** a previously-orphaned photo reappears at its source (file restored, or Apple Photos undo)
- **THEN** system sets `source_removed=false` on the Photo record

#### Scenario: Orphaned photos remain accessible
- **WHEN** a photo is marked as `source_removed=true`
- **THEN** the photo and all its metadata, tags, albums, and comments remain fully accessible in pOS — only the source link is flagged

---

### Requirement: Frontend source management
The frontend SHALL provide UI for adding, viewing, and managing sync sources within the photos sidebar. Users MUST be able to monitor sync status and trigger manual syncs.

#### Scenario: Sources section in sidebar
- **WHEN** user views the photos sidebar
- **THEN** a "Sources" section appears below "People" showing all configured sources with their provider icon, label, photo count, and sync status indicator

#### Scenario: Add source dialog
- **WHEN** user clicks the add button in the Sources section
- **THEN** a dialog appears with provider selection (Folder / Apple Photos) and a text input for the filesystem path, plus an optional label field

#### Scenario: Apple Photos option hidden when unavailable
- **WHEN** the backend reports that `apple_photos` provider is unavailable (osxphotos not installed)
- **THEN** the add source dialog only shows the Folder option

#### Scenario: Sync status indicators
- **WHEN** a source has `sync_status="idle"` and `last_sync_at` is set
- **THEN** sidebar shows a grey dot and "Synced 3m ago" relative time
- **WHEN** `sync_status="syncing"`
- **THEN** sidebar shows a blue spinning indicator
- **WHEN** `sync_status="error"`
- **THEN** sidebar shows a red dot with the error message on hover

#### Scenario: Source hover actions
- **WHEN** user hovers over a source in the sidebar
- **THEN** action buttons appear: sync now, edit (rename label), toggle active, remove

#### Scenario: Manual sync trigger
- **WHEN** user clicks "sync now" on a source
- **THEN** frontend calls POST `/api/photos/sources/{id}/sync` and the status indicator changes to syncing

#### Scenario: Removed from Source smart view
- **WHEN** any photos have `source_removed=true`
- **THEN** a "Removed from Source" smart view appears in the sidebar smart views section showing the count
- **WHEN** user selects this view
- **THEN** the grid shows all orphaned photos with options to keep (clear the flag) or delete
