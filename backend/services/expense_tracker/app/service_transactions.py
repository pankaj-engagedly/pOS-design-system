"""Transaction queries, category update with rule learning, manual entry."""

import hashlib
from datetime import date
from decimal import Decimal
from uuid import UUID

from loguru import logger
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pos_contracts.exceptions import NotFoundError

from .models import Account, Category, CategoryRule, Transaction


def compute_hash(txn_date: date, amount: Decimal, description: str) -> str:
    """SHA256 hash for dedup — unique per account."""
    raw = f"{txn_date.isoformat()}|{amount}|{description}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def list_transactions(
    session: AsyncSession, user_id: UUID, *,
    account_id: UUID | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    is_transfer: bool | None = None,
    uncategorized_only: bool = False,
    owner_label: str | None = None,
    search: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[Transaction]:
    q = (
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
    )

    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if date_from:
        q = q.where(Transaction.date >= date_from)
    if date_to:
        q = q.where(Transaction.date <= date_to)
    if is_transfer is not None:
        q = q.where(Transaction.is_transfer == is_transfer)
    if uncategorized_only:
        q = q.where(Transaction.category_id.is_(None))
    if owner_label:
        q = q.where(Account.owner_label == owner_label)
    if search:
        pattern = f"%{search.lower()}%"
        q = q.where(
            func.lower(Transaction.description).like(pattern)
            | func.lower(Transaction.merchant).like(pattern)
        )

    q = q.limit(limit).offset(offset)
    result = await session.execute(q)
    return list(result.unique().scalars().all())


async def get_transaction(session: AsyncSession, user_id: UUID, txn_id: UUID) -> Transaction:
    result = await session.execute(
        select(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .where(Transaction.id == txn_id, Transaction.user_id == user_id)
    )
    txn = result.unique().scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transaction not found")
    return txn


async def update_transaction(
    session: AsyncSession, user_id: UUID, txn_id: UUID, **kwargs,
) -> Transaction:
    """Update transaction fields. If category changes, learn a rule from it."""
    txn = await get_transaction(session, user_id, txn_id)

    new_category_id = kwargs.get("category_id")
    if new_category_id and new_category_id != txn.category_id:
        # Learn user rule from this correction
        merchant_key = (txn.merchant or txn.description).strip().lower()
        if merchant_key:
            await _learn_rule(session, user_id, merchant_key, new_category_id)

    for k, v in kwargs.items():
        if v is not None:
            setattr(txn, k, v)

    await session.commit()
    # Re-fetch with relationships
    return await get_transaction(session, user_id, txn_id)


async def create_transaction(
    session: AsyncSession, user_id: UUID, *,
    date: date, description: str, amount: Decimal, txn_type: str,
    account_id: UUID, merchant: str | None = None,
    category_id: UUID | None = None, notes: str | None = None,
    reference: str | None = None,
) -> Transaction:
    """Manual transaction entry."""
    h = compute_hash(date, amount, description)
    txn = Transaction(
        user_id=user_id, date=date, description=description,
        merchant=merchant, amount=amount, txn_type=txn_type,
        category_id=category_id, account_id=account_id,
        notes=notes, reference=reference, hash=h,
    )
    session.add(txn)
    await session.commit()
    return await get_transaction(session, user_id, txn.id)


async def delete_transaction(session: AsyncSession, user_id: UUID, txn_id: UUID) -> None:
    txn = await get_transaction(session, user_id, txn_id)
    await session.delete(txn)
    await session.commit()


async def _learn_rule(
    session: AsyncSession, user_id: UUID, keyword: str, category_id: UUID,
) -> None:
    """Save or update a user_correction rule from a category change."""
    existing = await session.execute(
        select(CategoryRule).where(
            CategoryRule.user_id == user_id,
            CategoryRule.keyword == keyword,
        )
    )
    rule = existing.scalar_one_or_none()
    if rule:
        rule.category_id = category_id
        rule.source = "user_correction"
        rule.priority = max(rule.priority, 100)  # user rules outrank system
    else:
        rule = CategoryRule(
            user_id=user_id, keyword=keyword,
            category_id=category_id, source="user_correction", priority=100,
        )
        session.add(rule)
    await session.flush()
    logger.debug(f"Learned rule: '{keyword}' → category {category_id}")
