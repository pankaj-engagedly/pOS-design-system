"""Sample API routes — demonstrates the standard CRUD pattern."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_common.database import get_async_session

from . import service
from .schemas import SampleItemCreate, SampleItemResponse, SampleItemUpdate

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    """Extract user_id from request state (set by auth middleware)."""
    return UUID(request.state.user_id)


@router.get("/items", response_model=list[SampleItemResponse])
async def list_items(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_items(session, user_id)


@router.post("/items", response_model=SampleItemResponse, status_code=201)
async def create_item(
    data: SampleItemCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.create_item(session, user_id, data)


@router.get("/items/{item_id}", response_model=SampleItemResponse)
async def get_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_item(session, user_id, item_id)


@router.patch("/items/{item_id}", response_model=SampleItemResponse)
async def update_item(
    item_id: UUID,
    data: SampleItemUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.update_item(session, user_id, item_id, data)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.delete_item(session, user_id, item_id)
