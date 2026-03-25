"""Watchlist business logic — CRUD for items, stages, themes, stats."""

from uuid import UUID

from loguru import logger
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError

from .models import MarketDataCache, PipelineStage, Security, WatchlistItem, WatchlistTheme


# ── Default pipeline stages ────────────────────────────


DEFAULT_STAGES = [
    {"name": "Interesting", "slug": "interesting", "position": 1, "color": "#3b82f6", "is_terminal": False},
    {"name": "Serious", "slug": "serious", "position": 2, "color": "#f59e0b", "is_terminal": False},
    {"name": "Shortlisted", "slug": "shortlisted", "position": 3, "color": "#10b981", "is_terminal": False},
    {"name": "Portfolio", "slug": "portfolio", "position": 4, "color": "#8b5cf6", "is_terminal": True},
    {"name": "Rejected", "slug": "rejected", "position": 5, "color": "#ef4444", "is_terminal": True},
]


async def seed_default_stages(session: AsyncSession, user_id: UUID) -> list[PipelineStage]:
    """Seed default pipeline stages if none exist for user."""
    result = await session.execute(
        select(PipelineStage).where(PipelineStage.user_id == user_id)
    )
    existing = result.scalars().all()
    if existing:
        return list(existing)

    stages = []
    for s in DEFAULT_STAGES:
        stage = PipelineStage(user_id=user_id, **s)
        session.add(stage)
        stages.append(stage)
    await session.commit()
    for s in stages:
        await session.refresh(s)
    logger.info(f"Seeded {len(stages)} default pipeline stages for user {user_id}")
    return stages


# ── Pipeline Stages CRUD ───────────────────────────────


async def list_stages(session: AsyncSession, user_id: UUID) -> list[PipelineStage]:
    """List all stages for a user, ordered by position."""
    result = await session.execute(
        select(PipelineStage)
        .where(PipelineStage.user_id == user_id)
        .order_by(PipelineStage.position)
    )
    stages = list(result.scalars().all())
    if not stages:
        stages = await seed_default_stages(session, user_id)
    return stages


async def create_stage(session: AsyncSession, user_id: UUID, **kwargs) -> PipelineStage:
    import re
    if not kwargs.get("slug") and kwargs.get("name"):
        kwargs["slug"] = re.sub(r"[^a-z0-9]+", "_", kwargs["name"].lower()).strip("_")
    stage = PipelineStage(user_id=user_id, **kwargs)
    session.add(stage)
    await session.commit()
    await session.refresh(stage)
    return stage


