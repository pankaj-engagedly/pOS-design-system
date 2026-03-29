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
        # Learn user rule from this correction — prefer merchant, fall back to extracted keyword
        keyword = _best_keyword(txn)
        if keyword:
            await _learn_rule(session, user_id, keyword, new_category_id)

    for k, v in kwargs.items():
        if v is not None:
            setattr(txn, k, v)

    await session.commit()
    # Re-fetch with relationships
    return await get_transaction(session, user_id, txn_id)


async def count_similar_uncategorized(
    session: AsyncSession, user_id: UUID, txn_id: UUID,
) -> dict:
    """After a category change, count how many similar uncategorized transactions exist."""
    txn = await get_transaction(session, user_id, txn_id)
    keyword = _best_keyword(txn)
    if not keyword:
        return {"keyword": None, "count": 0}

    pattern = f"%{keyword}%"
    result = await session.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == user_id,
            Transaction.id != txn_id,
            Transaction.category_id.is_(None),
            func.lower(Transaction.description).like(pattern)
            | func.lower(Transaction.merchant).like(pattern),
        )
    )
    count = result.scalar() or 0
    return {"keyword": keyword, "count": count, "category_id": str(txn.category_id)}


async def apply_category_to_similar(
    session: AsyncSession, user_id: UUID, keyword: str, category_id: UUID,
) -> int:
    """Apply a category to all uncategorized transactions matching a keyword."""
    pattern = f"%{keyword}%"
    result = await session.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.category_id.is_(None),
            func.lower(Transaction.description).like(pattern)
            | func.lower(Transaction.merchant).like(pattern),
        )
    )
    txns = result.scalars().all()
    for t in txns:
        t.category_id = category_id
    await session.commit()
    logger.info(f"Batch-categorized {len(txns)} transactions for keyword '{keyword}'")
    return len(txns)


async def apply_rules_to_uncategorized(
    session: AsyncSession, user_id: UUID,
) -> int:
    """Re-apply all rules to uncategorized transactions. Returns count updated."""
    # Load rules
    rules_result = await session.execute(
        select(CategoryRule)
        .where(CategoryRule.user_id == user_id)
        .order_by(CategoryRule.priority.desc())
    )
    rules = [(r.keyword.lower(), r.category_id) for r in rules_result.scalars().all()]
    if not rules:
        return 0

    # Load uncategorized transactions
    txn_result = await session.execute(
        select(Transaction).where(
            Transaction.user_id == user_id,
            Transaction.category_id.is_(None),
        )
    )
    txns = txn_result.scalars().all()

    updated = 0
    for txn in txns:
        desc_lower = txn.description.lower()
        merchant_lower = (txn.merchant or "").lower()
        for keyword, cat_id in rules:
            if keyword in desc_lower or keyword in merchant_lower:
                txn.category_id = cat_id
                updated += 1
                break

    if updated:
        await session.commit()
    logger.info(f"Re-applied rules: {updated}/{len(txns)} uncategorized transactions categorized")
    return updated


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


def _best_keyword(txn: Transaction) -> str | None:
    """Extract the best reusable keyword for rule matching from a transaction.

    Prefers merchant name (short, reusable like 'swiggy').
    Falls back to extracting a meaningful part from the description.
    """
    # Prefer merchant — it's already a clean extracted name
    if txn.merchant:
        return txn.merchant.strip().lower()

    # Try to extract a meaningful keyword from description
    desc = txn.description.upper().strip()

    # UPI: "UPI-SWIGGY-12345" → "swiggy"
    if desc.startswith(("UPI-", "UPI/")):
        parts = desc.replace("/", "-").split("-")
        if len(parts) >= 2 and len(parts[1].strip()) > 2:
            return parts[1].strip().lower()

    # NEFT/IMPS/RTGS: "NEFT-MERCHANT-details" → "merchant"
    for prefix in ("NEFT-", "IMPS-", "RTGS-"):
        if desc.startswith(prefix):
            parts = desc[len(prefix):].split("-")
            if parts and len(parts[0].strip()) > 2:
                return parts[0].strip().lower()

    # Take first word longer than 3 chars that isn't a number
    words = [w for w in desc.split() if len(w) > 3 and not w.isdigit() and not w.startswith("XX")]
    if words:
        return words[0].lower()

    return None


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
