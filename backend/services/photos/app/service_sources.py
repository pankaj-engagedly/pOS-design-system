"""Photo source CRUD operations."""

from pathlib import Path
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .models import Photo, PhotoSource


async def create_source(
    session: AsyncSession,
    user_id: str,
    provider: str,
    source_path: str,
    label: str | None = None,
) -> PhotoSource:
    """Create a new photo sync source."""
    # Validate path exists
    p = Path(source_path)
    if provider == "folder":
        if not p.is_dir():
            raise ValueError(f"Folder not found: {source_path}")
    elif provider == "apple_photos":
        if not source_path.endswith(".photoslibrary"):
            raise ValueError("Path must end with .photoslibrary")
        if not p.exists():
            raise ValueError(f"Photos Library not found: {source_path}")

    source = PhotoSource(
        user_id=user_id,
        provider=provider,
        source_path=source_path,
        label=label,
    )
    session.add(source)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ValueError(f"Source already exists: {provider} at {source_path}")
    await session.commit()
    await session.refresh(source)
    return source


async def list_sources(
    session: AsyncSession,
    user_id: str,
) -> list[PhotoSource]:
    """List all sources for a user."""
    result = await session.execute(
        select(PhotoSource)
        .where(PhotoSource.user_id == user_id)
        .order_by(PhotoSource.created_at)
    )
    return list(result.scalars().all())


async def get_source(
    session: AsyncSession,
    user_id: str,
    source_id: UUID,
) -> PhotoSource:
    """Get a single source by ID."""
    result = await session.execute(
        select(PhotoSource).where(
            PhotoSource.user_id == user_id,
            PhotoSource.id == source_id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise NotFoundError("Photo source not found")
    return source


async def update_source(
    session: AsyncSession,
    user_id: str,
    source_id: UUID,
    label: str | None = None,
    is_active: bool | None = None,
) -> PhotoSource:
    """Update source label and/or active status."""
    source = await get_source(session, user_id, source_id)
    if label is not None:
        source.label = label
    if is_active is not None:
        source.is_active = is_active
    await session.commit()
    await session.refresh(source)
    return source


async def delete_source(
    session: AsyncSession,
    user_id: str,
    source_id: UUID,
) -> None:
    """Delete a source. Does NOT delete imported photos."""
    source = await get_source(session, user_id, source_id)
    await session.delete(source)
    await session.commit()


async def update_sync_status(
    session: AsyncSession,
    source: PhotoSource,
    status: str,
    error: str | None = None,
) -> None:
    """Update sync status on a source (used by scheduler)."""
    source.sync_status = status
    if error is not None:
        source.last_error = error
    elif status == "idle":
        source.last_error = None
    if status == "idle":
        source.last_sync_at = func.now()
        # Update photo count
        count_result = await session.execute(
            select(func.count()).select_from(Photo).where(
                Photo.user_id == source.user_id,
                Photo.source_type == source.provider,
                Photo.source_account == str(source.id),
            )
        )
        source.photo_count = count_result.scalar() or 0
    await session.commit()
