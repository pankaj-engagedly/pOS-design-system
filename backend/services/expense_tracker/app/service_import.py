"""Statement import orchestration — parse, dedup, categorize, detect transfers."""

from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Account, CategoryRule, StatementImport, Transaction
from .parsers import get_parser_for_bank
from .parsers.base import ParsedTransaction
from .schemas import ImportSummary
from .service_categories import seed_categories
from .service_transactions import compute_hash
from .service_transfer_detection import detect_transfers


async def import_statement(
    session: AsyncSession,
    user_id: UUID,
    account_id: UUID,
    file_bytes: bytes,
    filename: str,
) -> ImportSummary:
    """Import a bank statement file for an account."""
    # Get account
    result = await session.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise ValueError("Account not found")

    # Ensure categories exist for this user
    await seed_categories(session, user_id)

    # Get parser
    parser = get_parser_for_bank(account.bank)
    if not parser:
        raise ValueError(f"No parser available for bank: {account.bank}")

    # Determine file type
    lower = filename.lower()
    if lower.endswith(".csv"):
        file_type = "csv"
    elif lower.endswith((".xlsx", ".xls")):
        file_type = "xlsx"
    else:
        file_type = "csv"  # default

    # Create import record
    stmt_import = StatementImport(
        user_id=user_id,
        account_id=account_id,
        filename=filename,
        file_type=file_type,
        bank=account.bank,
        status="processing",
    )
    session.add(stmt_import)
    await session.flush()

    try:
        # Parse
        parsed = parser.parse(file_bytes, filename)
        total_parsed = len(parsed)

        if not parsed:
            stmt_import.status = "completed"
            stmt_import.total_transactions = 0
            stmt_import.new_transactions = 0
            await session.commit()
            return ImportSummary(
                import_id=stmt_import.id, filename=filename,
                total_parsed=0, new_transactions=0, duplicates_skipped=0,
                auto_categorized=0, uncategorized=0, transfers_detected=0,
            )

        # Set period
        dates = sorted(t.date for t in parsed)
        stmt_import.period_start = dates[0]
        stmt_import.period_end = dates[-1]

        # Load category rules for auto-categorization
        rules = await _load_rules(session, user_id)

        # Dedup and insert
        new_txn_ids = []
        duplicates = 0
        auto_categorized = 0

        for p in parsed:
            h = compute_hash(p.date, p.amount, p.description)

            # Check for duplicate
            existing = await session.execute(
                select(Transaction.id).where(
                    Transaction.account_id == account_id,
                    Transaction.hash == h,
                )
            )
            if existing.scalar_one_or_none():
                duplicates += 1
                continue

            # Auto-categorize
            category_id = _match_category(p.description, rules)
            if category_id:
                auto_categorized += 1

            txn = Transaction(
                user_id=user_id,
                date=p.date,
                description=p.description,
                merchant=_extract_merchant(p.description),
                amount=p.amount,
                txn_type=p.txn_type,
                category_id=category_id,
                account_id=account_id,
                reference=p.reference,
                hash=h,
                import_id=stmt_import.id,
            )
            session.add(txn)
            await session.flush()
            new_txn_ids.append(txn.id)

        # Detect transfers
        transfers = await detect_transfers(session, user_id, new_txn_ids)

        # Update import record
        stmt_import.total_transactions = total_parsed
        stmt_import.new_transactions = len(new_txn_ids)
        stmt_import.status = "completed"
        await session.commit()

        uncategorized = len(new_txn_ids) - auto_categorized
        logger.info(
            f"Import complete: {total_parsed} parsed, {len(new_txn_ids)} new, "
            f"{duplicates} dupes, {auto_categorized} categorized, {transfers} transfers"
        )

        return ImportSummary(
            import_id=stmt_import.id,
            filename=filename,
            total_parsed=total_parsed,
            new_transactions=len(new_txn_ids),
            duplicates_skipped=duplicates,
            auto_categorized=auto_categorized,
            uncategorized=uncategorized,
            transfers_detected=transfers,
        )

    except Exception as e:
        stmt_import.status = "failed"
        stmt_import.error_message = str(e)
        await session.commit()
        logger.error(f"Import failed for {filename}: {e}")
        raise


async def _load_rules(session: AsyncSession, user_id: UUID) -> list[tuple[str, UUID]]:
    """Load category rules sorted by priority (user_correction first)."""
    result = await session.execute(
        select(CategoryRule)
        .where(CategoryRule.user_id == user_id)
        .order_by(CategoryRule.priority.desc())
    )
    return [(r.keyword.lower(), r.category_id) for r in result.scalars().all()]


def _match_category(description: str, rules: list[tuple[str, UUID]]) -> UUID | None:
    """Match description against keyword rules. First match wins (sorted by priority)."""
    desc_lower = description.lower()
    for keyword, category_id in rules:
        if keyword in desc_lower:
            return category_id
    return None


def _extract_merchant(description: str) -> str | None:
    """Best-effort merchant extraction from transaction description."""
    # Common patterns: "UPI-SWIGGY-..." → "SWIGGY", "POS XXXXX AMAZON" → "AMAZON"
    desc = description.upper().strip()

    # UPI transactions: UPI-<merchant>-<details>
    if desc.startswith("UPI-") or desc.startswith("UPI/"):
        parts = desc.split("-")
        if len(parts) >= 2:
            return parts[1].strip().title()

    # POS transactions
    if "POS" in desc:
        # Remove POS prefix and card numbers
        cleaned = desc.replace("POS ", "").strip()
        # Take first meaningful word
        words = [w for w in cleaned.split() if len(w) > 3 and not w.isdigit()]
        if words:
            return words[0].title()

    # NEFT/IMPS/RTGS
    for prefix in ("NEFT-", "IMPS-", "RTGS-"):
        if desc.startswith(prefix):
            remainder = desc[len(prefix):]
            parts = remainder.split("-")
            if len(parts) >= 2:
                return parts[0].strip().title()

    return None
