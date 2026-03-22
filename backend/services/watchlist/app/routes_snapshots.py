"""Snapshot API routes — metric history, available metrics, accumulated financials."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_watchlist as svc
from .service_snapshots import (
    get_accumulated_financials,
    get_available_metrics,
    get_metric_history,
    take_daily_snapshots,
    accumulate_financials,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/items/{item_id}/metrics/available")
async def list_available_metrics(
    item_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """List all metric keys available in snapshots for an item."""
    await svc.get_item(session, user_id, item_id)  # verify ownership
    return await get_available_metrics(session, user_id, item_id)


@router.get("/items/{item_id}/metrics/history")
async def metric_history(
    item_id: UUID,
    metric: str = Query(..., min_length=1),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get time-series of a specific metric for an item."""
    await svc.get_item(session, user_id, item_id)
    return await get_metric_history(session, user_id, item_id, metric, from_date, to_date)


@router.get("/items/{item_id}/financials/accumulated")
async def accumulated_financials(
    item_id: UUID,
    statement_type: str | None = Query(None),
    frequency: str = Query("annual"),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get all accumulated financial statements for an item."""
    await svc.get_item(session, user_id, item_id)
    return await get_accumulated_financials(session, user_id, item_id, statement_type, frequency)


@router.post("/snapshots/trigger")
async def trigger_snapshots(
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_user_id),
):
    """Manually trigger daily snapshots + financial accumulation."""
    background_tasks.add_task(take_daily_snapshots)
    background_tasks.add_task(accumulate_financials)
    return {"status": "snapshot_started"}
