"""Photo business logic — upload, list, update, delete, timeline."""

import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import BackgroundTasks, UploadFile
from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError
from pos_contracts.models import Tag, Taggable
from pos_contracts.tag_service import add_tag, get_tags_for_entity, remove_tag

from .events import publish_event
from .image_processor import (
    compute_file_hash,
    generate_thumbnails_from_bytes,
    process_image,
)
from .models import Album, AlbumPhoto, Photo, PhotoComment, PhotoPerson, Person

# Base directory for photo storage — relative to project root
STORAGE_BASE = Path(__file__).resolve().parents[3] / "data" / "photos"


def _user_dir(user_id: UUID) -> Path:
    return STORAGE_BASE / str(user_id)


def _originals_dir(user_id: UUID) -> Path:
    d = _user_dir(user_id) / "originals"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _thumbs_dir(user_id: UUID) -> Path:
    d = _user_dir(user_id) / "thumbs"
    d.mkdir(parents=True, exist_ok=True)
    return d


async def upload_photo(
    session: AsyncSession,
    user_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
) -> Photo:
    """Upload a photo: store file, dedup check, create DB record, queue processing."""
    content = await file.read()
    file_hash = compute_file_hash(content)

    # Dedup check
    existing = await session.execute(
        select(Photo).where(Photo.user_id == user_id, Photo.file_hash == file_hash)
    )
    existing_photo = existing.scalar_one_or_none()
    if existing_photo:
        return existing_photo

    # Store original
    ext = Path(file.filename or "photo").suffix.lower() or ".jpg"
    import uuid as uuid_mod
    photo_uuid = str(uuid_mod.uuid4())
    originals = _originals_dir(user_id)
    storage_path = originals / f"{photo_uuid}{ext}"
    storage_path.write_bytes(content)

    # Create DB record
    photo = Photo(
        user_id=user_id,
        filename=file.filename or "unnamed",
        storage_path=str(storage_path),
        content_type=file.content_type or "image/jpeg",
        file_size=len(content),
        file_hash=file_hash,
        processing_status="pending",
    )
    session.add(photo)
    await session.commit()
    await session.refresh(photo)

    # Queue background processing
    background_tasks.add_task(
        _process_photo_background, str(photo.id), user_id, content, photo_uuid
    )

    await publish_event("photo.uploaded", photo)
    return photo


async def _process_photo_background(
    photo_id: str, user_id: UUID, content: bytes, photo_uuid: str
):
    """Background task: extract metadata, generate thumbnails."""
    from .db import _session_factory

    if _session_factory is None:
        logger.error("DB not initialized for background processing")
        return

    try:
        # Process image
        metadata = process_image(content)

        # Generate thumbnails
        thumb_dir = _thumbs_dir(user_id)
        generate_thumbnails_from_bytes(content, thumb_dir, photo_uuid)

        # Update DB
        async with _session_factory() as session:
            result = await session.execute(
                select(Photo).where(Photo.id == photo_id)
            )
            photo = result.scalar_one_or_none()
            if photo:
                photo.width = metadata["width"]
                photo.height = metadata["height"]
                photo.exif_data = metadata["exif_data"]
                photo.taken_at = metadata["taken_at"]
                photo.latitude = metadata["latitude"]
                photo.longitude = metadata["longitude"]
                photo.perceptual_hash = metadata["perceptual_hash"]
                photo.processing_status = "complete"
                await session.commit()
                logger.debug(f"Photo {photo_id} processed successfully")

    except Exception as e:
        logger.error(f"Background processing failed for photo {photo_id}: {e}")
        # Mark as error
        try:
            async with _session_factory() as session:
                result = await session.execute(
                    select(Photo).where(Photo.id == photo_id)
                )
                photo = result.scalar_one_or_none()
                if photo:
                    photo.processing_status = "error"
                    await session.commit()
        except Exception:
            pass


async def list_photos(
    session: AsyncSession,
    user_id: UUID,
    *,
    is_favourite: bool | None = None,
    source_type: str | None = None,
    tag: str | None = None,
    person_id: str | None = None,
    album_id: str | None = None,
    sort_by: str = "taken_at",
    limit: int = 100,
    offset: int = 0,
) -> list[Photo]:
    """List photos with optional filters."""
    query = select(Photo).where(Photo.user_id == user_id)

    if is_favourite is not None:
        query = query.where(Photo.is_favourite == is_favourite)
    if source_type:
        query = query.where(Photo.source_type == source_type)

    if tag:
        # Filter by tag via shared tag service
        query = (
            query.join(Taggable, (Taggable.entity_id == Photo.id) & (Taggable.entity_type == "photo"))
            .join(Tag, Tag.id == Taggable.tag_id)
            .where(Tag.name == tag, Tag.user_id == user_id)
        )

    if person_id:
        query = query.join(PhotoPerson).where(PhotoPerson.person_id == person_id)

    if album_id:
        query = query.join(AlbumPhoto).where(AlbumPhoto.album_id == album_id)

    # Sorting
    if sort_by == "created_at":
        query = query.order_by(Photo.created_at.desc())
    else:
        # Default: by taken_at (nulls last), then created_at
        query = query.order_by(
            Photo.taken_at.desc().nullslast(),
            Photo.created_at.desc(),
        )

    query = query.offset(offset).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())


