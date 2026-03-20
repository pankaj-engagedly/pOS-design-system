"""People API routes — CRUD, photo-person tagging, merge."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_people as svc
from . import service_photos as photo_svc
from .schemas import (
    PersonCreate,
    PersonMergeRequest,
    PersonResponse,
    PersonTagRequest,
    PersonUpdate,
    PhotoSummary,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/people", response_model=list[PersonResponse])
async def list_people(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.list_people(session, user_id)


@router.post("/people", response_model=PersonResponse, status_code=201)
async def create_person(
    data: PersonCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    person = await svc.create_person(session, user_id, data.name)
    return {**person.__dict__, "photo_count": 0}


@router.patch("/people/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: UUID,
    data: PersonUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    updates = data.model_dump(exclude_unset=True)
    person = await svc.update_person(session, user_id, person_id, updates)
    people = await svc.list_people(session, user_id)
    count = next((p["photo_count"] for p in people if p["id"] == person.id), 0)
    return {**person.__dict__, "photo_count": count}


@router.delete("/people/{person_id}", status_code=204)
async def delete_person(
    person_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_person(session, user_id, person_id)


@router.get("/people/{person_id}/photos", response_model=list[PhotoSummary])
async def get_person_photos(
    person_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    photos = await svc.get_person_photos(session, user_id, person_id, limit=limit, offset=offset)
    return await photo_svc.build_photo_summaries(session, user_id, photos)


@router.post("/{photo_id}/people", status_code=201)
async def tag_photo_with_person(
    photo_id: UUID,
    data: PersonTagRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.tag_photo_with_person(session, user_id, photo_id, data.person_id)
    return {"status": "ok"}


@router.delete("/{photo_id}/people/{person_id}", status_code=204)
async def untag_person(
    photo_id: UUID,
    person_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.untag_photo_person(session, user_id, photo_id, person_id)


@router.post("/people/{person_id}/merge", response_model=PersonResponse)
async def merge_people(
    person_id: UUID,
    data: PersonMergeRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    person = await svc.merge_people(session, user_id, person_id, data.merge_into_id)
    people = await svc.list_people(session, user_id)
    count = next((p["photo_count"] for p in people if p["id"] == person.id), 0)
    return {**person.__dict__, "photo_count": count}
