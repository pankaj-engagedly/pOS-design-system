"""Google Photos sync provider — media download, album mapping, incremental sync."""

import asyncio
import uuid as uuid_mod
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .google_oauth import ensure_fresh_token, TokenRevokedError
from .google_photos_client import (
    download_media_item,
    get_media_item,
    list_albums,
    list_media_items,
    search_album_media,
)
from .image_processor import compute_file_hash, generate_thumbnails_from_bytes, process_image
from .models import Album, AlbumPhoto, Photo, PhotoSource

# Base directory for photo storage
STORAGE_BASE = Path(__file__).resolve().parents[3] / "data" / "photos"

# MIME type to extension mapping for Google Photos
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/tiff": ".tiff",
    "image/bmp": ".bmp",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/x-msvideo": ".avi",
    "video/x-matroska": ".mkv",
}

# Delay between download requests (courtesy)
DOWNLOAD_DELAY = 0.1  # 100ms


def _originals_dir(user_id: str) -> Path:
    d = STORAGE_BASE / user_id / "originals"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _thumbs_dir(user_id: str) -> Path:
    d = STORAGE_BASE / user_id / "thumbs"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def sync_google_photos_source(
    session: AsyncSession,
    source: PhotoSource,
) -> int:
    """Main sync entry point. Returns count of new photos imported."""
    # Refresh token if needed
    access_token = await ensure_fresh_token(session, source)

    # Sync media items
    imported = await _sync_media_items(session, source, access_token)

    # Sync albums
    await _sync_albums(session, source, access_token)

    return imported


# ── Media Item Sync ─────────────────────────────────────


async def _sync_media_items(
    session: AsyncSession,
    source: PhotoSource,
    access_token: str,
) -> int:
    """Page through Google Photos media items and import new ones."""
    config_data = source.config or {}
    page_token = config_data.get("next_page_token")  # Resume interrupted sync
    source_uuid = str(source.id)
    user_id = source.user_id
    imported = 0
    first_sync = not config_data.get("last_sync_marker")

    while True:
        try:
            items, next_page_token = await list_media_items(
                access_token, page_token=page_token,
            )
        except Exception as e:
            if "429" in str(e):
                logger.warning("API quota reached — will resume next cycle")
                _save_page_token(source, page_token)
                await session.commit()
                break
            raise

        if not items:
            break

        stop_early = False
        for item in items:
            google_id = item["id"]

            # Check if already imported (incremental)
            existing = await session.execute(
                select(Photo.id).where(
                    Photo.user_id == user_id,
                    Photo.source_type == "google_photos",
                    Photo.source_account == source_uuid,
                    Photo.source_id == google_id,
                )
            )
            if existing.scalar_one_or_none() is not None:
                if not first_sync:
                    # Incremental: stop when we hit known items
                    stop_early = True
                    break
                continue

            # Import this item
            try:
                result = await _import_media_item(
                    session, source, access_token, item,
                )
                if result:
                    imported += 1
            except Exception as e:
                logger.warning(f"Failed to import Google media {google_id}: {e}")

            # Courtesy delay
            await asyncio.sleep(DOWNLOAD_DELAY)

        if stop_early:
            break

        # Checkpoint: save page token after each page
        if next_page_token:
            _save_page_token(source, next_page_token)
            await session.commit()
            page_token = next_page_token
        else:
            # Last page — sync complete
            break

    # Sync complete: clear page token, set sync marker
    config_data = dict(source.config or {})
    config_data["next_page_token"] = None
    if imported > 0 or not config_data.get("last_sync_marker"):
        config_data["last_sync_marker"] = datetime.now(timezone.utc).isoformat()
    source.config = config_data
    await session.commit()

    return imported


def _save_page_token(source: PhotoSource, page_token: str | None):
    """Save page token to source config for resume."""
    config_data = dict(source.config or {})
    config_data["next_page_token"] = page_token
    source.config = config_data


