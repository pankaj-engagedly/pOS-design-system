## ADDED Requirements

### Requirement: Media item discovery and download
The system SHALL discover media items from Google Photos using the Library API `mediaItems.list` endpoint, paginating with `pageSize=100` and `nextPageToken`. Each media item SHALL be downloaded using the `baseUrl` with `=d` suffix (photos) or `=dv` suffix (videos) and stored in pOS storage.

#### Scenario: First sync — full library import
- **WHEN** a Google Photos source is synced for the first time (no `next_page_token` or `last_sync_marker` in config)
- **THEN** the system pages through ALL media items from newest to oldest, downloads each to `data/photos/{user_id}/originals/`, computes SHA-256 hash, generates thumbnails, extracts metadata, creates Photo records with `source_type="google_photos"`, `source_id` set to Google mediaItem ID, and `source_account` set to the PhotoSource UUID

#### Scenario: Incremental sync — new photos only
- **WHEN** a Google Photos source has been synced before (has `last_sync_marker` in config)
- **THEN** the system pages through media items starting from newest, stops when it encounters a mediaItem whose ID already exists as a `source_id` in the photos table for this source, and imports only the new items

#### Scenario: Deduplication across sources
- **WHEN** a media item's downloaded file has the same SHA-256 hash as an existing photo (from any source)
- **THEN** the system skips the file copy (reuses existing storage path) but still creates the Photo record linking to the Google source

#### Scenario: Download failure for single item
- **WHEN** downloading a media item fails (network error, expired baseUrl)
- **THEN** the system logs the failure, skips that item, continues with remaining items, and does not mark the sync as failed

#### Scenario: baseUrl expired during batch
- **WHEN** a download fails with 403 and the baseUrl has expired
- **THEN** the system re-fetches the mediaItem to get a fresh baseUrl and retries the download once

### Requirement: Metadata extraction from Google Photos
The system SHALL map Google Photos metadata to pOS photo fields. This includes creation time, description, camera info, dimensions, and GPS coordinates from the mediaItem's `mediaMetadata` field.

#### Scenario: Photo with full metadata
- **WHEN** a Google mediaItem has `mediaMetadata` with `creationTime`, `width`, `height`, and `photo` sub-object (cameraMake, cameraModel, focalLength, apertureFNumber, isoEquivalent)
- **THEN** the Photo record SHALL have `taken_at` set from creationTime, `width`/`height` from dimensions, and `exif_data` populated with camera info mapped to standard EXIF field names (Model, Make, FocalLength, FNumber, ISOSpeedRatings)

#### Scenario: Video with duration
- **WHEN** a Google mediaItem has `mediaMetadata.video` with `fps` and the video file is downloaded
- **THEN** the system processes it through the existing video pipeline (ffmpeg thumbnail + ffprobe metadata) and sets the `duration` field

#### Scenario: Item with description
- **WHEN** a Google mediaItem has a non-empty `description` field
- **THEN** the Photo record's `caption` field SHALL be set to the description text

### Requirement: Album mapping
The system SHALL sync Google Photos albums to pOS albums with `album_type="google_sync"`. Album membership SHALL be maintained via `album_photos` junction records.

#### Scenario: New Google album discovered
- **WHEN** a Google Photos album exists that has no corresponding pOS album with matching name and `album_type="google_sync"` for this user
- **THEN** the system creates a new Album with the Google album's title and `album_type="google_sync"`

#### Scenario: Photo belongs to Google album
- **WHEN** a synced photo's Google mediaItem ID appears in a Google album's media items (via `mediaItems.search` with albumId)
- **THEN** the system creates an `album_photos` link between the pOS photo and the corresponding pOS album

#### Scenario: Google album renamed
- **WHEN** a Google album's title has changed since the last sync
- **THEN** the system updates the pOS album name to match (only for `album_type="google_sync"` albums)

### Requirement: Sync progress and checkpointing
The system SHALL save sync progress after each page of results so that interrupted syncs can resume without re-processing.

#### Scenario: Sync interrupted mid-page
- **WHEN** a sync is interrupted (service restart, error) after processing some pages
- **THEN** the next sync starts from the last saved `next_page_token` in the source config, not from the beginning

#### Scenario: Page processed successfully
- **WHEN** a page of media items has been fully processed (all items downloaded or skipped)
- **THEN** the system updates `config.next_page_token` with the API's nextPageToken and commits the transaction

#### Scenario: All pages processed
- **WHEN** the API returns no `nextPageToken` (last page reached)
- **THEN** the system sets `config.next_page_token` to null, updates `config.last_sync_marker` to the most recent mediaItem's creation time, and marks the sync as complete (status "idle")

### Requirement: Rate limiting and quota management
The system SHALL respect Google Photos API rate limits and handle quota exhaustion gracefully.

#### Scenario: Rate limited by Google (429)
- **WHEN** a Google API request returns HTTP 429
- **THEN** the system waits with exponential backoff (1s, 2s, 4s) and retries up to 3 times before giving up on that request

#### Scenario: Quota exhausted for the day
- **WHEN** rate limit retries are exhausted
- **THEN** the system saves current progress (page token), sets sync_status to "idle" (not "error"), and logs "API quota reached — will resume next cycle"

### Requirement: Scheduler integration
The Google Photos provider SHALL integrate with the existing APScheduler poll cycle. The scheduler SHALL dispatch to the Google sync function when `source.provider == "google_photos"`.

#### Scenario: Scheduler polls Google source
- **WHEN** the 5-minute scheduler runs and finds an active Google Photos source with sync_status != "syncing"
- **THEN** the scheduler calls the Google sync function, which checks/refreshes tokens and runs the incremental sync

#### Scenario: Source paused
- **WHEN** a Google Photos source has `is_active=False`
- **THEN** the scheduler skips it (existing behavior, no change needed)
