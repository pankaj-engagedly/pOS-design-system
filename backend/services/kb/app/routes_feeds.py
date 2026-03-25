"""Feed API routes — folders, sources, items, OPML import."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .db import get_session as get_async_session
from . import service_feeds as service
from .events import publish_event
from .feed_parser import discover_feed, parse_feed
from .schemas import (
    FeedDiscoverRequest,
    FeedDiscoverResponse,
    FeedFolderCreate,
    FeedFolderResponse,
    FeedFolderUpdate,
    FeedItemResponse,
    FeedItemUpdate,
    FeedSourceCreate,
    FeedSourceResponse,
    FeedSourceUpdate,
    FeedStatsResponse,
    KBItemSummaryResponse,
    MarkAllReadRequest,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def _handle_not_found(e: NotFoundError):
    raise HTTPException(status_code=404, detail=str(e))


# ── Feed Folders ─────────────────────────────────────────


@router.get("/folders", response_model=list[FeedFolderResponse])
async def list_folders(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_feed_folders(session, user_id)


@router.post("/folders", response_model=FeedFolderResponse, status_code=201)
async def create_folder(
    data: FeedFolderCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.create_feed_folder(session, user_id, data)
    except Exception as e:
        if "uq_feed_folders_user_name" in str(e):
            raise HTTPException(status_code=409, detail="Folder name already exists")
        raise


@router.patch("/folders/{folder_id}", response_model=FeedFolderResponse)
async def update_folder(
    folder_id: UUID,
    data: FeedFolderUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.update_feed_folder(session, user_id, folder_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.delete_feed_folder(session, user_id, folder_id)
    except NotFoundError as e:
        _handle_not_found(e)


# ── Feed Sources ─────────────────────────────────────────


@router.get("/sources", response_model=list[FeedSourceResponse])
async def list_sources(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_feed_sources(session, user_id)


@router.post("/sources", response_model=FeedSourceResponse, status_code=201)
async def subscribe(
    data: FeedSourceCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        parsed = await discover_feed(data.url)
        # Client-provided icon (e.g. iTunes artwork) overrides parsed icon
        if data.icon_url:
            parsed.icon_url = data.icon_url
        source = await service.subscribe(session, user_id, parsed, data.folder_id)
        await publish_event("kb.feed.subscribed", source)
        return {**service._model_to_dict(source), "unread_count": len(parsed.items[:50])}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        if "uq_feed_sources_user_url" in str(e):
            raise HTTPException(status_code=409, detail="Already subscribed to this feed")
        raise


@router.post("/sources/discover", response_model=FeedDiscoverResponse)
async def discover(
    data: FeedDiscoverRequest,
    user_id: UUID = Depends(get_user_id),
):
    try:
        parsed = await discover_feed(data.url)
        return {
            "title": parsed.title,
            "url": parsed.url,
            "site_url": parsed.site_url,
            "feed_type": parsed.feed_type,
            "icon_url": parsed.icon_url,
            "item_count": len(parsed.items),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/sources/{source_id}", response_model=FeedSourceResponse)
async def update_source(
    source_id: UUID,
    data: FeedSourceUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.update_feed_source(session, user_id, source_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/sources/{source_id}", status_code=204)
async def unsubscribe(
    source_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.unsubscribe(session, user_id, source_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.post("/sources/{source_id}/refresh")
async def refresh_source(
    source_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        from .models import FeedSource
        from sqlalchemy import select
        result = await session.execute(
            select(FeedSource).where(FeedSource.id == source_id, FeedSource.user_id == user_id)
        )
        source = result.scalar_one_or_none()
        if not source:
            raise NotFoundError("Feed Source not found")

        parsed = await parse_feed(source.url)
        new_count = await service.refresh_source(session, user_id, source_id, parsed)
        return {"new_items": new_count}
    except NotFoundError as e:
        _handle_not_found(e)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import-opml")
async def import_opml(
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Import OPML file to bulk-subscribe to feeds."""
    import xml.etree.ElementTree as ET

    content = await file.read()
    try:
        root = ET.fromstring(content)
    except ET.ParseError:
        raise HTTPException(status_code=400, detail="Invalid OPML file")

    imported = 0
    errors = []

    for outline in root.iter("outline"):
        xml_url = outline.get("xmlUrl")
        if not xml_url:
            continue

        title = outline.get("title") or outline.get("text") or xml_url
        try:
            parsed = await discover_feed(xml_url)
            await service.subscribe(session, user_id, parsed)
            imported += 1
        except Exception as e:
            errors.append({"url": xml_url, "error": str(e)})

    return {"imported": imported, "errors": errors}


# ── Feed Items ───────────────────────────────────────────


@router.get("/items", response_model=list[FeedItemResponse])
async def list_items(
    source_id: UUID | None = None,
    folder_id: UUID | None = None,
    is_read: bool | None = None,
    is_starred: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_feed_items(
        session, user_id,
        source_id=source_id, folder_id=folder_id,
        is_read=is_read, is_starred=is_starred,
        limit=limit, offset=offset,
    )


@router.patch("/items/{item_id}", response_model=FeedItemResponse)
async def update_item(
    item_id: UUID,
    data: FeedItemUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.update_feed_item(session, user_id, item_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.post("/items/{item_id}/save-to-kb", response_model=KBItemSummaryResponse)
async def save_to_kb(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        from .service_kb import _model_to_dict
        kb_item = await service.save_feed_item_to_kb(session, user_id, item_id)
        return {**_model_to_dict(kb_item), "tags": []}
    except NotFoundError as e:
        _handle_not_found(e)


@router.post("/items/mark-all-read")
async def mark_all_read(
    data: MarkAllReadRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    count = await service.mark_all_read(session, user_id, data.source_id, data.folder_id)
    return {"marked_read": count}


# ── Stats ────────────────────────────────────────────────


@router.get("/stats", response_model=FeedStatsResponse)
async def get_stats(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_feed_stats(session, user_id)
