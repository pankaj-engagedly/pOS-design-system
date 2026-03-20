"""Feed business logic — folders, sources, items, polling."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError
from pos_contracts.logging import trace

from .models import FeedFolder, FeedItem, FeedSource, KBItem


# ── Helpers ──────────────────────────────────────────────


def _model_to_dict(model) -> dict:
    return {c.name: getattr(model, c.name) for c in model.__table__.columns}


async def _get_or_404(session, model_cls, user_id, item_id, label="Item"):
    result = await session.execute(
        select(model_cls).where(model_cls.id == item_id, model_cls.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError(f"{label} not found")
    return item


# ── Feed Folders ─────────────────────────────────────────


@trace
async def get_feed_folders(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all feed folders with unread counts."""
    result = await session.execute(
        select(FeedFolder).where(FeedFolder.user_id == user_id).order_by(FeedFolder.position)
    )
    folders = list(result.scalars().all())

    # Unread counts per folder
    count_result = await session.execute(
        select(FeedSource.folder_id, func.count(FeedItem.id))
        .join(FeedItem, FeedItem.feed_source_id == FeedSource.id)
        .where(FeedSource.user_id == user_id, FeedItem.is_read.is_(False))
        .group_by(FeedSource.folder_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    return [
        {**_model_to_dict(f), "unread_count": counts.get(f.id, 0)}
        for f in folders
    ]


@trace
async def create_feed_folder(session: AsyncSession, user_id: UUID, data) -> dict:
    result = await session.execute(
        select(func.coalesce(func.max(FeedFolder.position), -1))
        .where(FeedFolder.user_id == user_id)
    )
    max_pos = result.scalar() or -1

    folder = FeedFolder(user_id=user_id, name=data.name, position=max_pos + 1)
    session.add(folder)
    await session.commit()
    await session.refresh(folder)
    return {**_model_to_dict(folder), "unread_count": 0}


@trace
async def update_feed_folder(session: AsyncSession, user_id: UUID, folder_id: UUID, data) -> dict:
    folder = await _get_or_404(session, FeedFolder, user_id, folder_id, "Feed Folder")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(folder, key, value)
    await session.commit()
    await session.refresh(folder)
    return {**_model_to_dict(folder), "unread_count": 0}


@trace
async def delete_feed_folder(session: AsyncSession, user_id: UUID, folder_id: UUID) -> None:
    folder = await _get_or_404(session, FeedFolder, user_id, folder_id, "Feed Folder")
    # Nullify folder_id on sources
    await session.execute(
        update(FeedSource).where(FeedSource.folder_id == folder_id).values(folder_id=None)
    )
    await session.delete(folder)
    await session.commit()


# ── Feed Sources ─────────────────────────────────────────


@trace
async def get_feed_sources(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all subscribed feeds with unread counts."""
    result = await session.execute(
        select(FeedSource).where(FeedSource.user_id == user_id).order_by(FeedSource.title)
    )
    sources = list(result.scalars().all())

    # Unread counts per source
    count_result = await session.execute(
        select(FeedItem.feed_source_id, func.count(FeedItem.id))
        .where(FeedItem.user_id == user_id, FeedItem.is_read.is_(False))
        .group_by(FeedItem.feed_source_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    return [
        {**_model_to_dict(s), "unread_count": counts.get(s.id, 0)}
        for s in sources
    ]


@trace
async def subscribe(session: AsyncSession, user_id: UUID, parsed_feed, folder_id=None) -> FeedSource:
    """Create a feed source from parsed feed data."""
    source = FeedSource(
        user_id=user_id,
        title=parsed_feed.title or parsed_feed.url,
        url=parsed_feed.url,
        site_url=parsed_feed.site_url,
        feed_type=parsed_feed.feed_type,
        icon_url=parsed_feed.icon_url,
        folder_id=folder_id,
        last_polled_at=datetime.now(timezone.utc),
    )
    session.add(source)
    await session.flush()

    # Import latest 50 items
    for entry in parsed_feed.items[:50]:
        feed_item = FeedItem(
            user_id=user_id,
            feed_source_id=source.id,
            guid=entry.guid,
            title=entry.title,
            url=entry.url,
            author=entry.author,
            summary=entry.summary,
            content_html=entry.content_html,
            thumbnail_url=entry.thumbnail_url,
            published_at=entry.published_at,
        )
        session.add(feed_item)

    await session.commit()
    await session.refresh(source)
    return source


@trace
async def update_feed_source(session: AsyncSession, user_id: UUID, source_id: UUID, data) -> dict:
    source = await _get_or_404(session, FeedSource, user_id, source_id, "Feed Source")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(source, key, value)
    await session.commit()
    await session.refresh(source)
    return {**_model_to_dict(source), "unread_count": 0}


@trace
async def unsubscribe(session: AsyncSession, user_id: UUID, source_id: UUID) -> None:
    source = await _get_or_404(session, FeedSource, user_id, source_id, "Feed Source")
    await session.delete(source)
    await session.commit()


@trace
async def refresh_source(session: AsyncSession, user_id: UUID, source_id: UUID, parsed_feed) -> int:
    """Upsert new items from a refreshed feed. Returns count of new items."""
    source = await _get_or_404(session, FeedSource, user_id, source_id, "Feed Source")
    new_count = 0

    for entry in parsed_feed.items:
        # Check if guid already exists for this source
        existing = await session.execute(
            select(FeedItem).where(
                FeedItem.feed_source_id == source_id,
                FeedItem.guid == entry.guid,
            )
        )
        if existing.scalar_one_or_none():
            continue

        feed_item = FeedItem(
            user_id=user_id,
            feed_source_id=source_id,
            guid=entry.guid,
            title=entry.title,
            url=entry.url,
            author=entry.author,
            summary=entry.summary,
            content_html=entry.content_html,
            thumbnail_url=entry.thumbnail_url,
            published_at=entry.published_at,
        )
        session.add(feed_item)
        new_count += 1

    source.last_polled_at = datetime.now(timezone.utc)
    source.error_count = 0
    source.last_error = None
    await session.commit()

    return new_count


@trace
async def record_poll_error(session: AsyncSession, source_id: UUID, error: str) -> None:
    """Record a poll failure. Disables after 10 consecutive failures."""
    result = await session.execute(select(FeedSource).where(FeedSource.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        return

    source.error_count += 1
    source.last_error = error
    source.last_polled_at = datetime.now(timezone.utc)

    if source.error_count >= 10:
        source.is_active = False

    await session.commit()


# ── Feed Items ───────────────────────────────────────────


@trace
async def get_feed_items(
    session: AsyncSession,
    user_id: UUID,
    *,
    source_id: UUID | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_starred: bool | None = None,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """List feed items with filters, including source info."""
    query = select(FeedItem).where(FeedItem.user_id == user_id)

    if source_id:
        query = query.where(FeedItem.feed_source_id == source_id)
    if folder_id:
        query = query.join(FeedSource, FeedSource.id == FeedItem.feed_source_id).where(
            FeedSource.folder_id == folder_id
        )
    if is_read is not None:
        query = query.where(FeedItem.is_read == is_read)
    if is_starred is not None:
        query = query.where(FeedItem.is_starred == is_starred)

    query = query.order_by(FeedItem.published_at.desc().nullslast(), FeedItem.created_at.desc())
    query = query.limit(limit).offset(offset)

    result = await session.execute(query)
    items = list(result.scalars().all())

    # Batch-load source info
    source_ids = {i.feed_source_id for i in items}
    sources_result = await session.execute(
        select(FeedSource).where(FeedSource.id.in_(source_ids))
    )
    sources = {s.id: s for s in sources_result.scalars().all()}

    items_out = []
    for item in items:
        d = _model_to_dict(item)
        source = sources.get(item.feed_source_id)
        d["source_title"] = source.title if source else None
        d["source_icon_url"] = source.icon_url if source else None
        items_out.append(d)

    return items_out


@trace
async def update_feed_item(session: AsyncSession, user_id: UUID, item_id: UUID, data) -> dict:
    item = await _get_or_404(session, FeedItem, user_id, item_id, "Feed Item")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await session.commit()
    await session.refresh(item)

    # Get source info
    source_result = await session.execute(
        select(FeedSource).where(FeedSource.id == item.feed_source_id)
    )
    source = source_result.scalar_one_or_none()

    d = _model_to_dict(item)
    d["source_title"] = source.title if source else None
    d["source_icon_url"] = source.icon_url if source else None
    return d


@trace
async def save_feed_item_to_kb(session: AsyncSession, user_id: UUID, feed_item_id: UUID) -> KBItem:
    """Save a feed item as a KB item."""
    feed_item = await _get_or_404(session, FeedItem, user_id, feed_item_id, "Feed Item")

    # Check if already saved
    if feed_item.kb_item_id:
        result = await session.execute(
            select(KBItem).where(KBItem.id == feed_item.kb_item_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing

    # Determine item type from source
    source_result = await session.execute(
        select(FeedSource).where(FeedSource.id == feed_item.feed_source_id)
    )
    source = source_result.scalar_one_or_none()
    item_type = "article"
    if source:
        if source.feed_type == "youtube":
            item_type = "video"
        elif source.feed_type == "podcast":
            item_type = "podcast"

    kb_item = KBItem(
        user_id=user_id,
        title=feed_item.title,
        url=feed_item.url,
        source=source.title if source else None,
        author=feed_item.author,
        item_type=item_type,
        preview_text=feed_item.summary,
        thumbnail_url=feed_item.thumbnail_url,
        published_at=feed_item.published_at,
        feed_item_id=feed_item.id,
    )
    session.add(kb_item)
    await session.flush()

    # Link back
    feed_item.kb_item_id = kb_item.id
    feed_item.is_read = True
    await session.commit()
    await session.refresh(kb_item)

    return kb_item


@trace
async def mark_all_read(
    session: AsyncSession,
    user_id: UUID,
    source_id: UUID | None = None,
    folder_id: UUID | None = None,
) -> int:
    """Mark all feed items as read, optionally scoped to source or folder."""
    query = update(FeedItem).where(
        FeedItem.user_id == user_id,
        FeedItem.is_read.is_(False),
    )

    if source_id:
        query = query.where(FeedItem.feed_source_id == source_id)
    elif folder_id:
        # Get source IDs in folder
        sources = await session.execute(
            select(FeedSource.id).where(FeedSource.folder_id == folder_id)
        )
        source_ids = [row[0] for row in sources.all()]
        if source_ids:
            query = query.where(FeedItem.feed_source_id.in_(source_ids))
        else:
            return 0

    query = query.values(is_read=True)
    result = await session.execute(query)
    await session.commit()
    return result.rowcount


# ── Feed Stats ───────────────────────────────────────────


@trace
async def get_feed_stats(session: AsyncSession, user_id: UUID) -> dict:
    """Total unread, unread per source, per folder."""
    total = await session.execute(
        select(func.count(FeedItem.id))
        .where(FeedItem.user_id == user_id, FeedItem.is_read.is_(False))
    )

    by_source = await session.execute(
        select(FeedSource.title, func.count(FeedItem.id))
        .join(FeedItem, FeedItem.feed_source_id == FeedSource.id)
        .where(FeedItem.user_id == user_id, FeedItem.is_read.is_(False))
        .group_by(FeedSource.title)
    )

    by_folder = await session.execute(
        select(FeedFolder.name, func.count(FeedItem.id))
        .join(FeedSource, FeedSource.folder_id == FeedFolder.id)
        .join(FeedItem, FeedItem.feed_source_id == FeedSource.id)
        .where(FeedItem.user_id == user_id, FeedItem.is_read.is_(False))
        .group_by(FeedFolder.name)
    )

    return {
        "total_unread": total.scalar() or 0,
        "by_source": {row[0]: row[1] for row in by_source.all()},
        "by_folder": {row[0]: row[1] for row in by_folder.all()},
    }


# ── Polling (called by scheduler) ───────────────────────


async def get_due_sources(session: AsyncSession) -> list[FeedSource]:
    """Get all active sources that are due for polling."""
    result = await session.execute(
        select(FeedSource).where(
            FeedSource.is_active.is_(True),
            # Due when: last_polled_at + interval < now
            # or never polled
            (
                FeedSource.last_polled_at.is_(None)
                | (
                    FeedSource.last_polled_at
                    + func.make_interval(0, 0, 0, 0, 0, FeedSource.poll_interval_min)
                    < func.now()
                )
            ),
        )
    )
    return list(result.scalars().all())
