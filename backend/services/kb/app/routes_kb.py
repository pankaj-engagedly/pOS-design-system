"""KB API routes — items, highlights, collections, tags, stats."""

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .db import get_session as get_async_session
from . import service_kb as service
from .events import publish_event
from .metadata import extract_metadata
from .schemas import (
    CollectionCreate,
    CollectionDetailResponse,
    CollectionItemAdd,
    CollectionResponse,
    CollectionUpdate,
    HighlightCreate,
    HighlightResponse,
    HighlightUpdate,
    KBItemCreate,
    KBItemResponse,
    KBItemSummaryResponse,
    KBItemUpdate,
    KBStatsResponse,
    PreviewURLRequest,
    PreviewURLResponse,
    SaveURLRequest,
    TagCreate,
    TagWithCount,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def _handle_not_found(e: NotFoundError):
    raise HTTPException(status_code=404, detail=str(e))


# ── KB Items ─────────────────────────────────────────────


@router.get("/items", response_model=list[KBItemSummaryResponse])
async def list_items(
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
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_items(
        session, user_id,
        item_type=item_type,
        collection_id=collection_id, is_favourite=is_favourite,
        has_rating=has_rating, min_rating=min_rating,
        search=search, tag=tag, sort_by=sort_by,
        limit=limit, offset=offset,
    )


@router.post("/items", response_model=KBItemResponse, status_code=201)
async def create_item(
    data: KBItemCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    item = await service.create_item(session, user_id, data)
    return item


@router.post("/items/save-url", response_model=KBItemSummaryResponse, status_code=201)
async def save_url(
    data: SaveURLRequest,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    has_preview = data.title is not None
    item = await service.save_url(session, user_id, data.url, preview=data if has_preview else None)
    await publish_event("kb.item.created", item)

    # Only run async metadata extraction if no preview data was provided
    if not has_preview:
        async def _extract_and_update():
            from .db import get_session as _get_session
            metadata = await extract_metadata(data.url)
            async for s in _get_session():
                await service.update_item_metadata(s, item.id, metadata)

        background_tasks.add_task(_extract_and_update)
    return {**service._model_to_dict(item), "tags": []}


@router.post("/items/preview-url", response_model=PreviewURLResponse)
async def preview_url(
    data: PreviewURLRequest,
    user_id: UUID = Depends(get_user_id),
):
    """Extract metadata from a URL for preview before saving."""
    try:
        meta = await extract_metadata(data.url)
        return PreviewURLResponse(
            title=meta.title,
            description=meta.description,
            image=meta.image,
            author=meta.author,
            site_name=meta.site_name,
            item_type=meta.item_type,
            word_count=meta.word_count,
            reading_time_min=meta.reading_time_min,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not extract metadata: {e}")


@router.get("/items/{item_id}", response_model=KBItemResponse)
async def get_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.get_item(session, user_id, item_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/items/{item_id}", response_model=KBItemResponse)
async def update_item(
    item_id: UUID,
    data: KBItemUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.update_item(session, user_id, item_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.delete_item(session, user_id, item_id)
    except NotFoundError as e:
        _handle_not_found(e)


# ── Tags on Items ────────────────────────────────────────


@router.post("/items/{item_id}/tags", response_model=KBItemResponse)
async def add_tag(
    item_id: UUID,
    data: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.add_tag(session, user_id, item_id, data.name)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/items/{item_id}/tags/{tag_id}", status_code=204)
async def remove_tag(
    item_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.remove_tag(session, user_id, item_id, tag_id)
    except NotFoundError as e:
        _handle_not_found(e)


# ── Highlights ───────────────────────────────────────────


@router.get("/items/{item_id}/highlights", response_model=list[HighlightResponse])
async def list_highlights(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.get_highlights(session, user_id, item_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.post("/items/{item_id}/highlights", response_model=HighlightResponse, status_code=201)
async def create_highlight(
    item_id: UUID,
    data: HighlightCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.create_highlight(session, user_id, item_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/highlights/{highlight_id}", response_model=HighlightResponse)
async def update_highlight(
    highlight_id: UUID,
    data: HighlightUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.update_highlight(session, user_id, highlight_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/highlights/{highlight_id}", status_code=204)
async def delete_highlight(
    highlight_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.delete_highlight(session, user_id, highlight_id)
    except NotFoundError as e:
        _handle_not_found(e)


# ── Collections ──────────────────────────────────────────


@router.get("/collections", response_model=list[CollectionResponse])
async def list_collections(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_collections(session, user_id)


@router.post("/collections", response_model=CollectionResponse, status_code=201)
async def create_collection(
    data: CollectionCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        coll = await service.create_collection(session, user_id, data)
        return coll
    except Exception as e:
        if "uq_kb_collections_user_name" in str(e):
            raise HTTPException(status_code=409, detail="Collection name already exists")
        raise


@router.get("/collections/{collection_id}", response_model=CollectionDetailResponse)
async def get_collection(
    collection_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.get_collection(session, user_id, collection_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/collections/{collection_id}", response_model=CollectionResponse)
async def update_collection(
    collection_id: UUID,
    data: CollectionUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.update_collection(session, user_id, collection_id, data)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/collections/{collection_id}", status_code=204)
async def delete_collection(
    collection_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.delete_collection(session, user_id, collection_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.post("/collections/{collection_id}/items", status_code=201)
async def add_to_collection(
    collection_id: UUID,
    data: CollectionItemAdd,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.add_item_to_collection(session, user_id, collection_id, data.kb_item_id)
        return {"status": "added"}
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/collections/{collection_id}/items/{item_id}", status_code=204)
async def remove_from_collection(
    collection_id: UUID,
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.remove_item_from_collection(session, user_id, collection_id, item_id)
    except NotFoundError as e:
        _handle_not_found(e)


# ── Tags ─────────────────────────────────────────────────


@router.get("/tags", response_model=list[TagWithCount])
async def list_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_tags(session, user_id)


# ── Stats ────────────────────────────────────────────────


@router.get("/stats", response_model=KBStatsResponse)
async def get_stats(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_stats(session, user_id)
