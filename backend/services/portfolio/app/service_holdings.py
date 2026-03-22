"""Holdings computation from transaction history + XIRR calculation."""

from collections import defaultdict
from datetime import date
from decimal import Decimal
from uuid import UUID

import pyxirr
from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import NAVCache, Portfolio, Transaction

# Transaction types that add units/value
BUY_SIDE = {"buy", "sip", "switch_in", "dividend_reinvest"}
# Transaction types that remove units/value
SELL_SIDE = {"sell", "redemption", "switch_out"}


async def compute_holdings(
    session: AsyncSession, user_id: UUID, portfolio_id: UUID
) -> list[dict]:
    """Compute current holdings from transactions for a portfolio.

    Groups by (scheme_isin, folio_number) and sums units/amounts.
    """
    result = await session.execute(
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio_id, Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date)
    )
    transactions = result.scalars().all()

    # Group by scheme_isin + folio
    holdings_map = defaultdict(lambda: {
        "scheme_name": "",
        "scheme_isin": None,
        "amfi_code": None,
        "folio_number": "",
        "total_units": Decimal("0"),
        "invested_amount": Decimal("0"),
        "redeemed_amount": Decimal("0"),
        "transactions": [],  # for XIRR
    })

    for txn in transactions:
        key = (txn.scheme_isin or txn.scheme_name, txn.folio_number)
        h = holdings_map[key]
        h["scheme_name"] = txn.scheme_name
        h["scheme_isin"] = txn.scheme_isin
        h["amfi_code"] = txn.amfi_code
        h["folio_number"] = txn.folio_number

        if txn.transaction_type in BUY_SIDE:
            h["total_units"] += abs(txn.units)
            h["invested_amount"] += abs(txn.amount)
        elif txn.transaction_type in SELL_SIDE:
            h["total_units"] -= abs(txn.units)
            h["redeemed_amount"] += abs(txn.amount)
        elif txn.transaction_type == "dividend_payout":
            h["redeemed_amount"] += abs(txn.amount)

        h["transactions"].append(txn)

    # Fetch current NAV for each scheme
    holdings = []
    for key, h in holdings_map.items():
        current_nav = await _get_latest_nav(session, h["amfi_code"])

        total_units = h["total_units"]
        invested = h["invested_amount"] - h["redeemed_amount"]
        current_value = total_units * current_nav if current_nav else None

        absolute_return = (current_value - invested) if current_value is not None else None
        return_pct = float(absolute_return / invested * 100) if absolute_return and invested > 0 else None

        # XIRR
        xirr_val = _compute_xirr(h["transactions"], current_value, total_units)

        holdings.append({
            "scheme_name": h["scheme_name"],
            "scheme_isin": h["scheme_isin"],
            "amfi_code": h["amfi_code"],
            "folio_number": h["folio_number"],
            "total_units": total_units,
            "invested_amount": invested,
            "current_nav": current_nav,
            "current_value": current_value,
            "absolute_return": absolute_return,
            "return_pct": return_pct,
            "xirr": xirr_val,
        })

    return holdings


def _compute_xirr(transactions: list, current_value: Decimal | None, total_units: Decimal) -> float | None:
    """Compute XIRR from transaction cashflows + current valuation."""
    if not transactions or current_value is None or total_units <= 0:
        return None

    dates = []
    amounts = []

    for txn in transactions:
        if txn.transaction_type in BUY_SIDE:
            dates.append(txn.transaction_date)
            amounts.append(-float(abs(txn.amount)))  # outflow
        elif txn.transaction_type in SELL_SIDE or txn.transaction_type == "dividend_payout":
            dates.append(txn.transaction_date)
            amounts.append(float(abs(txn.amount)))  # inflow

    # Add current value as final inflow
    dates.append(date.today())
    amounts.append(float(current_value))

    try:
        result = pyxirr.xirr(dates, amounts)
        return round(result * 100, 2) if result is not None else None
    except Exception:
        return None


async def _get_latest_nav(session: AsyncSession, amfi_code: str | None) -> Decimal | None:
    """Get the most recent NAV for a scheme from cache."""
    if not amfi_code:
        return None

    result = await session.execute(
        select(NAVCache.nav)
        .where(NAVCache.amfi_code == amfi_code)
        .order_by(NAVCache.nav_date.desc())
        .limit(1)
    )
    nav = result.scalar_one_or_none()
    return nav


async def compute_portfolio_summary(
    session: AsyncSession, user_id: UUID, portfolio_id: UUID
) -> dict:
    """Compute aggregate summary for a portfolio."""
    holdings = await compute_holdings(session, user_id, portfolio_id)

    total_invested = sum(h["invested_amount"] for h in holdings)
    total_current = sum(h["current_value"] or Decimal("0") for h in holdings)
    total_return = total_current - total_invested
    return_pct = float(total_return / total_invested * 100) if total_invested > 0 else 0.0

    # Portfolio-level XIRR from all transactions
    all_txns_result = await session.execute(
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio_id, Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date)
    )
    all_txns = list(all_txns_result.scalars().all())
    overall_xirr = _compute_xirr(all_txns, total_current, Decimal("1")) if total_current > 0 else None

    return {
        "total_invested": total_invested,
        "total_current_value": total_current,
        "total_return": total_return,
        "return_pct": return_pct,
        "overall_xirr": overall_xirr,
        "scheme_count": len([h for h in holdings if h["total_units"] > 0]),
        "holdings": holdings,
    }


async def compute_family_aggregation(session: AsyncSession, user_id: UUID) -> dict:
    """Compute aggregation across all portfolios, grouped by PAN/holder."""
    from . import service_portfolio as portfolio_svc
    from .encryption import get_fernet, decrypt_pan, mask_pan

    portfolios = await portfolio_svc.list_portfolios(session, user_id)

    holders = defaultdict(lambda: {
        "holder_name": "",
        "pan_masked": None,
        "portfolios": [],
        "total_invested": Decimal("0"),
        "total_current_value": Decimal("0"),
    })

    for p in portfolios:
        summary = await compute_portfolio_summary(session, user_id, p.id)

        # Group by holder_name (PAN would be better but we use holder_name as key)
        key = p.holder_name
        h = holders[key]
        h["holder_name"] = p.holder_name
        h["portfolios"].append(p)
        h["total_invested"] += summary["total_invested"]
        h["total_current_value"] += summary["total_current_value"]

    holder_list = []
    for key, h in holders.items():
        invested = h["total_invested"]
        current = h["total_current_value"]
        total_return = current - invested
        return_pct = float(total_return / invested * 100) if invested > 0 else 0.0

        holder_list.append({
            "holder_name": h["holder_name"],
            "pan_masked": h.get("pan_masked"),
            "portfolio_count": len(h["portfolios"]),
            "total_invested": invested,
            "total_current_value": current,
            "total_return": total_return,
            "return_pct": return_pct,
            "overall_xirr": None,
        })

    family_invested = sum(h["total_invested"] for h in holder_list)
    family_current = sum(h["total_current_value"] for h in holder_list)
    family_return = family_current - family_invested
    family_return_pct = float(family_return / family_invested * 100) if family_invested > 0 else 0.0

    return {
        "total_invested": family_invested,
        "total_current_value": family_current,
        "total_return": family_return,
        "return_pct": family_return_pct,
        "overall_xirr": None,
        "holder_count": len(holder_list),
        "portfolio_count": sum(h["portfolio_count"] for h in holder_list),
        "holders": holder_list,
    }
