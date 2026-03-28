"""Stock tradebook import service — CSV/Excel file parsing and transaction storage."""

import shutil
from datetime import datetime
from pathlib import Path
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .cas_parser_adapter import ParsedCAS
from .models import CASImport, Transaction
from .stock_csv_parser import parse_stock_file


async def import_stock_file(
    session: AsyncSession,
    user_id: UUID,
    portfolio_id: UUID,
    file_path: str,
    original_filename: str,
    broker: str | None = None,
) -> dict:
    """Parse a stock tradebook CSV/Excel and import transactions.

    Returns dict with import summary.
    Raises ValueError on parse failure.
    """
    parsed: ParsedCAS = parse_stock_file(file_path, broker=broker)

    logger.info(f"Parsed stock file: broker={parsed.source_type}, file={original_filename}")

    # Determine import_type from file extension
    ext = Path(original_filename).suffix.lower()
    import_type = "stock_csv" if ext in (".csv", ".txt") else "stock_excel"

    # Flatten all transactions with folio/scheme context
    all_transactions = []
    symbols_found = set()

    for folio in parsed.folios:
        for scheme in folio.schemes:
            symbols_found.add(scheme.name)

            for txn in scheme.transactions:
                all_transactions.append({
                    "user_id": user_id,
                    "portfolio_id": portfolio_id,
                    "asset_class": "stock",
                    "folio_number": folio.folio_number,
                    "amc_name": folio.amc,  # broker name
                    "scheme_name": scheme.name,  # stock symbol/name
                    "scheme_isin": scheme.isin,
                    "amfi_code": scheme.amfi_code,  # NSE/BSE symbol
                    "exchange": "NSE",  # default, could be parsed per-txn
                    "transaction_date": txn.date,
                    "transaction_type": txn.transaction_type,
                    "amount": txn.amount,
                    "units": txn.units,
                    "nav": txn.nav,  # price per share
                    "balance_units": txn.balance,
                })

    # Insert with dedup (same constraint as CAS import)
    imported_count = 0
    duplicates_skipped = 0

    for txn_data in all_transactions:
        existing = await session.execute(
            select(Transaction.id).where(
                Transaction.portfolio_id == txn_data["portfolio_id"],
                Transaction.folio_number == txn_data["folio_number"],
                Transaction.scheme_isin == txn_data["scheme_isin"],
                Transaction.transaction_date == txn_data["transaction_date"],
                Transaction.transaction_type == txn_data["transaction_type"],
                Transaction.amount == txn_data["amount"],
                Transaction.units == txn_data["units"],
            )
        )
        if existing.scalar_one_or_none():
            duplicates_skipped += 1
            continue

        txn = Transaction(**txn_data)
        session.add(txn)
        imported_count += 1

    # Store raw file
    raw_file_path = _store_raw_file(user_id, file_path, original_filename)

    # Create import record
    import_record = CASImport(
        user_id=user_id,
        portfolio_id=portfolio_id,
        filename=original_filename,
        import_type=import_type,
        source_type=parsed.source_type,
        transaction_count=imported_count,
        duplicates_skipped=duplicates_skipped,
        status="completed",
        raw_file_path=raw_file_path,
    )
    session.add(import_record)

    await session.commit()
    await session.refresh(import_record)

    logger.info(
        f"Stock import complete: {imported_count} imported, "
        f"{duplicates_skipped} duplicates skipped, "
        f"{len(symbols_found)} symbols found"
    )

    return {
        "import_id": import_record.id,
        "filename": original_filename,
        "import_type": import_type,
        "source_type": parsed.source_type,
        "schemes_found": len(symbols_found),
        "transactions_imported": imported_count,
        "duplicates_skipped": duplicates_skipped,
        "status": "completed",
    }


def _store_raw_file(user_id: UUID, temp_path: str, original_filename: str) -> str:
    """Copy raw file to permanent storage."""
    storage_dir = Path(f"data/portfolio/{user_id}/imports")
    storage_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = storage_dir / f"{ts}_{original_filename}"
    shutil.copy2(temp_path, str(dest))
    return str(dest)
