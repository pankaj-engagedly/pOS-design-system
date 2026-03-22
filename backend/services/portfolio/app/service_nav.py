"""NAV data service — fetch daily MF NAV from AMFI India."""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from uuid import UUID as UUID_type

import httpx
from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .models import NAVCache

AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"
SYSTEM_USER_ID = UUID_type("00000000-0000-0000-0000-000000000000")


async def fetch_and_update_nav(session: AsyncSession, amfi_codes: set[str] | None = None) -> dict:
    """Fetch latest NAV data from AMFI and upsert into cache.

    If amfi_codes is provided, only update those schemes (much faster).
    Returns dict with counts: total_schemes, updated, errors.
    """
    logger.info("Fetching NAV data from AMFI...")

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        response = await client.get(AMFI_NAV_URL)
        response.raise_for_status()

    lines = response.text.strip().split("\n")

    updated = 0
    errors = 0
    total_schemes = 0

    for line in lines:
        line = line.strip()
        if not line or line.startswith("Scheme"):
            continue

        parts = line.split(";")
        if len(parts) < 5:
            continue

        try:
            amfi_code = parts[0].strip()
            scheme_name = parts[3].strip()
            nav_str = parts[4].strip()
            nav_date_str = parts[5].strip() if len(parts) > 5 else None

            if not amfi_code or nav_str in ("N.A.", "-", ""):
                continue

            # If filtering by specific codes, skip others
            if amfi_codes and amfi_code not in amfi_codes:
                continue

            total_schemes += 1
            nav_value = Decimal(nav_str)

            if nav_date_str:
                try:
                    nav_dt = datetime.strptime(nav_date_str, "%d-%b-%Y").date()
                except ValueError:
                    nav_dt = date.today()
            else:
                nav_dt = date.today()

            # Upsert
            existing = await session.execute(
                select(NAVCache).where(
                    NAVCache.amfi_code == amfi_code,
                    NAVCache.nav_date == nav_dt,
                )
            )
            row = existing.scalar_one_or_none()
            if row:
                row.nav = nav_value
                row.scheme_name = scheme_name
            else:
                session.add(NAVCache(
                    user_id=SYSTEM_USER_ID,
                    amfi_code=amfi_code,
                    scheme_name=scheme_name,
                    nav=nav_value,
                    nav_date=nav_dt,
                ))
            updated += 1

        except (ValueError, InvalidOperation, IndexError):
            errors += 1
            continue

    await session.commit()
    logger.info(f"NAV update complete: {total_schemes} schemes, {updated} updated, {errors} errors")

    return {"total_schemes": total_schemes, "updated": updated, "errors": errors}


async def fetch_nav_for_portfolio_schemes(session: AsyncSession, user_id) -> dict:
    """Fetch NAV only for schemes held in user's portfolios (fast)."""
    # Get distinct AMFI codes from user's transactions
    result = await session.execute(
        text("SELECT DISTINCT amfi_code FROM transactions WHERE user_id = :uid AND amfi_code IS NOT NULL"),
        {"uid": str(user_id)},
    )
    codes = {row[0] for row in result.all()}
    if not codes:
        return {"total_schemes": 0, "updated": 0, "errors": 0}

    logger.info(f"Fetching NAV for {len(codes)} held schemes")
    return await fetch_and_update_nav(session, amfi_codes=codes)


async def get_latest_nav(session: AsyncSession, amfi_code: str) -> Decimal | None:
    """Get the most recent NAV for a given AMFI code."""
    result = await session.execute(
        select(NAVCache.nav)
        .where(NAVCache.amfi_code == amfi_code)
        .order_by(NAVCache.nav_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
