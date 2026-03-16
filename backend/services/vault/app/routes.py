"""Vault API routes."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .schemas import (
    ReorderRequest, TagCreate, TagResponse,
    VaultFieldCreate, VaultFieldResponse, VaultFieldRevealResponse, VaultFieldUpdate,
    VaultItemCreate, VaultItemDetailResponse, VaultItemResponse, VaultItemUpdate,
)
from . import service

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def get_app_secret(request: Request) -> str:
    return request.app.state.config.APP_SECRET_KEY


# ── Vault Items ───────────────────────────────────────────────────────────────

@router.get("/items", response_model=List[VaultItemResponse])
async def list_items(
    tag: Optional[str] = None,
    search: Optional[str] = None,
    favorites: Optional[bool] = None,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_items(session, user_id, tag=tag, search=search, favorites=favorites)


@router.post("/items", response_model=VaultItemDetailResponse, status_code=201)
async def create_item(
    data: VaultItemCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.create_item(session, user_id, data)


@router.get("/items/{item_id}", response_model=VaultItemDetailResponse)
async def get_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_item(session, user_id, item_id)


@router.patch("/items/{item_id}", response_model=VaultItemDetailResponse)
async def update_item(
    item_id: UUID,
    data: VaultItemUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_item(session, user_id, item_id, data)


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_item(session, user_id, item_id)


# ── Fields ────────────────────────────────────────────────────────────────────

@router.post("/items/{item_id}/fields", response_model=VaultFieldResponse, status_code=201)
async def add_field(
    item_id: UUID,
    data: VaultFieldCreate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.add_field(session, user_id, item_id, data, get_app_secret(request))


@router.patch("/items/{item_id}/fields/reorder", status_code=204)
async def reorder_fields(
    item_id: UUID,
    data: ReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.reorder_fields(session, user_id, item_id, data.ordered_ids)


@router.patch("/items/{item_id}/fields/{field_id}", response_model=VaultFieldResponse)
async def update_field(
    item_id: UUID,
    field_id: UUID,
    data: VaultFieldUpdate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_field(session, user_id, item_id, field_id, data, get_app_secret(request))


@router.delete("/items/{item_id}/fields/{field_id}", status_code=204)
async def delete_field(
    item_id: UUID,
    field_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_field(session, user_id, item_id, field_id)


@router.get("/items/{item_id}/fields/{field_id}/reveal", response_model=VaultFieldRevealResponse)
async def reveal_field(
    item_id: UUID,
    field_id: UUID,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.reveal_field(session, user_id, item_id, field_id, get_app_secret(request))


# ── Tags ──────────────────────────────────────────────────────────────────────

@router.get("/tags", response_model=List[TagResponse])
async def list_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_tags(session, user_id)


@router.post("/items/{item_id}/tags", response_model=TagResponse, status_code=201)
async def add_tag(
    item_id: UUID,
    data: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.add_tag_to_item(session, user_id, item_id, data.name)


@router.delete("/items/{item_id}/tags/{tag_id}", status_code=204)
async def remove_tag(
    item_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.remove_tag_from_item(session, user_id, item_id, tag_id)
