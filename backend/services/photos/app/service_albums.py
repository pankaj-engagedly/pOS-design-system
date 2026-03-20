"""Album business logic — CRUD, photo membership."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .events import publish_event
from .models import Album, AlbumPhoto, Photo
from .service_photos import build_photo_summaries


async def list_albums(session: AsyncSession, user_id: UUID) -> list[dict]:
    """List all albums with photo counts."""
    result = await session.execute(
        select(
            Album,
            func.count(AlbumPhoto.id).label("photo_count"),
        )
        .outerjoin(AlbumPhoto, AlbumPhoto.album_id == Album.id)
        .where(Album.user_id == user_id)
        .group_by(Album.id)
        .order_by(Album.position, Album.name)
    )

    albums = []
    for row in result:
        album = row[0]
        albums.append({
            "id": album.id,
            "name": album.name,
            "description": album.description,
            "cover_photo_id": album.cover_photo_id,
            "album_type": album.album_type,
            "position": album.position,
            "is_pinned": album.is_pinned,
            "photo_count": row[1],
            "created_at": album.created_at,
            "updated_at": album.updated_at,
        })
    return albums


async def create_album(
    session: AsyncSession, user_id: UUID, name: str, description: str | None = None
) -> Album:
    """Create a new album."""
    album = Album(
        user_id=user_id,
        name=name,
        description=description,
    )
    session.add(album)
    await session.commit()
    await session.refresh(album)
    await publish_event("album.created", album)
    return album


async def get_album(session: AsyncSession, user_id: UUID, album_id: UUID) -> Album:
    """Get a single album by ID."""
    result = await session.execute(
        select(Album).where(Album.id == album_id, Album.user_id == user_id)
    )
    album = result.scalar_one_or_none()
    if not album:
        raise NotFoundError(f"Album {album_id} not found")
    return album


async def get_album_with_photos(
    session: AsyncSession, user_id: UUID, album_id: UUID,
    *, limit: int = 100, offset: int = 0,
) -> dict:
    """Get album detail with photos."""
    album = await get_album(session, user_id, album_id)

    photos_result = await session.execute(
        select(Photo)
        .join(AlbumPhoto)
        .where(AlbumPhoto.album_id == album_id, Photo.user_id == user_id)
        .order_by(AlbumPhoto.position, Photo.taken_at.desc().nullslast())
        .offset(offset)
        .limit(limit)
    )
    photos = list(photos_result.scalars().all())

    # Count
    count_result = await session.execute(
        select(func.count(AlbumPhoto.id)).where(AlbumPhoto.album_id == album_id)
    )
    photo_count = count_result.scalar() or 0

    # Enrich photos with tags and comment counts
    photo_summaries = await build_photo_summaries(session, user_id, photos)

    return {
        "id": album.id,
        "name": album.name,
        "description": album.description,
        "cover_photo_id": album.cover_photo_id,
        "album_type": album.album_type,
        "position": album.position,
        "is_pinned": album.is_pinned,
        "photos": photo_summaries,
        "photo_count": photo_count,
        "created_at": album.created_at,
        "updated_at": album.updated_at,
    }


async def update_album(
    session: AsyncSession, user_id: UUID, album_id: UUID, data: dict
) -> Album:
    """Update album fields."""
    album = await get_album(session, user_id, album_id)
    for field, value in data.items():
        if hasattr(album, field) and value is not None:
            setattr(album, field, value)
    await session.commit()
    await session.refresh(album)
    return album


async def delete_album(session: AsyncSession, user_id: UUID, album_id: UUID) -> None:
    """Delete an album (NOT the photos)."""
    album = await get_album(session, user_id, album_id)
    await publish_event("album.deleted", album)
    await session.delete(album)
    await session.commit()


async def add_photos_to_album(
    session: AsyncSession, user_id: UUID, album_id: UUID, photo_ids: list[UUID]
) -> int:
    """Add photos to an album. Returns count of newly added."""
    # Verify album exists
    await get_album(session, user_id, album_id)

    # Get existing memberships
    existing = await session.execute(
        select(AlbumPhoto.photo_id).where(
            AlbumPhoto.album_id == album_id,
            AlbumPhoto.photo_id.in_(photo_ids),
        )
    )
    existing_ids = {row[0] for row in existing}

    # Get max position
    max_pos = await session.execute(
        select(func.max(AlbumPhoto.position)).where(AlbumPhoto.album_id == album_id)
    )
    pos = (max_pos.scalar() or 0) + 1

    added = 0
    for photo_id in photo_ids:
        if photo_id in existing_ids:
            continue
        # Verify photo belongs to user
        photo = await session.execute(
            select(Photo.id).where(Photo.id == photo_id, Photo.user_id == user_id)
        )
        if photo.scalar_one_or_none():
            link = AlbumPhoto(
                user_id=user_id,
                album_id=album_id,
                photo_id=photo_id,
                position=pos,
            )
            session.add(link)
            pos += 1
            added += 1

    await session.commit()
    return added


async def remove_photo_from_album(
    session: AsyncSession, user_id: UUID, album_id: UUID, photo_id: UUID
) -> None:
    """Remove a photo from an album."""
    result = await session.execute(
        select(AlbumPhoto).where(
            AlbumPhoto.album_id == album_id,
            AlbumPhoto.photo_id == photo_id,
        )
    )
    link = result.scalar_one_or_none()
    if not link:
        raise NotFoundError("Photo not in album")
    await session.delete(link)
    await session.commit()
