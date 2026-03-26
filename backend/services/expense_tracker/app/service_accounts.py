"""Account CRUD for expense tracker."""

from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .models import Account


async def list_accounts(session: AsyncSession, user_id: UUID) -> list[Account]:
    result = await session.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .order_by(Account.owner_label, Account.name)
    )
    return list(result.scalars().all())


async def get_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> Account:
    result = await session.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Account not found")
    return account


async def create_account(
    session: AsyncSession, user_id: UUID, *,
    name: str, bank: str, type: str,
    owner_label: str = "", account_number_masked: str | None = None,
) -> Account:
    account = Account(
        user_id=user_id, name=name, bank=bank, type=type,
        owner_label=owner_label, account_number_masked=account_number_masked,
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    logger.info(f"Created account '{name}' for user {user_id}")
    return account


async def update_account(
    session: AsyncSession, user_id: UUID, account_id: UUID, **kwargs,
) -> Account:
    account = await get_account(session, user_id, account_id)
    for k, v in kwargs.items():
        if v is not None:
            setattr(account, k, v)
    await session.commit()
    await session.refresh(account)
    return account


async def delete_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> None:
    account = await get_account(session, user_id, account_id)
    await session.delete(account)
    await session.commit()
    logger.info(f"Deleted account {account_id} for user {user_id}")
