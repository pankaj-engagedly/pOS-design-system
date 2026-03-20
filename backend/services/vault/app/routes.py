"""Vault API routes."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .schemas import (
    CategoryCreate, CategoryUpdate, CategoryReorderRequest, CategoryResponse,
    FieldTemplateCreate, FieldTemplateUpdate, FieldTemplateReorderRequest, FieldTemplateResponse,
    VaultItemCreate, VaultItemUpdate, VaultItemResponse, VaultItemDetailResponse,
    FieldValueCreate, FieldValueUpdate, FieldValueRevealResponse,
    TagCreate, TagResponse,
)
from . import service

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def get_app_secret(request: Request) -> str:
    return request.app.state.config.APP_SECRET_KEY


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_categories(session, user_id)


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    data: CategoryCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.create_category(session, user_id, data)


@router.patch("/categories/reorder", status_code=204)
async def reorder_categories(
    data: CategoryReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.reorder_categories(session, user_id, data.ordered_ids)


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_category(session, user_id, category_id, data)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_category(session, user_id, category_id)


# ── Field Templates ───────────────────────────────────────────────────────────

@router.get("/categories/{category_id}/templates", response_model=List[FieldTemplateResponse])
async def list_templates(
    category_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_templates(session, user_id, category_id)


@router.post("/categories/{category_id}/templates", response_model=FieldTemplateResponse, status_code=201)
async def create_template(
    category_id: UUID,
    data: FieldTemplateCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.create_template(session, user_id, category_id, data)


@router.patch("/categories/{category_id}/templates/reorder", status_code=204)
async def reorder_templates(
    category_id: UUID,
    data: FieldTemplateReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.reorder_templates(session, user_id, category_id, data.ordered_ids)


@router.patch("/categories/{category_id}/templates/{template_id}", response_model=FieldTemplateResponse)
async def update_template(
    category_id: UUID,
    template_id: UUID,
    data: FieldTemplateUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_template(session, user_id, category_id, template_id, data)


@router.delete("/categories/{category_id}/templates/{template_id}", status_code=204)
async def delete_template(
    category_id: UUID,
    template_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_template(session, user_id, category_id, template_id)


# ── Vault Items ───────────────────────────────────────────────────────────────

@router.get("/items", response_model=List[VaultItemResponse])
async def list_items(
    category_id: Optional[UUID] = None,
    search: Optional[str] = None,
    is_favorite: Optional[bool] = None,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_items(session, user_id, category_id=category_id, search=search, is_favorite=is_favorite)


@router.post("/items", response_model=VaultItemDetailResponse, status_code=201)
async def create_item(
    data: VaultItemCreate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.create_item(session, user_id, data, get_app_secret(request))


@router.get("/items/{item_id}", response_model=VaultItemDetailResponse)
async def get_item(
    item_id: UUID,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.get_item(session, user_id, item_id, get_app_secret(request))


@router.patch("/items/{item_id}", response_model=VaultItemDetailResponse)
async def update_item(
    item_id: UUID,
    data: VaultItemUpdate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_item(session, user_id, item_id, data, get_app_secret(request))


@router.delete("/items/{item_id}", status_code=204)
async def delete_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    await service.delete_item(session, user_id, item_id)


# ── Field Values ──────────────────────────────────────────────────────────────

@router.post("/items/{item_id}/fields", response_model=VaultItemDetailResponse, status_code=201)
async def add_field_value(
    item_id: UUID,
    data: FieldValueCreate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.add_field_value(session, user_id, item_id, data, get_app_secret(request))


@router.patch("/items/{item_id}/fields/{value_id}", response_model=VaultItemDetailResponse)
async def update_field_value(
    item_id: UUID,
    value_id: UUID,
    data: FieldValueUpdate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.update_field_value(session, user_id, item_id, value_id, data, get_app_secret(request))


@router.delete("/items/{item_id}/fields/{value_id}", response_model=VaultItemDetailResponse)
async def delete_field_value(
    item_id: UUID,
    value_id: UUID,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.delete_field_value(session, user_id, item_id, value_id, get_app_secret(request))


@router.get("/items/{item_id}/fields/{value_id}/reveal", response_model=FieldValueRevealResponse)
async def reveal_field_value(
    item_id: UUID,
    value_id: UUID,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_session),
):
    return await service.reveal_field_value(session, user_id, item_id, value_id, get_app_secret(request))


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
