## Context

The photos service (port 8008) has a working upload → process → store pipeline. Photos already have `source_type`, `source_id`, and `source_account` columns designed for multi-source ingestion. The image processor handles EXIF extraction, thumbnails, and hashing via Pillow. What's missing is the automated ingestion layer — the ability to pull photos from external sources rather than requiring manual browser upload.

Two source types need to be supported: generic folder watching (covers Google Drive, iCloud Drive, any local directory) and Apple Photos library reading (rich metadata: albums, keywords, people, scene labels). Video files also need thumbnail/metadata extraction. All of this runs within the existing photos service — no new services or ports.

The KB module already uses APScheduler for feed polling (every 5 minutes), establishing the pattern for background scheduled tasks within a FastAPI service.

## Goals / Non-Goals

**Goals:**
- Automated photo/video ingestion from configured local directories
- Apple Photos library reading with album, keyword, people, and favourites import
- Video thumbnail extraction and metadata (duration, resolution)
- Orphan detection when source photos are deleted/removed
- Frontend source management (add, configure, monitor, remove)
- Architecture that supports future cloud deployment (upload agent replaces folder watcher)

**Non-Goals:**
- Two-way sync (pOS never writes back to sources)
- Google Photos API integration (future phase)
- Mobile upload agent or PWA (future phase)
- Real-time filesystem events (fsevents/inotify) — polling is sufficient
- Video playback in the frontend (just thumbnails for now)
- S3/object storage abstraction (stays on local disk for now)
- Auto-deletion of orphaned photos (user decides)

## Decisions

### 1. Sync runs inside the photos service, not as a separate service

**Decision**: Add APScheduler to the photos service lifespan, same pattern as KB feed polling.

**Why**: A separate sync service would need its own DB connection, shared models, and inter-service communication. Since sync directly creates Photo/Album/Person/Tag records, it belongs in the same service. The processing pipeline is already here.

**Alternative considered**: Separate sync worker process communicating via RabbitMQ. Rejected — adds operational complexity for no benefit at current scale. Can be extracted later if sync becomes CPU-heavy.

### 2. Polling over filesystem events

**Decision**: Poll directories every 5 minutes via APScheduler. No fsevents/inotify.

**Why**: Polling works on all platforms and with network-mounted folders (NFS, SMB, iCloud Drive). fsevents is macOS-only, doesn't work reliably on network drives, and adds a native dependency. 5-minute polling is fast enough — photos aren't time-critical like chat messages.

**Alternative considered**: `watchdog` library (cross-platform fs events). Rejected — adds complexity, unreliable on network drives, and doesn't work when pOS moves to cloud.

### 3. Copy files, don't link or reference

**Decision**: Sync copies files from source into pOS storage (`data/photos/{user_id}/originals/`). Source files are never modified, moved, or deleted.

