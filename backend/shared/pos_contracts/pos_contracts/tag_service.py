"""Shared tag service — all tag operations go through here.

Services (notes, documents, etc.) call these functions instead of querying
the tags/taggables tables directly. This abstraction layer enables future
extraction to a standalone tags service — swap SQL queries for HTTP calls
in this one file, zero service code changes needed.
"""

from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Tag, Taggable


async def add_tag(
    session: AsyncSession,
    user_id: UUID,
    entity_type: str,
    entity_id: UUID,
    tag_name: str,
) -> Tag:
    """Get-or-create a tag and link it to an entity. Idempotent."""
    # Get or create the tag
    result = await session.execute(
        select(Tag).where(Tag.user_id == user_id, Tag.name == tag_name)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        tag = Tag(user_id=user_id, name=tag_name)
        session.add(tag)
        await session.flush()  # get tag.id

    # Create taggable link if it doesn't already exist
    existing = await session.execute(
        select(Taggable).where(
            Taggable.tag_id == tag.id,
            Taggable.entity_type == entity_type,
            Taggable.entity_id == entity_id,
        )
    )
    if not existing.scalar_one_or_none():
        taggable = Taggable(
            user_id=user_id,
            tag_id=tag.id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        session.add(taggable)

    await session.commit()
    return tag


async def remove_tag(
    session: AsyncSession,
    user_id: UUID,
    entity_type: str,
    entity_id: UUID,
    tag_id: UUID,
) -> None:
    """Remove a tag link from an entity (does not delete the tag itself)."""
    await session.execute(
        delete(Taggable).where(
            Taggable.tag_id == tag_id,
            Taggable.entity_type == entity_type,
            Taggable.entity_id == entity_id,
        )
    )
    await session.commit()


async def get_tags_for_entity(
    session: AsyncSession,
    entity_type: str,
    entity_id: UUID,
) -> list[Tag]:
    """Return all tags linked to a specific entity."""
    result = await session.execute(
        select(Tag)
        .join(Taggable, Taggable.tag_id == Tag.id)
        .where(
            Taggable.entity_type == entity_type,
            Taggable.entity_id == entity_id,
        )
        .order_by(Tag.name)
    )
    return list(result.scalars().all())


async def get_all_tags(
    session: AsyncSession,
    user_id: UUID,
) -> list[dict]:
    """Return all tags for a user with per-entity-type counts.

    Returns list of dicts: {"id": ..., "name": ..., "counts": {"note": 3, "document": 5}}
    """
    tags_result = await session.execute(
        select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)
    )
    tags = list(tags_result.scalars().all())

    # Count per (tag_id, entity_type)
    counts_result = await session.execute(
        select(Taggable.tag_id, Taggable.entity_type, func.count(Taggable.entity_id))
        .join(Tag, Tag.id == Taggable.tag_id)
        .where(Tag.user_id == user_id)
        .group_by(Taggable.tag_id, Taggable.entity_type)
    )
    # Build {tag_id: {entity_type: count}}
    counts: dict[UUID, dict[str, int]] = {}
    for tag_id, entity_type, count in counts_result.all():
        counts.setdefault(tag_id, {})[entity_type] = count

    return [
        {
            "id": tag.id,
            "name": tag.name,
            "user_id": tag.user_id,
            "created_at": tag.created_at,
            "updated_at": tag.updated_at,
            "counts": counts.get(tag.id, {}),
        }
        for tag in tags
    ]


async def get_entities_by_tag(
    session: AsyncSession,
    user_id: UUID,
    entity_type: str,
    tag_name: str,
) -> list[UUID]:
    """Return entity_ids of a given type that are tagged with tag_name."""
    result = await session.execute(
        select(Taggable.entity_id)
        .join(Tag, Tag.id == Taggable.tag_id)
        .where(
            Tag.user_id == user_id,
            Tag.name == tag_name,
            Taggable.entity_type == entity_type,
        )
    )
    return [row[0] for row in result.all()]
