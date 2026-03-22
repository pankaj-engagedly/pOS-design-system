"""CAS PDF import service — uses cas_parser_adapter for PDF parsing."""

import shutil
from datetime import datetime
from pathlib import Path
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .cas_parser_adapter import ParsedCAS, parse_cas_pdf
from .models import CASImport, Transaction


async def import_cas_pdf(
    session: AsyncSession,
    user_id: UUID,
    portfolio_id: UUID,
    file_path: str,
    password: str,
    original_filename: str,
) -> dict:
    """Parse a CAS PDF and import transactions.

    Returns dict with import summary.
    Raises ValueError on parse failure.
    """
    # Parse via adapter (library-agnostic)
    parsed: ParsedCAS = parse_cas_pdf(file_path, password)

    logger.info(f"Parsed CAS PDF: source={parsed.source_type}, file={original_filename}")

    # Flatten all transactions with folio/scheme context
    all_transactions = []
    schemes_found = set()

    for folio in parsed.folios:
        for scheme in folio.schemes:
            schemes_found.add(scheme.name)

            for txn in scheme.transactions:
                all_transactions.append({
                    "user_id": user_id,
                    "portfolio_id": portfolio_id,
                    "folio_number": folio.folio_number,
                    "amc_name": folio.amc,
                    "scheme_name": scheme.name,
                    "scheme_isin": scheme.isin,
                    "amfi_code": scheme.amfi_code or scheme.rta_code,
                    "transaction_date": txn.date,
                    "transaction_type": txn.transaction_type,
                    "amount": txn.amount,
                    "units": txn.units,
                    "nav": txn.nav,
                    "balance_units": txn.balance,
                })

    # Insert with dedup
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

    # Store raw PDF
    raw_file_path = _store_raw_pdf(user_id, file_path, original_filename)

    # Create import record
    cas_import = CASImport(
        user_id=user_id,
        portfolio_id=portfolio_id,
        filename=original_filename,
        source_type=parsed.source_type,
        transaction_count=imported_count,
        duplicates_skipped=duplicates_skipped,
        status="completed",
        raw_file_path=raw_file_path,
    )
    session.add(cas_import)

    await session.commit()
    await session.refresh(cas_import)

    logger.info(
        f"CAS import complete: {imported_count} imported, "
        f"{duplicates_skipped} duplicates skipped, "
        f"{len(schemes_found)} schemes found"
    )

    return {
        "import_id": cas_import.id,
        "filename": original_filename,
        "source_type": parsed.source_type,
        "schemes_found": len(schemes_found),
        "transactions_imported": imported_count,
        "duplicates_skipped": duplicates_skipped,
        "status": "completed",
    }


def _store_raw_pdf(user_id: UUID, temp_path: str, original_filename: str) -> str:
    """Copy raw PDF to permanent storage."""
    storage_dir = Path(f"data/portfolio/{user_id}/imports")
    storage_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = storage_dir / f"{ts}_{original_filename}"
    shutil.copy2(temp_path, str(dest))
    return str(dest)


async def list_imports(
    session: AsyncSession, user_id: UUID, portfolio_id: UUID
) -> list[CASImport]:
    """List all CAS imports for a portfolio."""
    result = await session.execute(
        select(CASImport)
        .where(CASImport.portfolio_id == portfolio_id, CASImport.user_id == user_id)
        .order_by(CASImport.created_at.desc())
    )
    return list(result.scalars().all())
