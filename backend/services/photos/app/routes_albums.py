"""Album API routes — CRUD, photo membership."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_albums as svc
from .schemas import (
    AlbumCreate,
    AlbumDetailResponse,
    AlbumPhotosAdd,
    AlbumResponse,
    AlbumUpdate,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("", response_model=list[AlbumResponse])
async def list_albums(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.list_albums(session, user_id)


@router.post("", response_model=AlbumResponse, status_code=201)
async def create_album(
    data: AlbumCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    album = await svc.create_album(session, user_id, data.name, data.description)
    return {
        **album.__dict__,
        "photo_count": 0,
    }


@router.get("/{album_id}", response_model=AlbumDetailResponse)
async def get_album(
    album_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    return await svc.get_album_with_photos(session, user_id, album_id, limit=limit, offset=offset)


@router.patch("/{album_id}", response_model=AlbumResponse)
async def update_album(
    album_id: UUID,
    data: AlbumUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    updates = data.model_dump(exclude_unset=True)
    album = await svc.update_album(session, user_id, album_id, updates)
    # Get photo count
    albums = await svc.list_albums(session, user_id)
    count = next((a["photo_count"] for a in albums if a["id"] == album.id), 0)
    return {**album.__dict__, "photo_count": count}


@router.delete("/{album_id}", status_code=204)
async def delete_album(
    album_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_album(session, user_id, album_id)


@router.post("/{album_id}/photos", status_code=201)
async def add_photos(
    album_id: UUID,
    data: AlbumPhotosAdd,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    added = await svc.add_photos_to_album(session, user_id, album_id, data.photo_ids)
    return {"added": added}


@router.delete("/{album_id}/photos/{photo_id}", status_code=204)
async def remove_photo(
    album_id: UUID,
    photo_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.remove_photo_from_album(session, user_id, album_id, photo_id)
