"""Watchlist API routes — items, stages, themes, tags, stats."""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.tag_service import add_tag, get_all_tags, get_tags_for_entity, remove_tag

from .db import get_session as get_async_session
from . import service_watchlist as svc
from .service_market_data import fetch_market_data_for_item
from .asset_classes import ASSET_CLASSES
from .schemas import (
    AssetClassResponse,
    ItemCreate,
    ItemDetail,
    ItemSummary,
    ItemUpdate,
    StageCreate,
    StageResponse,
    StageUpdate,
    StatsResponse,
    TagCreate,
    TagInfo,
    ThemeCreate,
    ThemeResponse,
    ThemeTreeResponse,
    ThemeUpdate,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


# ── Asset Classes ────────────────────────────────────────


@router.get("/asset-classes", response_model=list[AssetClassResponse])
async def list_asset_classes():
    """Return static asset class registry."""
    return list(ASSET_CLASSES.values())


# ── Items ────────────────────────────────────────────────


@router.get("/items", response_model=list[ItemSummary])
async def list_items(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    asset_type: str | None = Query(None),
    stage_id: UUID | None = Query(None),
    theme_id: UUID | None = Query(None),
    tag: str | None = Query(None),
    is_favourite: bool | None = Query(None),
    sort_by: str = Query("created_at"),
    limit: int = Query(200, ge=1, le=500),
):
    items = await svc.list_items(
        session, user_id,
        asset_type=asset_type,
        stage_id=stage_id,
        theme_id=theme_id,
        is_favourite=is_favourite,
        sort_by=sort_by,
        limit=limit,
    )
    # Attach tags
    result = []
    for item in items:
        tags = await get_tags_for_entity(session, "watchlist_item", item.id)
        item_dict = _item_to_summary(item, tags)
        result.append(item_dict)
    return result


@router.post("/items", response_model=ItemSummary, status_code=201)
async def create_item(
    body: ItemCreate,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    item = await svc.create_item(
        session, user_id,
        symbol=body.symbol,
        name=body.name,
        asset_type=body.asset_type,
        exchange=body.exchange,
        stage_id=body.stage_id,
        theme_id=body.theme_id,
        remarks=body.remarks,
        added_reason=body.added_reason,
    )
    # Background: fetch market data
    background_tasks.add_task(fetch_market_data_for_item, item.id, item.symbol, item.asset_type)
    tags = await get_tags_for_entity(session, "watchlist_item", item.id)
    return _item_to_summary(item, tags)


@router.get("/items/{item_id}", response_model=ItemDetail)
async def get_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    item = await svc.get_item(session, user_id, item_id)
    tags = await get_tags_for_entity(session, "watchlist_item", item.id)
    return _item_to_detail(item, tags)


@router.patch("/items/{item_id}", response_model=ItemSummary)
async def update_item(
    item_id: UUID,
    body: ItemUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    update_data = body.model_dump(exclude_unset=True)
    item = await svc.update_item(session, user_id, item_id, **update_data)
    tags = await get_tags_for_entity(session, "watchlist_item", item.id)
    return _item_to_summary(item, tags)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_item(session, user_id, item_id)


# ── Tags ─────────────────────────────────────────────────


@router.post("/items/{item_id}/tags", response_model=TagInfo, status_code=201)
async def add_item_tag(
    item_id: UUID,
    body: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    # Verify item exists
    await svc.get_item(session, user_id, item_id)
    tag = await add_tag(session, user_id, "watchlist_item", item_id, body.name)
    return tag


@router.delete("/items/{item_id}/tags/{tag_id}", status_code=204)
async def remove_item_tag(
    item_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await remove_tag(session, user_id, "watchlist_item", item_id, tag_id)


@router.get("/tags")
async def list_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await get_all_tags(session, user_id)


# ── Pipeline Stages ──────────────────────────────────────


@router.get("/stages", response_model=list[StageResponse])
async def list_stages(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.list_stages(session, user_id)


@router.post("/stages", response_model=StageResponse, status_code=201)
async def create_stage(
    body: StageCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.create_stage(session, user_id, **body.model_dump())


@router.patch("/stages/{stage_id}", response_model=StageResponse)
async def update_stage(
    stage_id: UUID,
    body: StageUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.update_stage(session, user_id, stage_id, **body.model_dump(exclude_unset=True))


@router.delete("/stages/{stage_id}", status_code=204)
async def delete_stage(
    stage_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_stage(session, user_id, stage_id)


@router.post("/stages/seed", response_model=list[StageResponse])
async def seed_stages(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.seed_default_stages(session, user_id)


# ── Themes ───────────────────────────────────────────────


@router.get("/themes", response_model=list[ThemeTreeResponse])
async def list_themes(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    asset_type: str | None = Query(None),
):
    themes = await svc.list_themes(session, user_id, asset_type=asset_type)
    # Build tree: count items per theme
    items = await svc.list_items(session, user_id, asset_type=asset_type, limit=10000)
    theme_counts = {}
    for item in items:
        if item.theme_id:
            theme_counts[item.theme_id] = theme_counts.get(item.theme_id, 0) + 1

    # Build tree structure
    top_level = []
    children_map = {}
    for t in themes:
        node = {
            "id": t.id,
            "name": t.name,
            "parent_id": t.parent_id,
            "position": t.position,
            "color": t.color,
            "asset_type": t.asset_type,
            "item_count": theme_counts.get(t.id, 0),
            "children": [],
        }
        if t.parent_id:
            children_map.setdefault(t.parent_id, []).append(node)
        else:
            top_level.append(node)

    for node in top_level:
        node["children"] = children_map.get(node["id"], [])

    return top_level


@router.post("/themes", response_model=ThemeResponse, status_code=201)
async def create_theme(
    body: ThemeCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.create_theme(session, user_id, **body.model_dump())


@router.patch("/themes/{theme_id}", response_model=ThemeResponse)
async def update_theme(
    theme_id: UUID,
    body: ThemeUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.update_theme(session, user_id, theme_id, **body.model_dump(exclude_unset=True))


@router.delete("/themes/{theme_id}", status_code=204)
async def delete_theme(
    theme_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_theme(session, user_id, theme_id)


# ── Stats ────────────────────────────────────────────────


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.get_stats(session, user_id)


# ── Helpers ──────────────────────────────────────────────


def _item_to_summary(item, tags) -> dict:
    return {
        "id": item.id,
        "symbol": item.symbol,
        "name": item.name,
        "asset_type": item.asset_type,
        "exchange": item.exchange,
        "stage_id": item.stage_id,
        "stage": item.stage,
        "theme_id": item.theme_id,
        "theme_name": item.theme.name if item.theme else None,
        "remarks": item.remarks,
        "added_reason": item.added_reason,
        "is_favourite": item.is_favourite,
        "tags": [{"id": t.id, "name": t.name, "created_at": t.created_at} for t in tags],
        "cache": item.cache,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _item_to_detail(item, tags) -> dict:
    d = _item_to_summary(item, tags)
    d["metadata"] = item.metadata_
    return d
