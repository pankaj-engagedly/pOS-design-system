"""Vault service layer — business logic for vault items and fields."""

from uuid import UUID
from typing import List, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts import tag_service
from pos_contracts.models import Taggable

from .encryption import MASK, get_encryption_key, encrypt_value, decrypt_value
from .models import VaultField, VaultItem
from .schemas import (
    VaultItemCreate, VaultItemUpdate,
    VaultFieldCreate, VaultFieldUpdate,
)

ENTITY_TYPE = "vault_item"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mask_field(field: VaultField) -> dict:
    return {
        "id": field.id,
        "vault_item_id": field.vault_item_id,
        "field_name": field.field_name,
        "field_value": MASK if field.field_type == "secret" else field.field_value,
        "field_type": field.field_type,
        "position": field.position,
    }


async def _get_item_or_404(session: AsyncSession, user_id: UUID, item_id: UUID) -> VaultItem:
    result = await session.execute(
        select(VaultItem).where(VaultItem.id == item_id, VaultItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Vault item not found")
    return item


async def _get_field_or_404(
    session: AsyncSession, user_id: UUID, item_id: UUID, field_id: UUID
) -> VaultField:
    result = await session.execute(
        select(VaultField).where(
            VaultField.id == field_id,
            VaultField.vault_item_id == item_id,
            VaultField.user_id == user_id,
        )
    )
    field = result.scalar_one_or_none()
    if not field:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Field not found")
    return field


async def _build_item_response(session: AsyncSession, user_id: UUID, item: VaultItem) -> dict:
    """Build a summary response dict with field_count and tags."""
    count_result = await session.execute(
        select(func.count(VaultField.id)).where(VaultField.vault_item_id == item.id)
    )
    field_count = count_result.scalar() or 0

    tags = await tag_service.get_tags_for_entity(session, ENTITY_TYPE, item.id)
    tag_list = [{"id": t.id, "name": t.name, "count": 0} for t in tags]

    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "icon": item.icon,
        "is_favorite": item.is_favorite,
        "field_count": field_count,
        "tags": tag_list,
    }


async def _build_detail_response(session: AsyncSession, user_id: UUID, item: VaultItem) -> dict:
    """Build a full detail dict with masked fields and tags."""
    fields_result = await session.execute(
        select(VaultField)
        .where(VaultField.vault_item_id == item.id)
        .order_by(VaultField.position)
    )
    fields = [_mask_field(f) for f in fields_result.scalars().all()]

    tags = await tag_service.get_tags_for_entity(session, ENTITY_TYPE, item.id)
    tag_list = [{"id": t.id, "name": t.name, "count": 0} for t in tags]

    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "icon": item.icon,
        "is_favorite": item.is_favorite,
        "fields": fields,
        "tags": tag_list,
    }


# ── Vault Item CRUD ───────────────────────────────────────────────────────────