async def update_stage(session: AsyncSession, user_id: UUID, stage_id: UUID, **kwargs) -> PipelineStage:
    result = await session.execute(
        select(PipelineStage).where(PipelineStage.id == stage_id, PipelineStage.user_id == user_id)
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise NotFoundError("Stage not found")
    for k, v in kwargs.items():
        if v is not None:
            setattr(stage, k, v)
    await session.commit()
    await session.refresh(stage)
    return stage


async def reorder_stages(session: AsyncSession, user_id: UUID, stage_ids: list[UUID]) -> list[PipelineStage]:
    """Reorder stages by setting position based on list order."""
    result = await session.execute(
        select(PipelineStage).where(PipelineStage.user_id == user_id)
    )
    stages_by_id = {s.id: s for s in result.scalars().all()}
    for i, sid in enumerate(stage_ids):
        if sid in stages_by_id:
            stages_by_id[sid].position = i
    await session.commit()
    return await list_stages(session, user_id)


async def delete_stage(session: AsyncSession, user_id: UUID, stage_id: UUID) -> None:
    result = await session.execute(
        select(PipelineStage).where(PipelineStage.id == stage_id, PipelineStage.user_id == user_id)
    )
    stage = result.scalar_one_or_none()
    if not stage:
        raise NotFoundError("Stage not found")
    # Nullify items referencing this stage
    await session.execute(
        update(WatchlistItem)
        .where(WatchlistItem.stage_id == stage_id)
        .values(stage_id=None)
    )
    await session.delete(stage)
    await session.commit()


# ── Themes CRUD ────────────────────────────────────────


async def list_themes(
    session: AsyncSession,
    user_id: UUID,
    asset_type: str | None = None,
) -> list[WatchlistTheme]:
    """List themes for a user, optionally filtered by asset_type."""
    query = (
        select(WatchlistTheme)
        .where(WatchlistTheme.user_id == user_id)
        .order_by(WatchlistTheme.position)
    )
    if asset_type:
        query = query.where(WatchlistTheme.asset_type == asset_type)
    result = await session.execute(query)
    return list(result.scalars().all())


async def create_theme(session: AsyncSession, user_id: UUID, **kwargs) -> WatchlistTheme:
    theme = WatchlistTheme(user_id=user_id, **kwargs)
    session.add(theme)
    await session.commit()
    await session.refresh(theme)
    return theme


async def update_theme(session: AsyncSession, user_id: UUID, theme_id: UUID, **kwargs) -> WatchlistTheme:
    result = await session.execute(
        select(WatchlistTheme).where(WatchlistTheme.id == theme_id, WatchlistTheme.user_id == user_id)
    )
    theme = result.scalar_one_or_none()
    if not theme:
        raise NotFoundError("Theme not found")
    for k, v in kwargs.items():
        if v is not None:
            setattr(theme, k, v)
    await session.commit()
    await session.refresh(theme)
    return theme


async def delete_theme(session: AsyncSession, user_id: UUID, theme_id: UUID) -> None:
    result = await session.execute(
        select(WatchlistTheme).where(WatchlistTheme.id == theme_id, WatchlistTheme.user_id == user_id)
    )
    theme = result.scalar_one_or_none()
    if not theme:
        raise NotFoundError("Theme not found")
    # Nullify items referencing this theme
    await session.execute(
        update(WatchlistItem)
        .where(WatchlistItem.theme_id == theme_id)
        .values(theme_id=None)
    )
    # Also nullify sub-themes
    await session.execute(
        update(WatchlistTheme)
        .where(WatchlistTheme.parent_id == theme_id)
        .values(parent_id=None)
    )
    await session.delete(theme)
    await session.commit()


# ── Watchlist Items CRUD ───────────────────────────────


async def list_items(
    session: AsyncSession,
    user_id: UUID,
    asset_type: str | None = None,
    stage_id: UUID | None = None,
    theme_id: UUID | None = None,
    is_favourite: bool | None = None,
    sort_by: str = "created_at",
    limit: int = 200,
) -> list[WatchlistItem]:
    """List watchlist items with optional filters."""
    query = (
        select(WatchlistItem)
        .options(
            selectinload(WatchlistItem.stage),
            selectinload(WatchlistItem.theme),
            selectinload(WatchlistItem.security).selectinload(Security.cache),
        )
        .where(WatchlistItem.user_id == user_id)
    )

    if asset_type:
        query = query.where(WatchlistItem.asset_type == asset_type)
    if stage_id:
        query = query.where(WatchlistItem.stage_id == stage_id)
    if theme_id:
        query = query.where(WatchlistItem.theme_id == theme_id)
    if is_favourite is not None:
        query = query.where(WatchlistItem.is_favourite == is_favourite)

    # Sorting
    sort_col = getattr(WatchlistItem, sort_by, WatchlistItem.created_at)
    query = query.order_by(sort_col.desc()).limit(limit)

    result = await session.execute(query)
    return list(result.scalars().all())


async def get_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> WatchlistItem:
    result = await session.execute(
        select(WatchlistItem)
        .options(
            selectinload(WatchlistItem.stage),
            selectinload(WatchlistItem.theme),
            selectinload(WatchlistItem.security).selectinload(Security.cache),
        )
        .where(WatchlistItem.id == item_id, WatchlistItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Watchlist item not found")
    return item


async def get_or_create_security(
    session: AsyncSession, symbol: str, name: str, asset_type: str, exchange: str | None = None,
) -> Security:
    """Get existing security or create a new one. Shared across users."""
    result = await session.execute(
        select(Security).where(Security.symbol == symbol, Security.asset_type == asset_type)
    )
    security = result.scalar_one_or_none()
    if security:
        return security

    security = Security(symbol=symbol, name=name, asset_type=asset_type, exchange=exchange)
    session.add(security)
    await session.flush()

    # Create empty cache record for the security
    cache = MarketDataCache(security_id=security.id)
    session.add(cache)
    await session.commit()
    await session.refresh(security)
    return security


async def create_item(session: AsyncSession, user_id: UUID, **kwargs) -> WatchlistItem:
    """Create a watchlist item. Auto-assigns first stage if none provided."""
    if not kwargs.get("stage_id"):
        stages = await list_stages(session, user_id)
        if stages:
            kwargs["stage_id"] = stages[0].id

    # Get or create the shared security
    security = await get_or_create_security(
        session,
        symbol=kwargs["symbol"],
        name=kwargs["name"],
        asset_type=kwargs["asset_type"],
        exchange=kwargs.get("exchange"),
    )
    kwargs["security_id"] = security.id

    item = WatchlistItem(user_id=user_id, **kwargs)
    session.add(item)
    await session.commit()

    # Reload with relationships
    return await get_item(session, user_id, item.id)


async def update_item(session: AsyncSession, user_id: UUID, item_id: UUID, **kwargs) -> WatchlistItem:
    result = await session.execute(
        select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Watchlist item not found")

    for k, v in kwargs.items():
        if v is not None:
            if k == "metadata":
                setattr(item, "metadata_", v)
            else:
                setattr(item, k, v)
    await session.commit()
    return await get_item(session, user_id, item_id)


async def delete_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> None:
    result = await session.execute(
        select(WatchlistItem).where(WatchlistItem.id == item_id, WatchlistItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Watchlist item not found")
    await session.delete(item)
    await session.commit()


# ── Stats ──────────────────────────────────────────────


async def get_stats(session: AsyncSession, user_id: UUID) -> dict:
    """Get counts by stage, asset_type, theme, and favourites."""
    items = await session.execute(
        select(WatchlistItem).where(WatchlistItem.user_id == user_id)
    )
    all_items = list(items.scalars().all())

    stages = await list_stages(session, user_id)
    stage_map = {s.id: s.slug for s in stages}

    by_stage = {}
    by_asset_type = {}
    by_theme = {}
    favourites = 0

    for item in all_items:
        # By stage
        slug = stage_map.get(item.stage_id, "none")
        by_stage[slug] = by_stage.get(slug, 0) + 1
        # By asset type
        by_asset_type[item.asset_type] = by_asset_type.get(item.asset_type, 0) + 1
        # By theme
        theme_key = str(item.theme_id) if item.theme_id else "none"
        by_theme[theme_key] = by_theme.get(theme_key, 0) + 1
        # Favourites
        if item.is_favourite:
            favourites += 1

    return {
        "total": len(all_items),
        "by_stage": by_stage,
        "by_asset_type": by_asset_type,
        "by_theme": by_theme,
        "favourites": favourites,
    }