**Why**: Copying makes pOS independent of the source. If the source folder is unmounted, renamed, or the Apple Photos library moves, pOS still has all its photos. This is essential for the "borrow and own" philosophy and for future cloud migration (can't symlink to a Mac folder from K8s).

**Trade-off**: Doubles storage usage for synced photos. Acceptable — disk is cheap, and this is the same approach Immich/PhotoPrism use.

### 4. `osxphotos` for Apple Photos Library

**Decision**: Use the `osxphotos` Python library to read the Photos Library package.

**Why**: It's the only maintained, well-documented way to access Apple Photos data programmatically. It reads the SQLite database directly (read-only), handles schema changes across macOS versions, and exposes albums, keywords, people, favourites, labels, edited versions, and GPS data through a clean Python API.

**Alternative considered**: Direct SQLite queries against the Photos database. Rejected — Apple changes the schema between macOS versions, and `osxphotos` handles this.

**Risk**: `osxphotos` is macOS-only. When pOS moves to cloud, this source type won't work. Mitigation: the folder watcher handles the cloud case (user exports from Apple Photos to a synced folder, or uses the upload agent).

### 5. Video processing via ffmpeg subprocess

**Decision**: Use `ffmpeg` and `ffprobe` via subprocess calls (not `ffmpeg-python` wrapper).

**Why**: `ffmpeg` is the universal standard for video processing. Subprocess calls are simpler than wrapping libraries, easier to debug, and the operations are simple (extract one frame, get duration). `ffmpeg-python` adds a dependency for minimal benefit.

**Commands needed**:
```bash
# Extract thumbnail at 1 second (or first frame for short clips)
ffmpeg -i input.mp4 -ss 1 -vframes 1 -f image2 output.jpg

# Get metadata (duration, resolution, codec)
ffprobe -v quiet -print_format json -show_format -show_streams input.mp4
```

**Alternative considered**: `moviepy` (Python library). Rejected — heavy dependency (installs ffmpeg anyway), slower for simple frame extraction.

### 6. Incremental sync via file hash + source_id tracking

**Decision**: Two-level dedup for sync:
1. **source_id match**: For Apple Photos, track the internal UUID. For folders, track the relative file path. If `source_id` already exists for this source → skip (already imported).
2. **file_hash match**: SHA-256 check. If the same file was uploaded manually or from another source → skip (exact duplicate).

**Why**: `source_id` is fast (indexed lookup) and avoids re-reading/hashing files that were already processed. `file_hash` catches cross-source duplicates (same photo in Apple Photos and a Google Drive folder).

### 7. Orphan detection via source_removed flag

**Decision**: Add a `source_removed` boolean column (default false) to the photos table. On each sync cycle, check if previously-imported photos from this source still exist at the source. If not, set `source_removed = true`.

**Why**: Don't auto-delete because the user may want to keep photos that were deleted from Apple (e.g., freed iCloud storage but wants to keep in pOS). The flag enables a "Removed from Source" smart view in the frontend.

**Implementation**: For folder sources, check if the file still exists at its original path. For Apple Photos, check if the `source_id` (UUID) still exists in the osxphotos database. Run orphan check as part of each sync cycle (after importing new photos).

### 8. Photo source data model

```
photo_sources table:
  id              UUID(v7)    PK
  user_id         UUID        NOT NULL
  provider        String(30)  NOT NULL          -- "folder" | "apple_photos"
  source_path     String(1000) NOT NULL         -- directory path or .photoslibrary path
  label           String(255) nullable          -- user-friendly name, e.g. "iCloud Photos"
  is_active       Boolean     NOT NULL default true
  sync_status     String(20)  NOT NULL default "idle"  -- idle | syncing | error
  last_sync_at    DateTime(tz) nullable
  last_error      Text        nullable
  photo_count     Integer     NOT NULL default 0       -- photos imported from this source
  config          JSONB       nullable          -- provider-specific settings (future)
  created_at      DateTime(tz) NOT NULL
  updated_at      DateTime(tz) NOT NULL

  Unique: (user_id, provider, source_path)
```

Changes to existing `photos` table:
- Add `duration` Float nullable — video duration in seconds
- Add `source_removed` Boolean NOT NULL default false

### 9. Sync pipeline architecture

```
Source (folder / apple_photos)
  │
  ├─ discover_new_files()
  │   ├─ Walk directory / read osxphotos DB
  │   ├─ Filter by file type (image/* or video/*)
  │   ├─ Skip if source_id already in photos table
  │   └─ Return list of new items with metadata
  │
  ├─ import_file(item)
  │   ├─ Read file bytes
  │   ├─ Compute SHA-256
  │   ├─ Skip if file_hash exists (cross-source dedup)
  │   ├─ Copy to pOS storage
  │   ├─ Create Photo record (source_type, source_id, source_account)
  │   ├─ Queue background processing (thumbnails, EXIF/video metadata)
  │   └─ Apply source metadata (Apple: albums, tags, people, favourites)
  │
  └─ detect_orphans()
      ├─ Query photos where source matches this source
      ├─ Check if each source_id still exists at source
      └─ Set source_removed=true for missing ones
```

### 10. Apple metadata mapping

| Apple Photos | pOS | Notes |
|-------------|-----|-------|
| Album | Album (`album_type="apple_sync"`) | Created if not exists, matched by `source_id` |
| Keyword | Tag (via tag_service) | Direct name mapping |
| Person | Person record + photo_people link | Matched by name, created if not exists |
| Favourite | `is_favourite = true` | One-way: Apple fav → pOS fav |
| Scene label | Tag with `auto:` prefix | e.g., `auto:beach`, `auto:sunset` |
| Date taken | `taken_at` | Apple's date, often more accurate than raw EXIF |
| GPS | `latitude`, `longitude` | From Apple's enriched data |
| Edited version | Imported as the photo | Original also available via osxphotos if needed |

### 11. API routes for sources

```
GET    /api/photos/sources                    -- list all sources
POST   /api/photos/sources                    -- add source { provider, source_path, label }
GET    /api/photos/sources/{id}               -- source detail + status
PATCH  /api/photos/sources/{id}               -- update label, is_active
DELETE /api/photos/sources/{id}               -- remove source (does NOT delete imported photos)
POST   /api/photos/sources/{id}/sync          -- trigger manual sync
GET    /api/photos/sources/{id}/sync-status   -- get current sync progress
```

### 12. Implementation phases (build incrementally)

```
Phase A: Foundation
  - PhotoSource model + migration
  - Source CRUD API + routes
  - duration + source_removed columns on photos
  - Frontend: Sources section in sidebar, add source dialog

Phase B: Folder Watcher
  - service_sync.py: folder scanner, incremental sync
  - Scheduler (APScheduler) integration in main.py lifespan
  - Orphan detection for folders
  - Frontend: sync status display, manual sync trigger

Phase C: Video Support
  - video_processor.py: ffmpeg thumbnail extraction, ffprobe metadata
  - Extend image_processor pipeline to detect and route video files
  - Frontend: video indicator on grid cards (duration badge)

Phase D: Apple Photos Library
  - osxphotos integration in service_sync.py
  - Album, keyword, people, favourites, scene label mapping
  - Orphan detection for Apple Photos
  - Frontend: Apple Photos as source type in add dialog
```

## Risks / Trade-offs

**[Storage duplication]** → Synced photos are copied, doubling disk usage. Mitigation: disk is cheap (~$0.02/GB/month on S3). Alternative would be symlinks but that breaks on cloud migration and when sources are unmounted.

**[osxphotos macOS dependency]** → Apple Photos reader only works on macOS. Mitigation: it's an optional source type. Folder watcher works everywhere. When on cloud, users export to a folder or use the upload agent instead. Make osxphotos an optional import (graceful degradation if not installed).

**[Large library initial sync]** → First sync of a 100K+ photo library could take hours (copying files, generating thumbnails). Mitigation: sync runs in background, processes in batches, tracks progress. User sees incremental count in the sidebar. Don't block the UI or other operations during sync.

**[Apple Photos Library locked]** → Photos.app may lock the SQLite database while running. Mitigation: `osxphotos` handles this (reads a WAL snapshot). Test with Photos.app both open and closed.

**[ffmpeg not installed]** → Video processing fails silently if ffmpeg isn't on PATH. Mitigation: check for ffmpeg on startup, log a warning if missing, skip video thumbnail generation gracefully (video still imports, just no thumbnail).

**[Sync conflicts]** → Two sync cycles could overlap if one takes longer than 5 minutes. Mitigation: per-source lock via `sync_status = "syncing"`. Scheduler checks status before starting a new cycle — skips if already syncing.