async def create_item(session: AsyncSession, user_id: UUID, data: VaultItemCreate) -> dict:
    item = VaultItem(
        user_id=user_id,
        name=data.name,
        description=data.description,
        icon=data.icon,
        is_favorite=False,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return await _build_detail_response(session, user_id, item)


async def get_items(
    session: AsyncSession,
    user_id: UUID,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    favorites: Optional[bool] = None,
) -> List[dict]:
    query = select(VaultItem).where(VaultItem.user_id == user_id)

    if tag:
        tagged_ids = await tag_service.get_entities_by_tag(session, user_id, ENTITY_TYPE, tag)
        if not tagged_ids:
            return []
        query = query.where(VaultItem.id.in_(tagged_ids))

    if search:
        query = query.where(VaultItem.name.ilike(f"%{search}%"))

    if favorites is True:
        query = query.where(VaultItem.is_favorite == True)  # noqa: E712

    query = query.order_by(VaultItem.is_favorite.desc(), VaultItem.updated_at.desc())
    result = await session.execute(query)
    items = result.scalars().all()

    return [await _build_item_response(session, user_id, item) for item in items]


async def get_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> dict:
    item = await _get_item_or_404(session, user_id, item_id)
    return await _build_detail_response(session, user_id, item)


async def update_item(
    session: AsyncSession, user_id: UUID, item_id: UUID, data: VaultItemUpdate
) -> dict:
    item = await _get_item_or_404(session, user_id, item_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    await session.commit()
    await session.refresh(item)
    return await _build_detail_response(session, user_id, item)


async def delete_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> None:
    item = await _get_item_or_404(session, user_id, item_id)
    # Remove tag associations
    await session.execute(
        delete(Taggable).where(
            Taggable.entity_type == ENTITY_TYPE,
            Taggable.entity_id == item_id,
        )
    )
    await session.delete(item)
    await session.commit()


# ── Fields ────────────────────────────────────────────────────────────────────

async def add_field(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
    data: VaultFieldCreate,
    app_secret: str,
) -> dict:
    await _get_item_or_404(session, user_id, item_id)

    # Get next position
    pos_result = await session.execute(
        select(func.max(VaultField.position)).where(VaultField.vault_item_id == item_id)
    )
    max_pos = pos_result.scalar() or -1

    value = data.field_value
    if data.field_type == "secret":
        fernet = get_encryption_key(app_secret, user_id)
        value = encrypt_value(data.field_value, fernet)

    field = VaultField(
        user_id=user_id,
        vault_item_id=item_id,
        field_name=data.field_name,
        field_value=value,
        field_type=data.field_type,
        position=max_pos + 1,
    )
    session.add(field)
    await session.commit()
    await session.refresh(field)
    return _mask_field(field)


async def update_field(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
    field_id: UUID,
    data: VaultFieldUpdate,
    app_secret: str,
) -> dict:
    field = await _get_field_or_404(session, user_id, item_id, field_id)

    updates = data.model_dump(exclude_none=True)

    # Determine final field_type (may have changed)
    new_type = updates.get("field_type", field.field_type)

    if "field_value" in updates:
        if new_type == "secret":
            fernet = get_encryption_key(app_secret, user_id)
            updates["field_value"] = encrypt_value(updates["field_value"], fernet)
        elif field.field_type == "secret" and new_type != "secret":
            # Changing from secret to non-secret — store the new value plaintext
            pass  # value is already in updates as plaintext

    for k, v in updates.items():
        setattr(field, k, v)

    await session.commit()
    await session.refresh(field)
    return _mask_field(field)


async def delete_field(
    session: AsyncSession, user_id: UUID, item_id: UUID, field_id: UUID
) -> None:
    field = await _get_field_or_404(session, user_id, item_id, field_id)
    await session.delete(field)
    await session.commit()


async def reorder_fields(
    session: AsyncSession, user_id: UUID, item_id: UUID, ordered_ids: list[UUID]
) -> None:
    await _get_item_or_404(session, user_id, item_id)
    for position, field_id in enumerate(ordered_ids):
        result = await session.execute(
            select(VaultField).where(
                VaultField.id == field_id,
                VaultField.vault_item_id == item_id,
                VaultField.user_id == user_id,
            )
        )
        field = result.scalar_one_or_none()
        if field:
            field.position = position
    await session.commit()


async def reveal_field(
    session: AsyncSession, user_id: UUID, item_id: UUID, field_id: UUID, app_secret: str
) -> dict:
    field = await _get_field_or_404(session, user_id, item_id, field_id)
    if field.field_type == "secret":
        fernet = get_encryption_key(app_secret, user_id)
        plaintext = decrypt_value(field.field_value, fernet)
    else:
        plaintext = field.field_value
    return {"id": field.id, "field_name": field.field_name, "field_type": field.field_type, "value": plaintext}


# ── Tags ──────────────────────────────────────────────────────────────────────

async def add_tag_to_item(
    session: AsyncSession, user_id: UUID, item_id: UUID, tag_name: str
) -> dict:
    await _get_item_or_404(session, user_id, item_id)
    tag = await tag_service.add_tag(session, user_id, ENTITY_TYPE, item_id, tag_name)
    return {"id": tag.id, "name": tag.name, "count": 0}


async def remove_tag_from_item(
    session: AsyncSession, user_id: UUID, item_id: UUID, tag_id: UUID
) -> None:
    await _get_item_or_404(session, user_id, item_id)
    await tag_service.remove_tag(session, user_id, ENTITY_TYPE, item_id, tag_id)


async def get_tags(session: AsyncSession, user_id: UUID) -> List[dict]:
    all_tags = await tag_service.get_all_tags(session, user_id)
    result = []
    for t in all_tags:
        count = t["counts"].get(ENTITY_TYPE, 0)
        if count > 0:
            result.append({"id": t["id"], "name": t["name"], "count": count})
    return result
