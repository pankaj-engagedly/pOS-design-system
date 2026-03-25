"""Search, refresh, history, financials routes."""

import asyncio
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_watchlist as svc
from .service_market_data import (
    SEARCH_DISPATCH,
    fetch_financials,
    fetch_market_data_for_item,
    fetch_price_history,
    refresh_all_items,
    search_stocks,
)
from .schemas import SearchResult

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/search", response_model=list[SearchResult])
async def search(
    q: str = Query(..., min_length=1),
    asset_type: str = Query("stock"),
):
    """Search assets by type."""
    loop = asyncio.get_event_loop()
    search_fn = SEARCH_DISPATCH.get(asset_type, search_stocks)
    results = await loop.run_in_executor(None, search_fn, q)
    return results


@router.post("/items/{item_id}/refresh")
async def refresh_item(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Force refresh market data + take snapshot for one item."""
    from .service_snapshots import _take_snapshot_for_security
    item = await svc.get_item(session, user_id, item_id)
    await fetch_market_data_for_item(item.id, item.symbol, item.asset_type)
    # Also take a snapshot so metric trends have data immediately
    await _take_snapshot_for_security(item.security_id, item.symbol, item.asset_type)
    return {"status": "refreshed", "symbol": item.symbol}


@router.post("/refresh-all")
async def refresh_all(
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_user_id),
):
    """Refresh market data for all items (background)."""
    background_tasks.add_task(refresh_all_items)
    return {"status": "refresh_started"}


@router.get("/items/{item_id}/history")
async def get_history(
    item_id: UUID,
    period: str = Query("1y"),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get price history for charting."""
    item = await svc.get_item(session, user_id, item_id)
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_price_history, item.symbol, item.asset_type, period)
    return data


@router.get("/items/{item_id}/financials")
async def get_financials(
    item_id: UUID,
    frequency: str = Query("annual", pattern="^(annual|quarterly)$"),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get standardized financial statements from accumulated data."""
    from sqlalchemy import select as sa_select
    from .models import FinancialStatement
    from .financial_mapping import standardize_line_items

    item = await svc.get_item(session, user_id, item_id)
    if item.asset_type != "stock":
        return {"income": [], "balance": [], "cashflow": [], "periods": [], "note": f"Financials not available for {item.asset_type}"}

    security_id = item.security_id

    # Fetch all accumulated statements for this security + frequency
    result = await session.execute(
        sa_select(FinancialStatement)
        .where(
            FinancialStatement.security_id == security_id,
            FinancialStatement.frequency == frequency,
        )
        .order_by(FinancialStatement.fiscal_period.desc())
    )
    statements = list(result.scalars().all())

    if not statements:
        # No accumulated data yet — trigger live fetch + accumulate, then retry
        from .service_snapshots import _fetch_all_financials, _upsert_financial_statements
        loop = asyncio.get_event_loop()
        fin_data = await loop.run_in_executor(None, _fetch_all_financials, item.symbol)
        if fin_data:
            await _upsert_financial_statements(session, security_id, fin_data)
            await session.commit()
            result = await session.execute(
                sa_select(FinancialStatement)
                .where(
                    FinancialStatement.security_id == security_id,
                    FinancialStatement.frequency == frequency,
                )
                .order_by(FinancialStatement.fiscal_period.desc())
            )
            statements = list(result.scalars().all())

    # Group by statement type and apply standardized mapping
    by_type = {"income": {}, "balance": {}, "cashflow": {}}
    all_periods = set()
    for stmt in statements:
        if stmt.statement_type in by_type:
            by_type[stmt.statement_type][stmt.fiscal_period.isoformat()] = stmt.line_items
            all_periods.add(stmt.fiscal_period.isoformat())

    periods = sorted(all_periods, reverse=True)

    # Build standardized output per statement type
    output = {}
    for stype in ["income", "balance", "cashflow"]:
        type_periods = by_type[stype]
        if not type_periods:
            output[stype] = []
            continue

        # Get all period data, standardize each
        period_data = []
        for period in periods:
            raw = type_periods.get(period, {})
            if raw:
                standardized = standardize_line_items(stype, raw)
                period_data.append({"period": period, "sections": standardized})
        output[stype] = period_data

    output["periods"] = periods
    output["frequency"] = frequency
    return output
