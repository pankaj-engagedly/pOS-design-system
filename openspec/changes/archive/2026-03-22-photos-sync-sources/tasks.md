## 1. Phase A — Foundation: Data Model & Source CRUD

- [x] 1.1 Create `PhotoSource` SQLAlchemy model in `models.py` (id, user_id, provider, source_path, label, is_active, sync_status, last_sync_at, last_error, photo_count, config, created_at, updated_at) with unique constraint on (user_id, provider, source_path)
- [x] 1.2 Add `duration` (Float, nullable) and `source_removed` (Boolean, default false) columns to existing `Photo` model
- [x] 1.3 Create Alembic migration `002_create_sources_table.py` — photo_sources table + new columns on photos
- [x] 1.4 Create Pydantic schemas in `schemas.py` — `PhotoSourceCreate`, `PhotoSourceUpdate`, `PhotoSourceResponse`, `PhotoSourceList`
- [x] 1.5 Create `service_sources.py` — CRUD functions: create_source, list_sources, get_source, update_source, delete_source (does NOT delete imported photos)
- [x] 1.6 Create `routes_sources.py` — REST endpoints: GET/POST /sources, GET/PATCH/DELETE /sources/{id}, POST /sources/{id}/sync
- [x] 1.7 Mount source routes in `main.py`
- [x] 1.8 Add source API wrappers to frontend `photos-api.js` (listSources, createSource, updateSource, deleteSource, triggerSync)
- [x] 1.9 Add sources state to frontend `store.js` (sources array, loadSources, selected source)
- [x] 1.10 Add "Sources" section to `pos-photos-sidebar.js` below People — show provider icon, label, photo count, sync status indicator
- [x] 1.11 Create `pos-photos-source-dialog.js` — add source dialog with provider selection (Folder / Apple Photos), path input, optional label
- [x] 1.12 Add source hover actions in sidebar — sync now, edit label, toggle active, remove
- [x] 1.13 Add "Removed from Source" smart view to sidebar (shows count of orphaned photos)

## 2. Phase B — Folder Watcher: Scanner & Scheduler

- [x] 2.1 Create `service_sync.py` with `FolderSyncProvider` class — walk directory recursively, filter by supported extensions (jpg, jpeg, png, heic, heif, webp, tiff, tif, gif, bmp, mp4, mov, avi, mkv, m4v), skip hidden files/`.DS_Store`/`Thumbs.db`/`@eaDir`
- [x] 2.2 Implement incremental sync in `FolderSyncProvider` — only scan files with mtime newer than `last_sync_at` minus 60s buffer
- [x] 2.3 Implement two-level dedup in sync pipeline — source_id match (relative path) then SHA-256 file_hash match
- [x] 2.4 Implement file import — copy to pOS storage, create Photo record with `source_type="folder"` and `source_id` = relative path, queue thumbnail/EXIF processing
- [x] 2.5 Implement orphan detection for folders — check if previously-imported files still exist at source path, set `source_removed=true` for missing, `false` for restored
- [x] 2.6 Create `scheduler.py` — APScheduler setup with 5-minute interval, iterate active sources where `sync_status != "syncing"`, start sync per source
- [x] 2.7 Add per-source sync locking — set `sync_status="syncing"` before sync, update to `"idle"` on success or `"error"` on failure with `last_error`
- [x] 2.8 Integrate scheduler into `main.py` lifespan (start on startup, graceful stop on shutdown)
- [x] 2.9 Implement manual sync trigger — POST `/sources/{id}/sync` returns 202, starts sync if not already syncing
- [x] 2.10 Update `last_sync_at` and `photo_count` on sync completion
- [x] 2.11 Frontend: sync status indicators — grey dot (idle), blue spinner (syncing), red dot with error tooltip (error), relative time display ("Synced 3m ago")
- [x] 2.12 Frontend: wire "sync now" button to POST `/sources/{id}/sync`, update status indicator

## 3. Phase C — Video Support

- [x] 3.1 Create `video_processor.py` — extract thumbnail frame at 1s (or first frame if < 1s) using `ffmpeg -ss 1 -vframes 1`
- [x] 3.2 Implement video metadata extraction via `ffprobe` — duration, width, height, content_type (video/mp4, video/quicktime, etc.)
- [x] 3.3 Generate sm/md/lg thumbnails from extracted video frame (reuse existing thumbnail pipeline)
- [x] 3.4 Extend image processor pipeline to detect video files by content_type and route to video_processor
- [x] 3.5 Handle missing ffmpeg gracefully — check on startup, log warning, import video with `processing_status="error"` and note about missing ffmpeg
- [x] 3.6 Store `duration` on Photo record for video files
- [x] 3.7 Frontend: video duration badge on grid cards (bottom-left or bottom-right overlay)

## 4. Phase D — Apple Photos Library

- [x] 4.1 Create `ApplePhotosSyncProvider` class in `service_sync.py` — read library via `osxphotos`, validate path ends with `.photoslibrary`
- [x] 4.2 Import photos with `source_type="apple_photos"` and `source_id` = Apple Photos UUID, import edited version as primary
- [x] 4.3 Map Apple albums to pOS albums — create/find Album with `album_type="apple_sync"`, add photo membership
- [x] 4.4 Map Apple keywords to pOS tags via shared `tag_service`
- [x] 4.5 Map Apple scene labels to tags with `auto:` prefix (e.g., `auto:beach`, `auto:sunset`)
- [x] 4.6 Map Apple people/faces to pOS Person records — create if not exists, link via photo_people
- [x] 4.7 Map Apple favourites — set `is_favourite=true` on Photo record
- [x] 4.8 Use Apple's `taken_at` date and GPS coordinates (latitude, longitude) over raw EXIF
- [x] 4.9 Implement orphan detection for Apple Photos — check if UUID still exists in library, set `source_removed` flag
- [x] 4.10 Handle `osxphotos` not installed — graceful degradation: log warning, disable `apple_photos` provider, expose availability via API
- [x] 4.11 Frontend: conditionally show/hide Apple Photos option in add source dialog based on backend provider availability
