"""KB business logic — items, highlights, collections CRUD."""

from uuid import UUID

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts import tag_service
from pos_contracts.exceptions import NotFoundError
from pos_contracts.logging import trace

from .models import KBCollection, KBCollectionItem, KBHighlight, KBItem
from .tiptap_utils import extract_plain_text


# ── Helpers ──────────────────────────────────────────────


def _model_to_dict(model) -> dict:
    """Convert a SQLAlchemy model to dict, excluding SQLAlchemy internal state."""
    return {c.name: getattr(model, c.name) for c in model.__table__.columns}


async def _get_or_404(session, model_cls, user_id, item_id, label="Item"):
    result = await session.execute(
        select(model_cls).where(model_cls.id == item_id, model_cls.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError(f"{label} not found")
    return item


# ── KB Items ─────────────────────────────────────────────


@trace
async def get_items(
    session: AsyncSession,
    user_id: UUID,
    *,
    item_type: str | None = None,
    collection_id: UUID | None = None,
    is_favourite: bool | None = None,
    has_rating: bool | None = None,
    min_rating: int | None = None,
    search: str | None = None,
    tag: str | None = None,
    sort_by: str = "created_at",
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    """List KB items with filters."""
    query = select(KBItem).where(KBItem.user_id == user_id)

    if item_type:
        query = query.where(KBItem.item_type == item_type)
    if is_favourite is not None:
        query = query.where(KBItem.is_favourite == is_favourite)
    if has_rating:
        query = query.where(KBItem.rating.isnot(None))
    if min_rating is not None:
        query = query.where(KBItem.rating >= min_rating)

    # Collection filter
    if collection_id:
        query = query.join(
            KBCollectionItem, KBCollectionItem.kb_item_id == KBItem.id
        ).where(KBCollectionItem.collection_id == collection_id)

    # Tag filter
    if tag:
        tagged_ids = await tag_service.get_entities_by_tag(session, user_id, "kb_item", tag)
        if tagged_ids:
            query = query.where(KBItem.id.in_(tagged_ids))
        else:
            return []

    # Full-text search
    if search:
        query = query.where(
            text("search_vector @@ plainto_tsquery('english', :q)").bindparams(q=search)
        )

    # Sorting
    sort_map = {
        "created_at": KBItem.created_at.desc(),
        "updated_at": KBItem.updated_at.desc(),
        "title": KBItem.title.asc(),
        "rating": KBItem.rating.desc().nullslast(),
        "published_at": KBItem.published_at.desc().nullslast(),
    }
    query = query.order_by(sort_map.get(sort_by, KBItem.created_at.desc()))
    query = query.limit(limit).offset(offset)

    result = await session.execute(query)
    items = list(result.scalars().all())

    # Attach tags
    items_out = []
    for item in items:
        tags = await tag_service.get_tags_for_entity(session, "kb_item", item.id)
        d = _model_to_dict(item)
        d["tags"] = [{"id": t.id, "name": t.name, "created_at": t.created_at} for t in tags]
        items_out.append(d)

    return items_out


@trace
async def create_item(session: AsyncSession, user_id: UUID, data) -> dict:
    preview_text = data.preview_text
    if not preview_text and data.content and isinstance(data.content, dict):
        preview_text = extract_plain_text(data.content)

    item = KBItem(
        user_id=user_id,
        title=data.title,
        url=data.url,
        item_type=data.item_type,
        content=data.content,
        preview_text=preview_text,
        thumbnail_url=data.thumbnail_url,
        source=data.source,
        author=data.author,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return {**_model_to_dict(item), "tags": [], "highlights": []}


@trace
async def save_url(session: AsyncSession, user_id: UUID, url: str, preview=None) -> KBItem:
    """Create a KB item from a URL. Uses preview data if provided, otherwise placeholder."""
    item = KBItem(
        user_id=user_id,
        title=(preview.title if preview and preview.title else url),
        url=url,
        item_type=(preview.item_type if preview and preview.item_type else "url"),
        preview_text=(preview.description if preview and preview.description else None),
        thumbnail_url=(preview.image if preview and preview.image else None),
        site_name=(preview.site_name if preview and preview.site_name else None),
        author=(preview.author if preview and preview.author else None),
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


@trace
async def update_item_metadata(session: AsyncSession, item_id: UUID, metadata) -> None:
    """Update item with extracted metadata (called as background task)."""
    result = await session.execute(select(KBItem).where(KBItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        return

    if metadata.title:
        item.title = metadata.title
    if metadata.description:
        item.preview_text = metadata.description
    if metadata.image:
        item.thumbnail_url = metadata.image
    if metadata.author:
        item.author = metadata.author
    if metadata.site_name:
        item.site_name = metadata.site_name
    if metadata.item_type:
        item.item_type = metadata.item_type
    if metadata.word_count:
        item.word_count = metadata.word_count
    if metadata.reading_time_min:
        item.reading_time_min = metadata.reading_time_min

    await session.commit()


@trace
async def get_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> dict:
    item = await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    tags = await tag_service.get_tags_for_entity(session, "kb_item", item.id)

    # Eagerly load highlights
    highlights_result = await session.execute(
        select(KBHighlight)
        .where(KBHighlight.kb_item_id == item_id, KBHighlight.user_id == user_id)
        .order_by(KBHighlight.created_at)
    )
    highlights = list(highlights_result.scalars().all())

    # Collection membership
    coll_result = await session.execute(
        select(KBCollectionItem.collection_id)
        .where(KBCollectionItem.kb_item_id == item_id, KBCollectionItem.user_id == user_id)
    )

    d = _model_to_dict(item)
    d["tags"] = [{"id": t.id, "name": t.name, "created_at": t.created_at} for t in tags]
    d["highlights"] = [_model_to_dict(h) for h in highlights]
    d["collection_ids"] = [str(row[0]) for row in coll_result.all()]

    return d


@trace
async def update_item(session: AsyncSession, user_id: UUID, item_id: UUID, data) -> dict:
    item = await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    updates = data.model_dump(exclude_unset=True)

    # Auto-extract preview_text when content is updated but preview_text is not explicitly set
    if "content" in updates and "preview_text" not in updates:
        content = updates["content"]
        if content and isinstance(content, dict):
            updates["preview_text"] = extract_plain_text(content)

    for key, value in updates.items():
        setattr(item, key, value)
    await session.commit()
    await session.refresh(item)
    return await get_item(session, user_id, item_id)


@trace
async def delete_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> None:
    item = await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    await session.delete(item)
    await session.commit()


# ── Tags on Items ────────────────────────────────────────


@trace
async def add_tag(session: AsyncSession, user_id: UUID, item_id: UUID, tag_name: str) -> dict:
    await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    await tag_service.add_tag(session, user_id, "kb_item", item_id, tag_name)
    return await get_item(session, user_id, item_id)


@trace
async def remove_tag(session: AsyncSession, user_id: UUID, item_id: UUID, tag_id: UUID) -> None:
    await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    await tag_service.remove_tag(session, user_id, "kb_item", item_id, tag_id)


# ── Highlights ───────────────────────────────────────────


@trace
async def get_highlights(session: AsyncSession, user_id: UUID, item_id: UUID) -> list[dict]:
    await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    result = await session.execute(
        select(KBHighlight)
        .where(KBHighlight.kb_item_id == item_id, KBHighlight.user_id == user_id)
        .order_by(KBHighlight.created_at)
    )
    return [_model_to_dict(h) for h in result.scalars().all()]


@trace
async def create_highlight(session: AsyncSession, user_id: UUID, item_id: UUID, data) -> dict:
    await _get_or_404(session, KBItem, user_id, item_id, "KB Item")
    highlight = KBHighlight(
        user_id=user_id,
        kb_item_id=item_id,
        text=data.text,
        note=data.note,
        color=data.color,
        position_data=data.position_data,
    )
    session.add(highlight)
    await session.commit()
    await session.refresh(highlight)
    return _model_to_dict(highlight)


@trace
async def update_highlight(session: AsyncSession, user_id: UUID, highlight_id: UUID, data) -> dict:
    highlight = await _get_or_404(session, KBHighlight, user_id, highlight_id, "Highlight")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(highlight, key, value)
    await session.commit()
    await session.refresh(highlight)
    return _model_to_dict(highlight)


@trace
async def delete_highlight(session: AsyncSession, user_id: UUID, highlight_id: UUID) -> None:
    highlight = await _get_or_404(session, KBHighlight, user_id, highlight_id, "Highlight")
    await session.delete(highlight)
    await session.commit()


# ── Collections ──────────────────────────────────────────


@trace
async def get_collections(session: AsyncSession, user_id: UUID) -> list[dict]:
    result = await session.execute(
        select(KBCollection).where(KBCollection.user_id == user_id).order_by(KBCollection.position)
    )
    collections = list(result.scalars().all())

    # Get item counts
    count_result = await session.execute(
        select(KBCollectionItem.collection_id, func.count(KBCollectionItem.id))
        .where(KBCollectionItem.user_id == user_id)
        .group_by(KBCollectionItem.collection_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    return [
        {**_model_to_dict(c), "item_count": counts.get(c.id, 0)}
        for c in collections
    ]


@trace
async def create_collection(session: AsyncSession, user_id: UUID, data) -> dict:
    result = await session.execute(
        select(func.coalesce(func.max(KBCollection.position), -1))
        .where(KBCollection.user_id == user_id)
    )
    max_pos = result.scalar() or -1

    collection = KBCollection(
        user_id=user_id,
        name=data.name,
        description=data.description,
        cover_color=data.cover_color,
        icon=data.icon,
        position=max_pos + 1,
        is_pinned=data.is_pinned,
    )
    session.add(collection)
    await session.commit()
    await session.refresh(collection)
    return {**_model_to_dict(collection), "item_count": 0}


@trace
async def get_collection(session: AsyncSession, user_id: UUID, collection_id: UUID) -> dict:
    coll = await _get_or_404(session, KBCollection, user_id, collection_id, "Collection")
    d = _model_to_dict(coll)

    # Get items in collection
    result = await session.execute(
        select(KBItem)
        .join(KBCollectionItem, KBCollectionItem.kb_item_id == KBItem.id)
        .where(KBCollectionItem.collection_id == collection_id)
        .order_by(KBCollectionItem.position)
    )
    items = list(result.scalars().all())
    items_out = []
    for item in items:
        tags = await tag_service.get_tags_for_entity(session, "kb_item", item.id)
        item_d = _model_to_dict(item)
        item_d["tags"] = [{"id": t.id, "name": t.name, "created_at": t.created_at} for t in tags]
        items_out.append(item_d)

    d["items"] = items_out
    return d


@trace
async def update_collection(session: AsyncSession, user_id: UUID, collection_id: UUID, data) -> dict:
    coll = await _get_or_404(session, KBCollection, user_id, collection_id, "Collection")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(coll, key, value)
    await session.commit()
    await session.refresh(coll)
    return {**_model_to_dict(coll), "item_count": 0}


@trace
async def delete_collection(session: AsyncSession, user_id: UUID, collection_id: UUID) -> None:
    coll = await _get_or_404(session, KBCollection, user_id, collection_id, "Collection")
    await session.delete(coll)
    await session.commit()


@trace
async def add_item_to_collection(
    session: AsyncSession, user_id: UUID, collection_id: UUID, kb_item_id: UUID
) -> None:
    await _get_or_404(session, KBCollection, user_id, collection_id, "Collection")
    await _get_or_404(session, KBItem, user_id, kb_item_id, "KB Item")

    # Check if already in collection
    existing = await session.execute(
        select(KBCollectionItem).where(
            KBCollectionItem.collection_id == collection_id,
            KBCollectionItem.kb_item_id == kb_item_id,
        )
    )
    if existing.scalar_one_or_none():
        return  # already there

    result = await session.execute(
        select(func.coalesce(func.max(KBCollectionItem.position), -1))
        .where(KBCollectionItem.collection_id == collection_id)
    )
    max_pos = result.scalar() or -1

    ci = KBCollectionItem(
        user_id=user_id,
        collection_id=collection_id,
        kb_item_id=kb_item_id,
        position=max_pos + 1,
    )
    session.add(ci)
    await session.commit()


@trace
async def remove_item_from_collection(
    session: AsyncSession, user_id: UUID, collection_id: UUID, kb_item_id: UUID
) -> None:
    await _get_or_404(session, KBCollection, user_id, collection_id, "Collection")
    await session.execute(
        delete(KBCollectionItem).where(
            KBCollectionItem.collection_id == collection_id,
            KBCollectionItem.kb_item_id == kb_item_id,
        )
    )
    await session.commit()


# ── Tags (with KB item counts) ───────────────────────────


@trace
async def get_tags(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all tags that have KB item associations, with counts."""
    all_tags = await tag_service.get_all_tags(session, user_id)
    return [
        {
            "id": t["id"],
            "name": t["name"],
            "kb_item_count": t["counts"].get("kb_item", 0),
            "created_at": t["created_at"],
        }
        for t in all_tags
        if t["counts"].get("kb_item", 0) > 0
    ]


# ── Stats ────────────────────────────────────────────────


@trace
async def get_stats(session: AsyncSession, user_id: UUID) -> dict:
    """Counts by type and favourites."""
    total = await session.execute(
        select(func.count(KBItem.id)).where(KBItem.user_id == user_id)
    )

    by_type = await session.execute(
        select(KBItem.item_type, func.count(KBItem.id))
        .where(KBItem.user_id == user_id)
        .group_by(KBItem.item_type)
    )

    fav_count = await session.execute(
        select(func.count(KBItem.id))
        .where(KBItem.user_id == user_id, KBItem.is_favourite.is_(True))
    )

    return {
        "total": total.scalar() or 0,
        "by_type": {row[0]: row[1] for row in by_type.all()},
        "favourites": fav_count.scalar() or 0,
    }
