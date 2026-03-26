"""Transfer detection — matches inter-account transfers and CC bill payments."""

from datetime import timedelta
from uuid import UUID

from loguru import logger
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Account, Transaction


async def detect_transfers(
    session: AsyncSession, user_id: UUID, new_txn_ids: list[UUID],
) -> int:
    """Scan new transactions for matching transfers across user's accounts.

    Match criteria:
    - Same amount, opposite txn_type (debit in one, credit in other)
    - Different accounts (both belonging to same user)
    - Within 3-day window
    - Neither already marked as transfer

    Returns count of pairs detected.
    """
    if not new_txn_ids:
        return 0

    # Load new transactions
    result = await session.execute(
        select(Transaction).where(Transaction.id.in_(new_txn_ids))
    )
    new_txns = list(result.scalars().all())

    pairs_found = 0
    for txn in new_txns:
        if txn.is_transfer:
            continue  # already paired

        opposite_type = "credit" if txn.txn_type == "debit" else "debit"
        date_lo = txn.date - timedelta(days=3)
        date_hi = txn.date + timedelta(days=3)

        # Find matching transaction in a different account
        match_result = await session.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.account_id != txn.account_id,
                Transaction.amount == txn.amount,
                Transaction.txn_type == opposite_type,
                Transaction.date >= date_lo,
                Transaction.date <= date_hi,
                Transaction.is_transfer == False,
                Transaction.transfer_pair_id.is_(None),
            ).limit(1)
        )
        match = match_result.scalar_one_or_none()

        if match:
            txn.is_transfer = True
            txn.transfer_pair_id = match.id
            match.is_transfer = True
            match.transfer_pair_id = txn.id
            pairs_found += 1

    if pairs_found > 0:
        await session.commit()
        logger.info(f"Detected {pairs_found} transfer pairs for user {user_id}")

    return pairs_found
