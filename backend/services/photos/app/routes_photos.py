"""Photo API routes — upload, list, get, update, delete, file serving, timeline, tags, stats."""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_photos as svc
from .schemas import (
    PhotoResponse,
    PhotoStatsResponse,
    PhotoSummary,
    PhotoUpdate,
    TagCreate,
    TagWithCount,
    TimelineGroup,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


# ── Upload ───────────────────────────────────────────────


@router.post("/upload", response_model=PhotoSummary, status_code=201)
async def upload_photo(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    photo = await svc.upload_photo(session, user_id, file, background_tasks)
    return photo


@router.post("/upload/bulk", status_code=201)
async def upload_bulk(
    request: Request,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    results = []
    duplicates = 0
    for file in files:
        photo = await svc.upload_photo(session, user_id, file, background_tasks)
        # If photo already existed (dedup), it won't be "pending"
        if photo.processing_status != "pending":
            duplicates += 1
        results.append({"id": str(photo.id), "filename": photo.filename})
    return {
        "uploaded": len(results) - duplicates,
        "duplicates": duplicates,
        "photos": results,
    }


# ── List / Search / Timeline ────────────────────────────


@router.get("", response_model=list[PhotoSummary])
async def list_photos(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    favourite: bool | None = Query(None),
    source_type: str | None = Query(None),
    tag: str | None = Query(None),
    person: str | None = Query(None),
    album: str | None = Query(None),
    sort_by: str = Query("taken_at"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    photos = await svc.list_photos(
        session, user_id,
        is_favourite=favourite,
        source_type=source_type,
        tag=tag,
        person_id=person,
        album_id=album,
        sort_by=sort_by,
        limit=limit,
        offset=offset,
    )
    return await svc.build_photo_summaries(session, user_id, photos)


@router.get("/timeline", response_model=list[TimelineGroup])
async def get_timeline(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    return await svc.get_timeline(session, user_id, limit=limit, offset=offset)


@router.get("/stats", response_model=PhotoStatsResponse)
async def get_stats(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.get_stats(session, user_id)


@router.get("/duplicates")
async def get_duplicates(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    groups = await svc.get_duplicates(session, user_id)
    return [
        {
            "perceptual_hash": g["perceptual_hash"],
            "photos": [PhotoSummary.model_validate(p) for p in g["photos"]],
        }
        for g in groups
    ]


@router.get("/tags", response_model=list[TagWithCount])
async def get_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.get_photo_tags(session, user_id)


# ── Single Photo CRUD ───────────────────────────────────


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    photo = await svc.get_photo(session, user_id, photo_id)
    return await svc.build_photo_response(session, user_id, photo)


@router.patch("/{photo_id}", response_model=PhotoResponse)
async def update_photo(
    photo_id: UUID,
    data: PhotoUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    updates = data.model_dump(exclude_unset=True)
    photo = await svc.update_photo(session, user_id, photo_id, updates)
    return await svc.build_photo_response(session, user_id, photo)


@router.delete("/{photo_id}", status_code=204)
async def delete_photo(
    photo_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_photo(session, user_id, photo_id)


# ── File Serving ─────────────────────────────────────────


@router.get("/{photo_id}/file")
async def serve_original(
    photo_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    photo = await svc.get_photo(session, user_id, photo_id)
    file_path = svc.get_original_path(photo)
    if not file_path.exists():
        return {"detail": "File not found on disk"}, 404
    return FileResponse(
        path=str(file_path),
        filename=photo.filename,
        media_type=photo.content_type,
    )


@router.get("/{photo_id}/thumb/{size}")
async def serve_thumb(
    photo_id: UUID,
    size: str,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    photo = await svc.get_photo(session, user_id, photo_id)
    thumb_path = svc.get_thumb_path(photo, size)
    if not thumb_path or not thumb_path.exists():
        # Fall back to original
        file_path = svc.get_original_path(photo)
        if not file_path.exists():
            return {"detail": "File not found"}, 404
        return FileResponse(path=str(file_path), media_type=photo.content_type)
    return FileResponse(path=str(thumb_path), media_type="image/jpeg")


# ── Tags ─────────────────────────────────────────────────


@router.post("/{photo_id}/tags", response_model=PhotoResponse)
async def add_tag(
    photo_id: UUID,
    data: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    photo = await svc.add_photo_tag(session, user_id, photo_id, data.name)
    return await svc.build_photo_response(session, user_id, photo)


@router.delete("/{photo_id}/tags/{tag_id}", status_code=204)
async def remove_tag(
    photo_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.remove_photo_tag(session, user_id, photo_id, tag_id)
