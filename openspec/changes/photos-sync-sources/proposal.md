## Why

Photos currently only enter pOS via manual browser upload. Real photo libraries live in Apple Photos (iCloud-synced), Google Drive folders, and local directories. To be a useful personal photo hub, pOS needs to automatically ingest from these sources — pulling in not just the files but also the organizational metadata (Apple's albums, keywords, people tags, favourites) that users have already invested effort creating. Without sync, pOS is an island; with it, it becomes the unified view across all photo sources.

## What Changes

### Sync Philosophy

- **One-way additive**: Data flows from external sources into pOS. pOS never writes back to sources.
- **Borrow and own**: Once imported, a photo and its metadata (tags, albums, people) become independent pOS entities. If the source later removes a tag or album membership, pOS keeps it — the data was borrowed at import time and is now owned by pOS.
- **Orphan detection, not auto-delete**: When a photo disappears from its source (deleted in Apple Photos, removed from a folder), pOS marks it with a `source_removed` flag rather than deleting it. These appear in a "Removed from Source" smart view where the user decides: keep in pOS or delete.
- **Source-agnostic pipeline**: Whether a file arrives via folder watcher, Apple Photos reader, upload agent, or browser upload — it enters the same processing pipeline (dedup → store → thumbnails → metadata → tag). This makes the architecture cloud-ready: folder watcher is the local-mode ingestion, a future upload agent is the cloud-mode equivalent.

### Source Management
- New `photo_sources` table to track configured sync sources (folder paths, Apple Photos library path)
- CRUD API for sources: add, list, update (label, active status), remove
- Each source has: provider type, path, label, sync status, last sync timestamp, error state

### Folder Watcher (provider: `folder`)
- Polls a configured local directory recursively on a 5-minute interval
- Discovers image and video files (JPEG, PNG, HEIC, WebP, TIFF, GIF, MP4, MOV, AVI, MKV)
- Copies new files into pOS storage (never modifies/deletes source files — read-only sync)
- SHA-256 dedup against existing photos — skips already-imported files
- Processes through existing thumbnail + EXIF pipeline
- Tags imported photos with `source_type="folder"`, `source_account="/path/to/folder"`
- Tracks last-seen file modification time for incremental sync (only scan files newer than last sync)
- Orphan detection: on each sync, checks if previously-imported files still exist at source; marks missing ones as `source_removed`
- Covers: Google Drive desktop sync folders, iCloud Drive folders, any local directory

### Apple Photos Library Reader (provider: `apple_photos`)
- Reads the macOS Photos Library package (`*.photoslibrary`) via `osxphotos` Python library
- Extracts photos/videos with full Apple metadata:
  - **Albums** → creates/updates matching pOS albums (with `album_type="apple_sync"`, `source_id` = Apple album UUID)
  - **Keywords** → maps to pOS tags via shared tag_service
  - **People/Faces** → maps to pOS people (creates Person records, links via photo_people)
  - **Favourites** → sets `is_favourite=true` on imported photos
  - **Apple scene labels** (auto-detected: "beach", "sunset", "food", etc.) → stored as tags with a prefix (e.g., `auto:beach`) to distinguish from user tags
  - **Date/GPS/EXIF** → uses Apple's metadata (often richer than raw EXIF, especially for edited photos)
- Copies originals from the library into pOS storage
- Incremental sync: tracks Apple's internal UUID per photo (`source_id`), skips already-imported
- Handles edited photos: imports the edited version (Apple stores both original and edited)
- Orphan detection: on each sync, checks if `source_id` still exists in Apple Photos database; marks missing ones as `source_removed`
- **Requires**: macOS with Photos.app and "Download Originals to this Mac" enabled in Photos preferences

### Video Support
- Extend `image_processor.py` to handle video files (MP4, MOV, AVI, MKV)
- Extract video thumbnail (first frame or frame at 1 second) using `ffmpeg` (via subprocess)
- Extract video metadata: duration, resolution, codec (via `ffprobe`)
- Videos use `content_type` starting with `video/` — frontend can distinguish for playback
- Generate thumbnail sizes (sm/md/lg) from the extracted frame
- Store video dimensions (width/height) and duration in a new `duration` column

### Sync Scheduler
- APScheduler background job polls all active sources every 5 minutes
- Per-source sync: runs independently, tracks status (`idle`/`syncing`/`error`)
- Sync progress: updates `last_sync_at`, `photo_count`, `last_error` on the source record
- Manual sync trigger via API endpoint
- Graceful: if a sync is already running for a source, skip that cycle

### Frontend: Sources Management
- New "Sources" section in photos sidebar (below People)
- Each source shows: label, provider icon, photo count, last sync time, status indicator
- "Add Source" dialog: choose provider (Folder / Apple Photos), configure path
- Per-source actions: sync now, rename label, toggle active, remove
- Sync status indicators: idle (grey), syncing (blue spinner), error (red with message)
- New "Removed from Source" smart view: shows orphaned photos, bulk keep/delete actions

### Cloud-Readiness & Mobile Vision (future, designed-for but not built now)

The long-term goal is for pOS to replace iCloud Photos and Google Photos entirely — a self-hosted photo library accessible from any device, eliminating cloud storage subscriptions.

**Progression:**
```
Phase 5 (now):  Mac local → folder watcher / Apple Photos reader → pOS (local Mac)
Phase 6:        Mac local → folder watcher → pOS (K8s on cloud)
Phase 7:        PWA / mobile app → upload API → pOS (cloud)
                ↑ replaces iCloud Photos / Google Photos entirely
```

**Upload agent (Phase 6)**: Lightweight desktop app that watches local folders and pushes to pOS via the existing upload API with source metadata. Replaces the folder watcher when pOS runs in the cloud. Same processing pipeline, different transport.

**PWA / mobile app (Phase 7)**: Progressive Web App first (camera access, background sync via service worker, home screen install). Gets 80% of native app functionality. Native mobile app later for auto-upload on WiFi — the killer feature. Same upload API either way.

**Google Photos API**: OAuth2 sync directly from cloud — no local filesystem needed. Downloads originals via API, same processing pipeline. Useful as a migration path ("import my Google Photos library into pOS").

**Object storage**: When on K8s, pOS storage moves from local disk to S3/MinIO. The sync pipeline doesn't care — it writes to a storage abstraction.

**Security hardening for cloud exposure:**
- TLS everywhere (cert-manager on K8s)
- Replace `?token=` query param image auth with signed URLs with expiry (like S3 presigned URLs)
- Rate limiting on upload endpoints
- Storage encryption at rest
- Per-device API tokens for mobile/desktop agents

**Storage economics**: A 200K photo library at ~4MB average ≈ 800GB. S3 cost: ~$18/month. Compare to iCloud 2TB ($10/month) or Google One 2TB ($10/month). Comparable cost but: you own the data, no vendor lock-in, unlimited family users, and it's your infrastructure running your rules.

## Capabilities

### New Capabilities
- `photo-sync-sources`: Source management (CRUD), folder watcher, Apple Photos library reader, sync scheduler, video processing, orphan detection, frontend sources UI

### Modified Capabilities
_(none — this extends the photos service without changing existing spec-level behaviour)_

## Impact

### Backend
- **New files**: `service_sync.py` (folder watcher + Apple reader), `video_processor.py` (ffmpeg thumbnails), `scheduler.py` (APScheduler), `routes_sources.py`
- **Modified**: `models.py` (add PhotoSource model, add `duration` and `source_removed` to Photo), `schemas.py` (source schemas), `main.py` (mount routes, start scheduler)
- **New migration**: `002_create_sources_table.py` (photo_sources table + new columns on photos)
- **New dependencies**: `osxphotos`, `apscheduler` (already in requirements), `ffmpeg` (system dependency)

### Frontend
- **New files**: `pos-photos-source-dialog.js` (add/manage sources)
- **Modified**: `pos-photos-sidebar.js` (add Sources section + "Removed from Source" smart view), `pos-photos-app.js` (wire source events), `photos-api.js` (source API wrappers), `store.js` (sources state)

### Infrastructure
- Requires `ffmpeg` installed on host (Homebrew: `brew install ffmpeg`)
- Requires `osxphotos` pip package (macOS only — Apple Photos reader is optional, folder watcher works without it)
- No new services or ports — all within existing photos service on :8008

### Data
- Source folders are read-only — pOS never modifies, moves, or deletes source files
- Apple Photos library is read via SQLite (read-only) — no risk to the library
- Photos are copied into pOS storage, creating independent copies
- Orphaned photos (source deleted) are flagged, never auto-deleted — user decides
