"""Vault service layer — categories, field templates, items, field values."""

from collections import defaultdict
from uuid import UUID
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts import tag_service
from pos_contracts.models import Taggable

from .encryption import MASK, get_encryption_key, encrypt_value, decrypt_value
from .models import VaultCategory, VaultFieldTemplate, VaultItem, VaultFieldValue
from .schemas import (
    CategoryCreate, CategoryUpdate,
    FieldTemplateCreate, FieldTemplateUpdate,
    VaultItemCreate, VaultItemUpdate,
    FieldValueCreate, FieldValueUpdate,
)

ENTITY_TYPE = "vault_item"


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_category_or_404(session: AsyncSession, user_id: UUID, category_id: UUID) -> VaultCategory:
    result = await session.execute(
        select(VaultCategory).where(VaultCategory.id == category_id, VaultCategory.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    return cat


async def _get_template_or_404(
    session: AsyncSession, user_id: UUID, category_id: UUID, template_id: UUID
) -> VaultFieldTemplate:
    result = await session.execute(
        select(VaultFieldTemplate).where(
            VaultFieldTemplate.id == template_id,
            VaultFieldTemplate.category_id == category_id,
            VaultFieldTemplate.user_id == user_id,
        )
    )
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Field template not found")
    return tpl


async def _get_item_or_404(session: AsyncSession, user_id: UUID, item_id: UUID) -> VaultItem:
    result = await session.execute(
        select(VaultItem).where(VaultItem.id == item_id, VaultItem.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Vault item not found")
    return item


async def _get_field_value_or_404(
    session: AsyncSession, user_id: UUID, item_id: UUID, value_id: UUID
) -> VaultFieldValue:
    result = await session.execute(
        select(VaultFieldValue).where(
            VaultFieldValue.id == value_id,
            VaultFieldValue.item_id == item_id,
            VaultFieldValue.user_id == user_id,
        )
    )
    val = result.scalar_one_or_none()
    if not val:
        raise HTTPException(status_code=404, detail="Field value not found")
    return val


def _mask_value(field_type: str, field_value: Optional[str]) -> Optional[str]:
    if field_type == "secret" and field_value:
        return MASK
    return field_value


async def _build_resolved_sections(
    session: AsyncSession, item: VaultItem, app_secret: str, user_id: UUID
) -> list:
    """Merge category templates with stored values into sectioned response."""
    # Load all templates for this category, ordered by position
    templates_result = await session.execute(
        select(VaultFieldTemplate)
        .where(VaultFieldTemplate.category_id == item.category_id)
        .order_by(VaultFieldTemplate.section, VaultFieldTemplate.position)
    )
    templates = templates_result.scalars().all()

    # Load all stored values for this item
    values_result = await session.execute(
        select(VaultFieldValue)
        .where(VaultFieldValue.item_id == item.id)
        .order_by(VaultFieldValue.position)
    )
    values = values_result.scalars().all()

    # Index values by template_id (for linked) and collect standalones
    linked_values: dict[UUID, VaultFieldValue] = {}
    standalone_values: list[VaultFieldValue] = []
    for v in values:
        if v.template_id:
            linked_values[v.template_id] = v
        else:
            standalone_values.append(v)

    # Build section groups from templates
    section_map: dict[str, list] = defaultdict(list)
    for tpl in templates:
        stored = linked_values.get(tpl.id)
        if stored:
            raw_value = stored.field_value
            masked = _mask_value(tpl.field_type, raw_value)
            section_map[tpl.section].append({
                "id": stored.id,
                "template_id": tpl.id,
                "field_name": tpl.field_name,
                "field_type": tpl.field_type,
                "section": tpl.section,
                "field_value": masked,
                "has_value": bool(stored.field_value),
                "position": tpl.position,
            })
        else:
            # Template field with no value yet — show empty
            section_map[tpl.section].append({
                "id": None,
                "template_id": tpl.id,
                "field_name": tpl.field_name,
                "field_type": tpl.field_type,
                "section": tpl.section,
                "field_value": None,
                "has_value": False,
                "position": tpl.position,
            })

    # Append standalone fields
    for sv in standalone_values:
        sect = sv.section or "Other"
        field_type = sv.field_type or "text"
        section_map[sect].append({
            "id": sv.id,
            "template_id": None,
            "field_name": sv.field_name or "",
            "field_type": field_type,
            "section": sect,
            "field_value": _mask_value(field_type, sv.field_value),
            "has_value": bool(sv.field_value),
            "position": sv.position,
        })

    # Convert to ordered list of sections
    sections = []
    for section_name, fields in section_map.items():
        sections.append({"name": section_name, "fields": fields})

    return sections


async def _build_item_response(session: AsyncSession, user_id: UUID, item: VaultItem) -> dict:
    """Build summary response with field_count, category_name, and tags."""
    # Count stored values only (non-empty)
    count_result = await session.execute(
        select(func.count(VaultFieldValue.id)).where(
            VaultFieldValue.item_id == item.id,
            VaultFieldValue.field_value.isnot(None),
        )
    )
    field_count = count_result.scalar() or 0

    # Category name
    cat_result = await session.execute(
        select(VaultCategory.name).where(VaultCategory.id == item.category_id)
    )
    category_name = cat_result.scalar_one_or_none() or ""

    tags = await tag_service.get_tags_for_entity(session, ENTITY_TYPE, item.id)
    tag_list = [{"id": t.id, "name": t.name, "count": 0} for t in tags]

    return {
        "id": item.id,
        "category_id": item.category_id,
        "category_name": category_name,
        "name": item.name,
        "icon": item.icon,
        "is_favorite": item.is_favorite,
        "field_count": field_count,
        "tags": tag_list,
    }


async def _build_detail_response(
    session: AsyncSession, user_id: UUID, item: VaultItem, app_secret: str
) -> dict:
    """Build full detail response with resolved sections and tags."""
    cat_result = await session.execute(
        select(VaultCategory.name).where(VaultCategory.id == item.category_id)
    )
    category_name = cat_result.scalar_one_or_none() or ""

    sections = await _build_resolved_sections(session, item, app_secret, user_id)

    tags = await tag_service.get_tags_for_entity(session, ENTITY_TYPE, item.id)
    tag_list = [{"id": t.id, "name": t.name, "count": 0} for t in tags]

    return {
        "id": item.id,
        "category_id": item.category_id,
        "category_name": category_name,
        "name": item.name,
        "icon": item.icon,
        "is_favorite": item.is_favorite,
        "sections": sections,
        "tags": tag_list,
    }


# ── Category CRUD ─────────────────────────────────────────────────────────────

async def create_category(session: AsyncSession, user_id: UUID, data: CategoryCreate) -> dict:
    pos_result = await session.execute(
        select(func.max(VaultCategory.position)).where(VaultCategory.user_id == user_id)
    )
    max_pos = pos_result.scalar() or -1

    cat = VaultCategory(
        user_id=user_id,
        name=data.name,
        icon=data.icon,
        position=max_pos + 1,
    )
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    return {"id": cat.id, "name": cat.name, "icon": cat.icon, "position": cat.position, "item_count": 0}


async def get_categories(session: AsyncSession, user_id: UUID) -> List[dict]:
    result = await session.execute(
        select(VaultCategory).where(VaultCategory.user_id == user_id).order_by(VaultCategory.position)
    )
    categories = result.scalars().all()

    out = []
    for cat in categories:
        count_result = await session.execute(
            select(func.count(VaultItem.id)).where(VaultItem.category_id == cat.id)
        )
        item_count = count_result.scalar() or 0
        out.append({
            "id": cat.id,
            "name": cat.name,
            "icon": cat.icon,
            "position": cat.position,
            "item_count": item_count,
        })
    return out


async def update_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, data: CategoryUpdate
) -> dict:
    cat = await _get_category_or_404(session, user_id, category_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    await session.commit()
    await session.refresh(cat)
    count_result = await session.execute(
        select(func.count(VaultItem.id)).where(VaultItem.category_id == cat.id)
    )
    item_count = count_result.scalar() or 0
    return {"id": cat.id, "name": cat.name, "icon": cat.icon, "position": cat.position, "item_count": item_count}


async def delete_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    cat = await _get_category_or_404(session, user_id, category_id)
    # Clean up tag associations for all items in this category
    items_result = await session.execute(
        select(VaultItem.id).where(VaultItem.category_id == category_id)
    )
    item_ids = [row[0] for row in items_result.all()]
    if item_ids:
        await session.execute(
            delete(Taggable).where(
                Taggable.entity_type == ENTITY_TYPE,
                Taggable.entity_id.in_(item_ids),
            )
        )
    await session.delete(cat)
    await session.commit()


async def reorder_categories(session: AsyncSession, user_id: UUID, ordered_ids: list[UUID]) -> None:
    for position, cat_id in enumerate(ordered_ids):
        result = await session.execute(
            select(VaultCategory).where(VaultCategory.id == cat_id, VaultCategory.user_id == user_id)
        )
        cat = result.scalar_one_or_none()
        if cat:
            cat.position = position
    await session.commit()


# ── Field Template CRUD ───────────────────────────────────────────────────────

async def create_template(
    session: AsyncSession, user_id: UUID, category_id: UUID, data: FieldTemplateCreate
) -> dict:
    await _get_category_or_404(session, user_id, category_id)

    pos_result = await session.execute(
        select(func.max(VaultFieldTemplate.position)).where(VaultFieldTemplate.category_id == category_id)
    )
    max_pos = pos_result.scalar() or -1

    tpl = VaultFieldTemplate(
        user_id=user_id,
        category_id=category_id,
        field_name=data.field_name,
        field_type=data.field_type,
        section=data.section,
        position=max_pos + 1,
    )
    session.add(tpl)
    await session.commit()
    await session.refresh(tpl)
    return {
        "id": tpl.id,
        "category_id": tpl.category_id,
        "field_name": tpl.field_name,
        "field_type": tpl.field_type,
        "section": tpl.section,
        "position": tpl.position,
    }


async def get_templates(session: AsyncSession, user_id: UUID, category_id: UUID) -> List[dict]:
    await _get_category_or_404(session, user_id, category_id)
    result = await session.execute(
        select(VaultFieldTemplate)
        .where(VaultFieldTemplate.category_id == category_id)
        .order_by(VaultFieldTemplate.section, VaultFieldTemplate.position)
    )
    templates = result.scalars().all()
    return [
        {
            "id": t.id,
            "category_id": t.category_id,
            "field_name": t.field_name,
            "field_type": t.field_type,
            "section": t.section,
            "position": t.position,
        }
        for t in templates
    ]


async def update_template(
    session: AsyncSession, user_id: UUID, category_id: UUID, template_id: UUID, data: FieldTemplateUpdate
) -> dict:
    tpl = await _get_template_or_404(session, user_id, category_id, template_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(tpl, k, v)
    await session.commit()
    await session.refresh(tpl)
    return {
        "id": tpl.id,
        "category_id": tpl.category_id,
        "field_name": tpl.field_name,
        "field_type": tpl.field_type,
        "section": tpl.section,
        "position": tpl.position,
    }


async def delete_template(
    session: AsyncSession, user_id: UUID, category_id: UUID, template_id: UUID
) -> None:
    tpl = await _get_template_or_404(session, user_id, category_id, template_id)
    # ON DELETE SET NULL is handled by DB constraint
    # Values with this template_id will have template_id set to NULL automatically
    # We copy name/type/section to those values so they become proper standalones
    orphaned_result = await session.execute(
        select(VaultFieldValue).where(VaultFieldValue.template_id == template_id)
    )
    for val in orphaned_result.scalars().all():
        val.field_name = tpl.field_name
        val.field_type = tpl.field_type
        val.section = tpl.section
        val.template_id = None
    await session.flush()
    await session.delete(tpl)
    await session.commit()


async def reorder_templates(
    session: AsyncSession, user_id: UUID, category_id: UUID, ordered_ids: list[UUID]
) -> None:
    await _get_category_or_404(session, user_id, category_id)
    for position, tpl_id in enumerate(ordered_ids):
        result = await session.execute(
            select(VaultFieldTemplate).where(
                VaultFieldTemplate.id == tpl_id,
                VaultFieldTemplate.category_id == category_id,
                VaultFieldTemplate.user_id == user_id,
            )
        )
        tpl = result.scalar_one_or_none()
        if tpl:
            tpl.position = position
    await session.commit()


# ── Vault Item CRUD ───────────────────────────────────────────────────────────

async def create_item(
    session: AsyncSession, user_id: UUID, data: VaultItemCreate, app_secret: str
) -> dict:
    await _get_category_or_404(session, user_id, data.category_id)
    item = VaultItem(
        user_id=user_id,
        category_id=data.category_id,
        name=data.name,
        icon=data.icon,
        is_favorite=False,
    )
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return await _build_detail_response(session, user_id, item, app_secret)


async def get_items(
    session: AsyncSession,
    user_id: UUID,
    category_id: Optional[UUID] = None,
    search: Optional[str] = None,
    is_favorite: Optional[bool] = None,
) -> List[dict]:
    query = select(VaultItem).where(VaultItem.user_id == user_id)

    if category_id:
        query = query.where(VaultItem.category_id == category_id)
    if search:
        query = query.where(VaultItem.name.ilike(f"%{search}%"))
    if is_favorite is True:
        query = query.where(VaultItem.is_favorite == True)  # noqa: E712

    query = query.order_by(VaultItem.is_favorite.desc(), VaultItem.updated_at.desc())
    result = await session.execute(query)
    items = result.scalars().all()
    return [await _build_item_response(session, user_id, item) for item in items]


async def get_item(session: AsyncSession, user_id: UUID, item_id: UUID, app_secret: str) -> dict:
    item = await _get_item_or_404(session, user_id, item_id)
    return await _build_detail_response(session, user_id, item, app_secret)


async def update_item(
    session: AsyncSession, user_id: UUID, item_id: UUID, data: VaultItemUpdate, app_secret: str
) -> dict:
    item = await _get_item_or_404(session, user_id, item_id)
    if data.category_id:
        await _get_category_or_404(session, user_id, data.category_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await session.commit()
    await session.refresh(item)
    return await _build_detail_response(session, user_id, item, app_secret)


async def delete_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> None:
    item = await _get_item_or_404(session, user_id, item_id)
    await session.execute(
        delete(Taggable).where(
            Taggable.entity_type == ENTITY_TYPE,
            Taggable.entity_id == item_id,
        )
    )
    await session.delete(item)
    await session.commit()


# ── Field Values ──────────────────────────────────────────────────────────────

async def add_field_value(
    session: AsyncSession, user_id: UUID, item_id: UUID, data: FieldValueCreate, app_secret: str
) -> dict:
    item = await _get_item_or_404(session, user_id, item_id)

    # Determine field_type for encryption decision
    field_type = "text"
    if data.template_id:
        tpl_result = await session.execute(
            select(VaultFieldTemplate).where(VaultFieldTemplate.id == data.template_id)
        )
        tpl = tpl_result.scalar_one_or_none()
        if tpl:
            field_type = tpl.field_type
    elif data.field_type:
        field_type = data.field_type

    pos_result = await session.execute(
        select(func.max(VaultFieldValue.position)).where(VaultFieldValue.item_id == item_id)
    )
    max_pos = pos_result.scalar() or -1

    raw_value = data.field_value
    if field_type == "secret" and raw_value:
        fernet = get_encryption_key(app_secret, user_id)
        raw_value = encrypt_value(raw_value, fernet)

    val = VaultFieldValue(
        user_id=user_id,
        item_id=item_id,
        template_id=data.template_id,
        field_name=data.field_name if not data.template_id else None,
        field_type=data.field_type if not data.template_id else None,
        section=data.section if not data.template_id else None,
        field_value=raw_value,
        position=max_pos + 1,
    )
    session.add(val)
    await session.commit()
    # Return the full resolved detail so UI can refresh
    return await _build_detail_response(session, user_id, item, app_secret)


async def update_field_value(
    session: AsyncSession, user_id: UUID, item_id: UUID, value_id: UUID, data: FieldValueUpdate, app_secret: str
) -> dict:
    val = await _get_field_value_or_404(session, user_id, item_id, value_id)
    item = await _get_item_or_404(session, user_id, item_id)

    # Determine field type (may be on template or standalone)
    field_type = val.field_type or "text"
    if val.template_id:
        tpl_result = await session.execute(
            select(VaultFieldTemplate).where(VaultFieldTemplate.id == val.template_id)
        )
        tpl = tpl_result.scalar_one_or_none()
        if tpl:
            field_type = tpl.field_type

    updates = data.model_dump(exclude_none=True)

    if "field_value" in updates:
        raw_value = updates["field_value"]
        if field_type == "secret" and raw_value:
            fernet = get_encryption_key(app_secret, user_id)
            updates["field_value"] = encrypt_value(raw_value, fernet)

    for k, v in updates.items():
        setattr(val, k, v)

    await session.commit()
    return await _build_detail_response(session, user_id, item, app_secret)


async def delete_field_value(
    session: AsyncSession, user_id: UUID, item_id: UUID, value_id: UUID, app_secret: str
) -> dict:
    val = await _get_field_value_or_404(session, user_id, item_id, value_id)
    item = await _get_item_or_404(session, user_id, item_id)
    await session.delete(val)
    await session.commit()
    return await _build_detail_response(session, user_id, item, app_secret)


async def reveal_field_value(
    session: AsyncSession, user_id: UUID, item_id: UUID, value_id: UUID, app_secret: str
) -> dict:
    val = await _get_field_value_or_404(session, user_id, item_id, value_id)

    # Determine field type
    field_type = val.field_type or "text"
    field_name = val.field_name or ""
    if val.template_id:
        tpl_result = await session.execute(
            select(VaultFieldTemplate).where(VaultFieldTemplate.id == val.template_id)
        )
        tpl = tpl_result.scalar_one_or_none()
        if tpl:
            field_type = tpl.field_type
            field_name = tpl.field_name

    if field_type == "secret" and val.field_value:
        fernet = get_encryption_key(app_secret, user_id)
        plaintext = decrypt_value(val.field_value, fernet)
    else:
        plaintext = val.field_value or ""

    return {"id": val.id, "field_name": field_name, "field_type": field_type, "value": plaintext}


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
