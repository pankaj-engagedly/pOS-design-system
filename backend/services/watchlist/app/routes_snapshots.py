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
    """List all chartable metric keys — numeric only, deduplicated."""
    item = await svc.get_item(session, user_id, item_id)
    raw_metrics = await get_available_metrics(session, user_id, item_id)

    # Exclude text/non-chartable fields
    EXCLUDE = {
        "company_description", "website", "city", "country", "industry", "sector",
        "category", "risk_rating", "recommendation_key", "currency", "financial_currency",
        "full_time_employees", "revenuePerShare", "nav",
        "day_change", "previous_close",  # absolute day change and prev close not useful as trends
    }

    # Map camelCase snapshot keys to snake_case cache keys to deduplicate
    CAMEL_TO_SNAKE = {
        "forwardPE": "forward_pe", "forwardEps": "forward_eps",
        "profitMargins": "profit_margins", "operatingMargins": "operating_margins",
        "grossMargins": "gross_margins", "ebitdaMargins": "ebitda_margins",
        "revenueGrowth": "revenue_growth", "earningsGrowth": "earnings_growth",
        "debtToEquity": "debt_to_equity", "currentRatio": "current_ratio",
        "totalRevenue": "total_revenue", "totalDebt": "total_debt",
        "totalCash": "total_cash", "freeCashflow": "free_cashflow",
        "targetMeanPrice": "target_mean_price", "targetHighPrice": "target_high_price",
        "targetLowPrice": "target_low_price", "targetMedianPrice": "target_mean_price",
        "recommendationMean": "recommendation_mean",
        "numberOfAnalystOpinions": "analyst_count",
        "heldPercentInstitutions": "held_pct_institutions",
        "heldPercentInsiders": "held_pct_insiders",
        "enterpriseValue": "enterprise_value", "enterpriseToEbitda": "enterprise_to_ebitda",
        "enterpriseToRevenue": "enterprise_to_revenue",
        "returnOnAssets": "return_on_assets", "returnOnEquity": "roe",
        "shortRatio": "short_ratio", "shortPercentOfFloat": "short_pct_float",
        "priceToSalesTrailing12Months": "price_to_sales",
        "priceToBook": "pb_ratio", "trailingPE": "pe_ratio",
        "marketCap": "market_cap", "bookValue": "book_value",
        "trailingEps": "eps", "dividendYield": "dividend_yield",
        "operatingCashflow": "operating_cashflow",
    }

    seen = set()
    metrics = []
    for m in raw_metrics:
        if m in EXCLUDE:
            continue
        canonical = CAMEL_TO_SNAKE.get(m, m)
        if canonical not in seen:
            seen.add(canonical)
            metrics.append(canonical)

    # Add financial statement-derived metrics for stocks
    if item.asset_type == "stock":
        for m in ["total_revenue", "net_income", "ebitda_fin", "operating_income",
                   "gross_profit", "total_assets", "total_debt_fin", "total_equity",
                   "operating_cashflow", "free_cashflow_fin", "capex"]:
            if m not in seen:
                seen.add(m)
                metrics.append(m)

    metrics.sort()
    return metrics


@router.get("/items/{item_id}/metrics/history")
async def metric_history(
    item_id: UUID,
    metric: str = Query(..., min_length=1),
    from_date: date | None = Query(None),
    to_date: date | None = Query(None),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get time-series of a specific metric. Combines daily snapshots + annual financial data."""
    item = await svc.get_item(session, user_id, item_id)
    points = await get_metric_history(session, user_id, item_id, metric, from_date, to_date)

    # For financial metrics, also pull from accumulated annual statements
    # This gives years of history even with few daily snapshots
    FINANCIAL_METRIC_MAP = {
        "total_revenue": ("income", "Total Revenue"),
        "net_income": ("income", "Net Income"),
        "ebitda_fin": ("income", "EBITDA"),
        "operating_income": ("income", "Operating Income"),
        "gross_profit": ("income", "Gross Profit"),
        "total_assets": ("balance", "Total Assets"),
        "total_debt_fin": ("balance", "Total Debt"),
        "total_equity": ("balance", "Stockholders Equity"),
        "operating_cashflow": ("cashflow", "Operating Cash Flow"),
        "free_cashflow_fin": ("cashflow", "Free Cash Flow"),
        "capex": ("cashflow", "Capital Expenditure"),
    }

    if metric in FINANCIAL_METRIC_MAP and item.asset_type == "stock":
        stmt_type, line_item_key = FINANCIAL_METRIC_MAP[metric]
        from .service_snapshots import _resolve_security_id
        from .models import FinancialStatement
        from sqlalchemy import select as sa_select

        security_id = await _resolve_security_id(session, user_id, item_id)
        result = await session.execute(
            sa_select(FinancialStatement)
            .where(
                FinancialStatement.security_id == security_id,
                FinancialStatement.statement_type == stmt_type,
                FinancialStatement.frequency == "annual",
            )
            .order_by(FinancialStatement.fiscal_period)
        )
        for stmt in result.scalars().all():
            val = stmt.line_items.get(line_item_key)
            if val is not None:
                fin_point = {"date": stmt.fiscal_period.isoformat(), "value": val}
                # Only add if not already covered by a snapshot
                if not any(p["date"] == fin_point["date"] for p in points):
                    points.append(fin_point)

        points.sort(key=lambda x: x["date"])

    return points


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