async def build_photo_summaries(
    session: AsyncSession, user_id: UUID, photos: list[Photo]
) -> list[dict]:
    """Enrich photos with tags and comment counts for grid display."""
    if not photos:
        return []

    photo_ids = [p.id for p in photos]

    # Get comment counts
    comment_counts_q = await session.execute(
        select(PhotoComment.photo_id, func.count(PhotoComment.id))
        .where(PhotoComment.photo_id.in_(photo_ids))
        .group_by(PhotoComment.photo_id)
    )
    comment_counts = {row[0]: row[1] for row in comment_counts_q}

    # Get tags for all photos
    tags_q = await session.execute(
        select(Taggable.entity_id, Tag.id, Tag.name, Tag.created_at)
        .join(Tag, Tag.id == Taggable.tag_id)
        .where(
            Taggable.entity_type == "photo",
            Taggable.entity_id.in_(photo_ids),
            Tag.user_id == user_id,
        )
    )
    tags_by_photo = defaultdict(list)
    for row in tags_q:
        tags_by_photo[row[0]].append({"id": row[1], "name": row[2], "created_at": row[3]})

    summaries = []
    for p in photos:
        d = {
            "id": p.id, "filename": p.filename, "content_type": p.content_type,
            "file_size": p.file_size, "width": p.width, "height": p.height,
            "taken_at": p.taken_at, "is_favourite": p.is_favourite,
            "caption": p.caption, "rating": p.rating,
            "duration": p.duration,
            "source_type": p.source_type, "source_removed": p.source_removed,
            "processing_status": p.processing_status,
            "exif_data": p.exif_data, "tags": tags_by_photo.get(p.id, []),
            "comment_count": comment_counts.get(p.id, 0),
            "created_at": p.created_at, "updated_at": p.updated_at,
        }
        summaries.append(d)
    return summaries


