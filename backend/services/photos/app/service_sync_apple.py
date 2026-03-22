"""Apple Photos Library sync provider — reads macOS Photos Library via osxphotos."""

import uuid as uuid_mod
from pathlib import Path

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .image_processor import compute_file_hash, generate_thumbnails_from_bytes, process_image
from .models import Album, AlbumPhoto, Photo, PhotoSource, Person, PhotoPerson
from .service_sync import STORAGE_BASE, VIDEO_EXTENSIONS, _content_type_for_ext, _is_video, _originals_dir, _thumbs_dir

try:
    import osxphotos
    OSXPHOTOS_AVAILABLE = True
except ImportError:
    osxphotos = None
    OSXPHOTOS_AVAILABLE = False


def is_apple_photos_available() -> bool:
    """Check if osxphotos is installed and usable."""
    return OSXPHOTOS_AVAILABLE


async def sync_apple_photos_source(
    session: AsyncSession,
    source: PhotoSource,
) -> int:
    """Run a full sync cycle for an Apple Photos source. Returns count of new photos imported."""
    if not OSXPHOTOS_AVAILABLE:
        raise ImportError("osxphotos is not installed")

    if not source.source_path.endswith(".photoslibrary"):
        raise ValueError(f"Invalid Apple Photos library path: {source.source_path}")

    user_id = source.user_id
    source_id_prefix = str(source.id)

    # Open the Photos Library
    photosdb = osxphotos.PhotosDB(source.source_path)
    all_photos = photosdb.photos()
    logger.info(f"Apple Photos sync '{source.label or source.source_path}': {len(all_photos)} photos in library")

    imported = 0

    for apple_photo in all_photos:
        apple_uuid = apple_photo.uuid

        # Level 1 dedup: source_id match (already imported)
        existing = await session.execute(
            select(Photo.id).where(
                Photo.user_id == user_id,
                Photo.source_type == "apple_photos",
                Photo.source_account == source_id_prefix,
                Photo.source_id == apple_uuid,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue

        # Get the file path (edited version preferred)
        file_path = apple_photo.path_edited or apple_photo.path
        if not file_path or not Path(file_path).exists():
            logger.debug(f"Skipping Apple photo {apple_uuid}: no file available")
            continue

        # Read file
        try:
            content = Path(file_path).read_bytes()
        except OSError as e:
            logger.warning(f"Cannot read Apple photo {apple_uuid}: {e}")
            continue

        # Level 2 dedup: file_hash match
        file_hash = compute_file_hash(content)
        existing_hash = await session.execute(
            select(Photo.id).where(
                Photo.user_id == user_id,
                Photo.file_hash == file_hash,
            )
        )
        if existing_hash.scalar_one_or_none() is not None:
            logger.debug(f"Skipping Apple photo cross-source dupe: {apple_uuid}")
            continue

        # Copy to pOS storage
        ext = Path(file_path).suffix.lower() or ".jpg"
        photo_uuid = str(uuid_mod.uuid4())
        originals = _originals_dir(user_id)
        storage_path = originals / f"{photo_uuid}{ext}"
        storage_path.write_bytes(content)

        content_type = _content_type_for_ext(ext)
        is_video = _is_video(ext)

        # Create Photo record
        photo = Photo(
            user_id=user_id,
            filename=apple_photo.original_filename or Path(file_path).name,
            storage_path=str(storage_path),
            content_type=content_type,
            file_size=len(content),
            file_hash=file_hash,
            source_type="apple_photos",
            source_id=apple_uuid,
            source_account=source_id_prefix,
            is_favourite=apple_photo.favorite,
            processing_status="pending",
        )

        # Use Apple's date and GPS (more accurate than raw EXIF)
        if apple_photo.date:
            photo.taken_at = apple_photo.date
        if apple_photo.latitude is not None and apple_photo.longitude is not None:
            photo.latitude = apple_photo.latitude
            photo.longitude = apple_photo.longitude

        session.add(photo)
        await session.flush()

        # Process image (thumbnails + metadata)
        if not is_video:
            try:
                metadata = process_image(content)
                photo.width = metadata["width"]
                photo.height = metadata["height"]
                photo.exif_data = metadata["exif_data"]
                photo.perceptual_hash = metadata["perceptual_hash"]
                # Keep Apple's taken_at and GPS over EXIF
                thumb_dir = _thumbs_dir(user_id)
                generate_thumbnails_from_bytes(content, thumb_dir, photo_uuid)
                photo.processing_status = "complete"
            except Exception as e:
                logger.warning(f"Image processing failed for Apple photo {apple_uuid}: {e}")
                photo.processing_status = "error"
        else:
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
                logger.warning(f"Video processing failed for Apple photo {apple_uuid}: {e}")
                photo.processing_status = "error"

        # Map Apple metadata
        await _map_apple_albums(session, user_id, photo, apple_photo)
        await _map_apple_keywords(session, user_id, photo, apple_photo)
        await _map_apple_labels(session, user_id, photo, apple_photo)
        await _map_apple_people(session, user_id, photo, apple_photo)

        imported += 1

        # Commit in batches
        if imported % 50 == 0:
            await session.commit()
            logger.info(f"Apple Photos sync: {imported} photos imported so far")

    await session.commit()

    # Orphan detection
    await detect_apple_orphans(session, source, photosdb)

    return imported


async def _map_apple_albums(session, user_id, photo: Photo, apple_photo):
    """Map Apple Photos albums to pOS albums."""
    for album_info in apple_photo.album_info:
        album_title = album_info.title
        if not album_title:
            continue

        # Find or create pOS album
        result = await session.execute(
            select(Album).where(
                Album.user_id == user_id,
                Album.name == album_title,
                Album.album_type == "apple_sync",
            )
        )
        album = result.scalar_one_or_none()

        if not album:
            album = Album(
                user_id=user_id,
                name=album_title,
                album_type="apple_sync",
            )
            session.add(album)
            await session.flush()

        # Add photo to album (if not already)
        existing_link = await session.execute(
            select(AlbumPhoto).where(
                AlbumPhoto.album_id == album.id,
                AlbumPhoto.photo_id == photo.id,
            )
        )
        if not existing_link.scalar_one_or_none():
            link = AlbumPhoto(
                user_id=user_id,
                album_id=album.id,
                photo_id=photo.id,
            )
            session.add(link)


async def _map_apple_keywords(session, user_id, photo: Photo, apple_photo):
    """Map Apple Photos keywords to pOS tags."""
    from pos_contracts.tag_service import add_tag

    for keyword in (apple_photo.keywords or []):
        try:
            await add_tag(session, "photo", str(photo.id), keyword, str(user_id))
        except Exception as e:
            logger.debug(f"Failed to add keyword tag '{keyword}': {e}")


async def _map_apple_labels(session, user_id, photo: Photo, apple_photo):
    """Map Apple Photos scene labels to pOS tags with auto: prefix."""
    from pos_contracts.tag_service import add_tag

    for label in (apple_photo.labels or []):
        tag_name = f"auto:{label}"
        try:
            await add_tag(session, "photo", str(photo.id), tag_name, str(user_id))
        except Exception as e:
            logger.debug(f"Failed to add label tag '{tag_name}': {e}")


async def _map_apple_people(session, user_id, photo: Photo, apple_photo):
    """Map Apple Photos people to pOS Person records."""
    for person_info in (apple_photo.person_info or []):
        person_name = person_info.name
        if not person_name:
            continue

        # Find or create pOS Person
        result = await session.execute(
            select(Person).where(
                Person.user_id == user_id,
                Person.name == person_name,
            )
        )
        person = result.scalar_one_or_none()

        if not person:
            person = Person(user_id=user_id, name=person_name)
            session.add(person)
            await session.flush()

        # Link photo to person
        existing_link = await session.execute(
            select(PhotoPerson).where(
                PhotoPerson.photo_id == photo.id,
                PhotoPerson.person_id == person.id,
            )
        )
        if not existing_link.scalar_one_or_none():
            link = PhotoPerson(
                user_id=user_id,
                photo_id=photo.id,
                person_id=person.id,
            )
            session.add(link)


async def detect_apple_orphans(session, source: PhotoSource, photosdb=None):
    """Check if previously-imported Apple Photos UUIDs still exist in the library."""
    source_id_prefix = str(source.id)

    if photosdb is None:
        if not OSXPHOTOS_AVAILABLE:
            return 0
        photosdb = osxphotos.PhotosDB(source.source_path)

    # Get all current UUIDs in the library
    current_uuids = {p.uuid for p in photosdb.photos()}

    # Get all photos imported from this source
    result = await session.execute(
        select(Photo).where(
            Photo.user_id == source.user_id,
            Photo.source_type == "apple_photos",
            Photo.source_account == source_id_prefix,
        )
    )
    photos = list(result.scalars().all())

    orphaned = 0
    for photo in photos:
        exists = photo.source_id in current_uuids

        if not exists and not photo.source_removed:
            photo.source_removed = True
            orphaned += 1
        elif exists and photo.source_removed:
            photo.source_removed = False

    if orphaned > 0:
        logger.info(f"Apple Photos sync: {orphaned} photos marked as source_removed")
        await session.commit()

    return orphaned
