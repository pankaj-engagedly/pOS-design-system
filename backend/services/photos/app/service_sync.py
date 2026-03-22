"""Photo sync providers — folder watcher + Apple Photos reader."""

import os
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .image_processor import compute_file_hash, generate_thumbnails_from_bytes, process_image
from .models import Photo, PhotoSource

# Base directory for photo storage — same as service_photos
STORAGE_BASE = Path(__file__).resolve().parents[3] / "data" / "photos"

# Supported file extensions (case-insensitive)
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp", ".tiff", ".tif", ".gif", ".bmp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".m4v"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS

# Files/dirs to skip
SKIP_FILES = {"thumbs.db", ".ds_store"}
SKIP_DIRS = {"@eadir"}

# MIME types for video extensions
VIDEO_MIME_TYPES = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".m4v": "video/x-m4v",
}


def _originals_dir(user_id: UUID) -> Path:
    d = STORAGE_BASE / str(user_id) / "originals"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _thumbs_dir(user_id: UUID) -> Path:
    d = STORAGE_BASE / str(user_id) / "thumbs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _content_type_for_ext(ext: str) -> str:
    """Determine content type from file extension."""
    ext = ext.lower()
    if ext in VIDEO_MIME_TYPES:
        return VIDEO_MIME_TYPES[ext]
    mime_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".heic": "image/heic", ".heif": "image/heif",
        ".webp": "image/webp", ".tiff": "image/tiff", ".tif": "image/tiff",
        ".gif": "image/gif", ".bmp": "image/bmp",
    }
    return mime_map.get(ext, "application/octet-stream")


def _is_video(ext: str) -> bool:
    return ext.lower() in VIDEO_EXTENSIONS


# ── Folder Sync Provider ──────────────────────────────────


def discover_folder_files(
    source_path: str,
    last_sync_at: datetime | None = None,
) -> list[dict]:
    """Walk a folder recursively, returning new/modified files.

    Each item: {relative_path, absolute_path, ext, mtime}
    """
    root = Path(source_path)
    if not root.is_dir():
        raise FileNotFoundError(f"Source folder not found: {source_path}")

    cutoff = None
    if last_sync_at:
        cutoff = (last_sync_at - timedelta(seconds=60)).timestamp()

    items = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Skip hidden directories and @eaDir
        dirnames[:] = [
            d for d in dirnames
            if not d.startswith(".") and d.lower() not in SKIP_DIRS
        ]

        for fname in filenames:
            # Skip hidden files and known junk
            if fname.startswith(".") or fname.lower() in SKIP_FILES:
                continue

            fpath = Path(dirpath) / fname
            ext = fpath.suffix.lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue

            # Incremental: only files newer than last sync
            if cutoff is not None:
                try:
                    mtime = fpath.stat().st_mtime
                    if mtime < cutoff:
                        continue
                except OSError:
                    continue

            rel_path = str(fpath.relative_to(root))
            items.append({
                "relative_path": rel_path,
                "absolute_path": str(fpath),
                "ext": ext,
                "mtime": fpath.stat().st_mtime,
            })

    return items


async def sync_folder_source(
    session: AsyncSession,
    source: PhotoSource,
) -> int:
    """Run a full sync cycle for a folder source. Returns count of new photos imported."""
    user_id = source.user_id
    source_id_prefix = str(source.id)

    # 1. Discover new files
    files = discover_folder_files(source.source_path, source.last_sync_at)
    logger.info(f"Folder sync '{source.label or source.source_path}': {len(files)} candidate files")

    imported = 0
    for item in files:
        rel_path = item["relative_path"]
        abs_path = item["absolute_path"]
        ext = item["ext"]

        # Level 1 dedup: source_id match (already imported from this source)
        existing = await session.execute(
            select(Photo.id).where(
                Photo.user_id == user_id,
                Photo.source_type == "folder",
                Photo.source_account == source_id_prefix,
                Photo.source_id == rel_path,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        # Read file
        try:
            content = Path(abs_path).read_bytes()
        except OSError as e:
            logger.warning(f"Cannot read {abs_path}: {e}")
            continue

        # Level 2 dedup: file_hash match (cross-source duplicate)
        file_hash = compute_file_hash(content)
        existing_hash = await session.execute(
            select(Photo.id).where(
                Photo.user_id == user_id,
                Photo.file_hash == file_hash,
            )
        )
        if existing_hash.scalar_one_or_none() is not None:
            logger.debug(f"Skipping cross-source dupe: {rel_path}")
            continue

        # Copy to pOS storage
        import uuid as uuid_mod
        photo_uuid = str(uuid_mod.uuid4())
        originals = _originals_dir(user_id)
        storage_path = originals / f"{photo_uuid}{ext}"
        storage_path.write_bytes(content)

        content_type = _content_type_for_ext(ext)
        is_video = _is_video(ext)

        # Create Photo record
        photo = Photo(
            user_id=user_id,
            filename=Path(abs_path).name,
            storage_path=str(storage_path),
            content_type=content_type,
            file_size=len(content),
            file_hash=file_hash,
            source_type="folder",
            source_id=rel_path,
            source_account=source_id_prefix,
            processing_status="pending",
        )
        session.add(photo)
        await session.flush()

        # Process image (thumbnails + metadata) synchronously for sync
        if not is_video:
            try:
                metadata = process_image(content)
                photo.width = metadata["width"]
                photo.height = metadata["height"]
                photo.exif_data = metadata["exif_data"]
                photo.taken_at = metadata["taken_at"]
                photo.latitude = metadata["latitude"]
                photo.longitude = metadata["longitude"]
                photo.perceptual_hash = metadata["perceptual_hash"]

                thumb_dir = _thumbs_dir(user_id)
                generate_thumbnails_from_bytes(content, thumb_dir, photo_uuid)
                photo.processing_status = "complete"
            except Exception as e:
                logger.warning(f"Image processing failed for {rel_path}: {e}")
                photo.processing_status = "error"
        else:
            # Video processing handled by video_processor (Phase C)
            try:
                from .video_processor import process_video
                video_meta = process_video(content, storage_path, _thumbs_dir(user_id), photo_uuid)
                photo.width = video_meta.get("width")
                photo.height = video_meta.get("height")
                photo.duration = video_meta.get("duration")
                photo.processing_status = "complete" if video_meta.get("thumbnail_generated") else "error"
            except ImportError:
                photo.processing_status = "pending"
            except Exception as e:
                logger.warning(f"Video processing failed for {rel_path}: {e}")
                photo.processing_status = "error"

        imported += 1

        # Commit in batches of 50
        if imported % 50 == 0:
            await session.commit()
            logger.info(f"Folder sync: {imported} photos imported so far")

    await session.commit()

    # 2. Orphan detection
    await detect_folder_orphans(session, source)

    return imported


async def detect_folder_orphans(
    session: AsyncSession,
    source: PhotoSource,
) -> int:
    """Check if previously-imported folder files still exist. Mark missing as source_removed."""
    source_id_prefix = str(source.id)
    result = await session.execute(
        select(Photo).where(
            Photo.user_id == source.user_id,
            Photo.source_type == "folder",
            Photo.source_account == source_id_prefix,
        )
    )
    photos = list(result.scalars().all())

    root = Path(source.source_path)
    orphaned = 0

    for photo in photos:
        file_path = root / photo.source_id
        exists = file_path.exists()

        if not exists and not photo.source_removed:
            photo.source_removed = True
            orphaned += 1
        elif exists and photo.source_removed:
            photo.source_removed = False

    if orphaned > 0:
        logger.info(f"Folder sync: {orphaned} photos marked as source_removed")
        await session.commit()

    return orphaned
