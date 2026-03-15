"""Sample business logic — separated from route handlers."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .models import SampleItem
from .schemas import SampleItemCreate, SampleItemUpdate


async def create_item(
    session: AsyncSession, user_id: UUID, data: SampleItemCreate
) -> SampleItem:
    item = SampleItem(user_id=user_id, **data.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return item


async def get_items(session: AsyncSession, user_id: UUID) -> list[SampleItem]:
    result = await session.execute(
        select(SampleItem).where(SampleItem.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_item(
    session: AsyncSession, user_id: UUID, item_id: UUID
) -> SampleItem:
    result = await session.execute(
        select(SampleItem).where(
            SampleItem.id == item_id, SampleItem.user_id == user_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError(f"Item {item_id} not found")
    return item


async def update_item(
    session: AsyncSession, user_id: UUID, item_id: UUID, data: SampleItemUpdate
) -> SampleItem:
    item = await get_item(session, user_id, item_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    await session.commit()
    await session.refresh(item)
    return item


async def delete_item(session: AsyncSession, user_id: UUID, item_id: UUID) -> None:
    item = await get_item(session, user_id, item_id)
    await session.delete(item)
    await session.commit()
