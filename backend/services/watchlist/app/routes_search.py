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
    """Force refresh market data for one item."""
    item = await svc.get_item(session, user_id, item_id)
    await fetch_market_data_for_item(item.id, item.symbol, item.asset_type)
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
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get income statement + balance sheet (stocks only, live)."""
    item = await svc.get_item(session, user_id, item_id)
    if item.asset_type != "stock":
        return {"income_statement": [], "balance_sheet": [], "note": f"Financials not available for {item.asset_type}"}
    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, fetch_financials, item.symbol)
    return data