async def _import_media_item(
    session: AsyncSession,
    source: PhotoSource,
    access_token: str,
    item: dict,
) -> bool:
    """Download and import a single Google Photos media item. Returns True if imported."""
    user_id = source.user_id
    google_id = item["id"]
    mime_type = item.get("mimeType", "image/jpeg")
    is_video = mime_type.startswith("video/")
    base_url = item.get("baseUrl", "")

    if not base_url:
        logger.warning(f"No baseUrl for media item {google_id}")
        return False

    # Download
    content = await download_media_item(access_token, base_url, is_video=is_video)

    # Handle expired baseUrl — re-fetch and retry
    if content is None:
        try:
            refreshed = await get_media_item(access_token, google_id)
            base_url = refreshed.get("baseUrl", "")
            if base_url:
                content = await download_media_item(access_token, base_url, is_video=is_video)
        except Exception as e:
            logger.warning(f"Failed to refresh baseUrl for {google_id}: {e}")

    if content is None or len(content) == 0:
        logger.warning(f"Failed to download media item {google_id}")
        return False

    # Compute hash + dedup
    file_hash = compute_file_hash(content)
    existing_hash = await session.execute(
        select(Photo.id).where(
            Photo.user_id == user_id,
            Photo.file_hash == file_hash,
        )
    )
    if existing_hash.scalar_one_or_none() is not None:
        logger.debug(f"Cross-source dupe (hash match): {google_id}")
        return False

    # Store file
    ext = MIME_TO_EXT.get(mime_type, ".jpg")
    photo_uuid = str(uuid_mod.uuid4())
    originals = _originals_dir(user_id)
    storage_path = originals / f"{photo_uuid}{ext}"
    storage_path.write_bytes(content)

    # Extract metadata from Google's mediaMetadata
    metadata = item.get("mediaMetadata", {})
    taken_at = _parse_creation_time(metadata.get("creationTime"))
    width = int(metadata.get("width", 0)) or None
    height = int(metadata.get("height", 0)) or None
    caption = item.get("description")
    exif_data = _map_google_exif(metadata)

    filename = item.get("filename", f"{google_id}{ext}")

    # Create Photo record
    photo = Photo(
        user_id=user_id,
        filename=filename,
        storage_path=str(storage_path),
        content_type=mime_type,
        file_size=len(content),
        file_hash=file_hash,
        width=width,
        height=height,
        taken_at=taken_at,
        caption=caption,
        exif_data=exif_data if exif_data else None,
        source_type="google_photos",
        source_id=google_id,
        source_account=str(source.id),
        processing_status="pending",
    )
    session.add(photo)
    await session.flush()

    # Process image/video
    if not is_video:
        try:
            img_meta = process_image(content)
            photo.width = photo.width or img_meta["width"]
            photo.height = photo.height or img_meta["height"]
            photo.perceptual_hash = img_meta["perceptual_hash"]
            # Prefer Google metadata for EXIF, but fill gaps from file
            if not photo.taken_at:
                photo.taken_at = img_meta["taken_at"]
            if not photo.latitude:
                photo.latitude = img_meta["latitude"]
                photo.longitude = img_meta["longitude"]

            thumb_dir = _thumbs_dir(user_id)
            generate_thumbnails_from_bytes(content, thumb_dir, photo_uuid)
            photo.processing_status = "complete"
        except Exception as e:
            logger.warning(f"Image processing failed for {google_id}: {e}")
            photo.processing_status = "error"
    else:
        try:
            from .video_processor import process_video
            video_meta = process_video(content, storage_path, _thumbs_dir(user_id), photo_uuid)
            photo.width = photo.width or video_meta.get("width")
            photo.height = photo.height or video_meta.get("height")
            photo.duration = video_meta.get("duration")
            photo.processing_status = "complete" if video_meta.get("thumbnail_generated") else "error"
        except ImportError:
            photo.processing_status = "pending"
        except Exception as e:
            logger.warning(f"Video processing failed for {google_id}: {e}")
            photo.processing_status = "error"

    return True


def _parse_creation_time(time_str: str | None) -> datetime | None:
    """Parse Google's creationTime (ISO 8601) to datetime."""
    if not time_str:
        return None
    try:
        return datetime.fromisoformat(time_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _map_google_exif(metadata: dict) -> dict | None:
    """Map Google mediaMetadata.photo to standard EXIF field names."""
    photo_meta = metadata.get("photo", {})
    if not photo_meta:
        return None

    exif = {}
    if photo_meta.get("cameraMake"):
        exif["Make"] = photo_meta["cameraMake"]
    if photo_meta.get("cameraModel"):
        exif["Model"] = photo_meta["cameraModel"]
    if photo_meta.get("focalLength"):
        exif["FocalLength"] = photo_meta["focalLength"]
    if photo_meta.get("apertureFNumber"):
        exif["FNumber"] = photo_meta["apertureFNumber"]
    if photo_meta.get("isoEquivalent"):
        exif["ISOSpeedRatings"] = photo_meta["isoEquivalent"]

    return exif if exif else None


# ── Album Sync ──────────────────────────────────────────


async def _sync_albums(
    session: AsyncSession,
    source: PhotoSource,
    access_token: str,
) -> None:
    """Sync Google Photos albums to pOS albums."""
    user_id = source.user_id
    source_uuid = str(source.id)

    # Fetch all Google albums
    google_albums = []
    page_token = None
    while True:
        try:
            albums, next_token = await list_albums(access_token, page_token=page_token)
            google_albums.extend(albums)
            if not next_token:
                break
            page_token = next_token
        except Exception as e:
            logger.warning(f"Failed to list Google albums: {e}")
            return

    logger.info(f"Google sync: {len(google_albums)} albums found")

    for g_album in google_albums:
        album_title = g_album.get("title", "Untitled")
        album_id = g_album.get("id")
        if not album_id:
            continue

        # Find or create pOS album
        result = await session.execute(
            select(Album).where(
                Album.user_id == user_id,
                Album.album_type == "google_sync",
                Album.name == album_title,
            )
        )
        pos_album = result.scalar_one_or_none()

        if not pos_album:
            pos_album = Album(
                user_id=user_id,
                name=album_title,
                album_type="google_sync",
            )
            session.add(pos_album)
            await session.flush()

        # Fetch album media items and link
        media_page_token = None
        while True:
            try:
                items, next_token = await search_album_media(
                    access_token, album_id, page_token=media_page_token,
                )
            except Exception as e:
                logger.warning(f"Failed to search album media '{album_title}': {e}")
                break

            for item in items:
                google_media_id = item["id"]
                # Find the pOS photo by source_id
                photo_result = await session.execute(
                    select(Photo.id).where(
                        Photo.user_id == user_id,
                        Photo.source_type == "google_photos",
                        Photo.source_account == source_uuid,
                        Photo.source_id == google_media_id,
                    )
                )
                photo_id = photo_result.scalar_one_or_none()
                if not photo_id:
                    continue

                # Check if link already exists
                existing_link = await session.execute(
                    select(AlbumPhoto.id).where(
                        AlbumPhoto.album_id == pos_album.id,
                        AlbumPhoto.photo_id == photo_id,
                    )
                )
                if existing_link.scalar_one_or_none() is None:
                    link = AlbumPhoto(
                        user_id=user_id,
                        album_id=pos_album.id,
                        photo_id=photo_id,
                    )
                    session.add(link)

            if not next_token:
                break
            media_page_token = next_token

        await session.commit()