async def get_photo(session: AsyncSession, user_id: UUID, photo_id: UUID) -> Photo:
    """Get a single photo by ID with related data."""
    result = await session.execute(
        select(Photo)
        .options(
            selectinload(Photo.comments),
            selectinload(Photo.people_links).selectinload(PhotoPerson.person),
            selectinload(Photo.album_links).selectinload(AlbumPhoto.album),
        )
        .where(Photo.id == photo_id, Photo.user_id == user_id)
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise NotFoundError(f"Photo {photo_id} not found")
    return photo


async def update_photo(
    session: AsyncSession, user_id: UUID, photo_id: UUID, data: dict
) -> Photo:
    """Update photo fields."""
    photo = await get_photo(session, user_id, photo_id)

    for field, value in data.items():
        if hasattr(photo, field) and value is not None:
            setattr(photo, field, value)

    await session.commit()
    await session.refresh(photo)
    await publish_event("photo.updated", photo)
    return photo


async def delete_photo(session: AsyncSession, user_id: UUID, photo_id: UUID) -> None:
    """Delete a photo and its files from disk."""
    photo = await get_photo(session, user_id, photo_id)

    # Remove files
    try:
        os.remove(photo.storage_path)
    except OSError:
        pass

    # Remove thumbnails
    thumb_dir = _thumbs_dir(user_id)
    photo_uuid = Path(photo.storage_path).stem
    for size in ("sm", "md", "lg"):
        thumb_path = thumb_dir / size / f"{photo_uuid}.jpg"
        try:
            os.remove(str(thumb_path))
        except OSError:
            pass

    # Remove tags
    await session.execute(
        delete(Taggable).where(
            Taggable.entity_type == "photo",
            Taggable.entity_id == photo_id,
            Taggable.user_id == user_id,
        )
    )

    await publish_event("photo.deleted", photo)
    await session.delete(photo)
    await session.commit()


async def get_timeline(
    session: AsyncSession, user_id: UUID, *, limit: int = 200, offset: int = 0
) -> list[dict]:
    """Get photos grouped by date for timeline view."""
    photos = await list_photos(
        session, user_id, sort_by="taken_at", limit=limit, offset=offset
    )

    # Enrich with tags and comment counts
    summaries = await build_photo_summaries(session, user_id, photos)

    groups = defaultdict(list)
    for i, photo in enumerate(photos):
        date_key = (photo.taken_at or photo.created_at).strftime("%Y-%m-%d")
        groups[date_key].append(summaries[i])

    # Sort by date descending
    return [
        {"date": date, "photos": group_photos}
        for date, group_photos in sorted(groups.items(), reverse=True)
    ]


async def get_stats(session: AsyncSession, user_id: UUID) -> dict:
    """Get photo library statistics."""
    # Total count
    total = await session.execute(
        select(func.count(Photo.id)).where(Photo.user_id == user_id)
    )
    total_count = total.scalar() or 0

    # Favourites
    favs = await session.execute(
        select(func.count(Photo.id)).where(
            Photo.user_id == user_id, Photo.is_favourite == True
        )
    )
    fav_count = favs.scalar() or 0

    # By source
    source_counts = await session.execute(
        select(Photo.source_type, func.count(Photo.id))
        .where(Photo.user_id == user_id)
        .group_by(Photo.source_type)
    )
    by_source = {row[0]: row[1] for row in source_counts}

    # Storage used
    storage = await session.execute(
        select(func.sum(Photo.file_size)).where(Photo.user_id == user_id)
    )
    storage_used = storage.scalar() or 0

    # Date range
    date_range = None
    if total_count > 0:
        dates = await session.execute(
            select(
                func.min(Photo.taken_at),
                func.max(Photo.taken_at),
            ).where(Photo.user_id == user_id)
        )
        row = dates.one()
        if row[0] and row[1]:
            date_range = {
                "earliest": row[0].isoformat(),
                "latest": row[1].isoformat(),
            }

    return {
        "total": total_count,
        "favourites": fav_count,
        "by_source": by_source,
        "storage_used": storage_used,
        "date_range": date_range,
    }


async def get_duplicates(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Find near-duplicate photos grouped by perceptual hash."""
    # Find hashes that appear more than once
    dupes = await session.execute(
        select(Photo.perceptual_hash)
        .where(
            Photo.user_id == user_id,
            Photo.perceptual_hash.isnot(None),
        )
        .group_by(Photo.perceptual_hash)
        .having(func.count(Photo.id) > 1)
    )

    groups = []
    for (phash,) in dupes:
        photos = await session.execute(
            select(Photo)
            .where(
                Photo.user_id == user_id,
                Photo.perceptual_hash == phash,
            )
            .order_by(Photo.created_at)
        )
        groups.append({
            "perceptual_hash": phash,
            "photos": list(photos.scalars().all()),
        })

    return groups


def get_original_path(photo: Photo) -> Path:
    """Get filesystem path for original photo."""
    return Path(photo.storage_path)


def get_thumb_path(photo: Photo, size: str) -> Path | None:
    """Get filesystem path for a thumbnail."""
    if size not in ("sm", "md", "lg"):
        return None
    photo_uuid = Path(photo.storage_path).stem
    user_id = photo.user_id
    return _thumbs_dir(user_id) / size / f"{photo_uuid}.jpg"


async def add_photo_tag(
    session: AsyncSession, user_id: UUID, photo_id: UUID, tag_name: str
) -> Photo:
    """Add a tag to a photo using shared tag service."""
    # Verify photo exists
    await get_photo(session, user_id, photo_id)
    await add_tag(session, user_id, "photo", photo_id, tag_name)
    return await get_photo(session, user_id, photo_id)


async def remove_photo_tag(
    session: AsyncSession, user_id: UUID, photo_id: UUID, tag_id: UUID
) -> None:
    """Remove a tag from a photo."""
    await remove_tag(session, user_id, "photo", photo_id, tag_id)


async def get_photo_tags(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all tags used on photos with counts."""
    result = await session.execute(
        select(Tag.id, Tag.name, Tag.created_at, func.count(Taggable.id).label("photo_count"))
        .join(Taggable, Taggable.tag_id == Tag.id)
        .where(
            Taggable.entity_type == "photo",
            Tag.user_id == user_id,
        )
        .group_by(Tag.id, Tag.name, Tag.created_at)
        .order_by(Tag.name)
    )
    return [
        {"id": row.id, "name": row.name, "created_at": row.created_at, "photo_count": row.photo_count}
        for row in result
    ]


async def build_photo_response(session: AsyncSession, user_id: UUID, photo: Photo) -> dict:
    """Build a full PhotoResponse dict with tags, people, albums."""
    # Tags
    tags = await get_tags_for_entity(session, "photo", photo.id)
    tag_list = [{"id": t.id, "name": t.name, "created_at": t.created_at} for t in tags]

    # People
    people_list = [
        {"id": link.person.id, "name": link.person.name}
        for link in photo.people_links
    ]

    # Albums
    album_list = [
        {"id": link.album.id, "name": link.album.name}
        for link in photo.album_links
    ]

    # Comments
    comment_list = [
        {
            "id": c.id, "photo_id": c.photo_id, "text": c.text,
            "created_at": c.created_at, "updated_at": c.updated_at,
        }
        for c in photo.comments
    ]

    return {
        "id": photo.id,
        "filename": photo.filename,
        "content_type": photo.content_type,
        "file_size": photo.file_size,
        "width": photo.width,
        "height": photo.height,
        "file_hash": photo.file_hash,
        "perceptual_hash": photo.perceptual_hash,
        "taken_at": photo.taken_at,
        "latitude": photo.latitude,
        "longitude": photo.longitude,
        "location_name": photo.location_name,
        "exif_data": photo.exif_data,
        "is_favourite": photo.is_favourite,
        "caption": photo.caption,
        "rating": photo.rating,
        "source_type": photo.source_type,
        "source_account": photo.source_account,
        "processing_status": photo.processing_status,
        "tags": tag_list,
        "people": people_list,
        "albums": album_list,
        "comments": comment_list,
        "created_at": photo.created_at,
        "updated_at": photo.updated_at,
    }
