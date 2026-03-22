"""Snapshot service — daily metric snapshots + financial statement accumulation."""

import asyncio
import math
from datetime import date, datetime, timezone
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import FinancialStatement, MarketDataCache, MetricSnapshot, WatchlistItem


# ── Metric keys to snapshot per asset type ─────────────

# We snapshot ALL numeric/string cache fields. This dict defines which
# extra fields to pull from yfinance .info beyond the cache for richer snapshots.
EXTRA_INFO_FIELDS = {
    "stock": [
        "beta", "debtToEquity", "currentRatio", "quickRatio",
        "revenueGrowth", "earningsGrowth", "profitMargins", "operatingMargins",
        "grossMargins", "ebitdaMargins", "totalRevenue", "totalDebt", "totalCash",
        "freeCashflow", "operatingCashflow", "ebitda",
        "targetMeanPrice", "targetMedianPrice", "targetHighPrice", "targetLowPrice",
        "recommendationMean", "numberOfAnalystOpinions",
        "shortRatio", "shortPercentOfFloat",
        "heldPercentInstitutions", "heldPercentInsiders",
        "enterpriseValue", "enterpriseToEbitda", "enterpriseToRevenue",
        "forwardPE", "forwardEps", "priceToSalesTrailing12Months",
        "returnOnAssets", "revenuePerShare", "trailingPegRatio",
    ],
    "etf": [
        "beta3Year", "threeYearAverageReturn", "fiveYearAverageReturn",
        "ytdReturn", "trailingThreeMonthReturns", "yield",
        "fundFamily", "category", "netExpenseRatio",
    ],
    "crypto": [
        "maxSupply", "totalSupply", "fullyDilutedValue",
        "volumeAllCurrencies",
    ],
    "mutual_fund": [],
    "precious_metal": ["openInterest"],
    "bond": ["yield"],
}


def _clean_value(val):
    """Convert to JSON-safe value."""
    if val is None:
        return None
    if isinstance(val, float):
        if math.isinf(val) or math.isnan(val):
            return None
        return val
    if isinstance(val, int):
        return val
    if isinstance(val, str):
        return val
    return None


def _cache_to_metrics(cache: MarketDataCache) -> dict:
    """Extract all numeric/string fields from a cache record into a flat dict."""
    skip = {"id", "user_id", "watchlist_item_id", "created_at", "updated_at",
            "price_fetched_at", "fundamentals_fetched_at", "sparkline_data"}
    metrics = {}
    for col in cache.__table__.columns:
        if col.name in skip:
            continue
        val = getattr(cache, col.name, None)
        cleaned = _clean_value(val)
        if cleaned is not None:
            metrics[col.name] = cleaned
    return metrics


def _fetch_extra_info(symbol: str, asset_type: str) -> dict:
    """Fetch additional info fields from yfinance for richer snapshots."""
    import yfinance as yf
    extra_keys = EXTRA_INFO_FIELDS.get(asset_type, [])
    if not extra_keys:
        return {}
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        result = {}
        for key in extra_keys:
            val = _clean_value(info.get(key))
            if val is not None:
                result[key] = val
        return result
    except Exception as e:
        logger.warning(f"Extra info fetch failed for {symbol}: {e}")
        return {}


async def take_daily_snapshots() -> None:
    """Take a daily metric snapshot for all items that haven't been snapshotted today."""
    today = date.today()
    logger.info(f"Starting daily metric snapshots for {today}")

    async for session in get_session():
        # Get all items with their cache
        result = await session.execute(
            select(WatchlistItem, MarketDataCache)
            .join(MarketDataCache, MarketDataCache.watchlist_item_id == WatchlistItem.id)
        )
        rows = result.all()

        # Check which items already have today's snapshot
        existing = await session.execute(
            select(MetricSnapshot.watchlist_item_id)
            .where(MetricSnapshot.recorded_date == today)
        )
        already_done = {row[0] for row in existing.all()}

        count = 0
        for item, cache in rows:
            if item.id in already_done:
                continue

            # Build metrics from cache
            metrics = _cache_to_metrics(cache)

            # Fetch extra info from yfinance (in thread)
            loop = asyncio.get_event_loop()
            extra = await loop.run_in_executor(None, _fetch_extra_info, item.symbol, item.asset_type)
            metrics.update(extra)

            if not metrics:
                continue

            snapshot = MetricSnapshot(
                user_id=item.user_id,
                watchlist_item_id=item.id,
                recorded_date=today,
                metrics=metrics,
            )
            session.add(snapshot)
            count += 1

        await session.commit()
        logger.info(f"Daily snapshots: {count} items snapshotted for {today}")


async def accumulate_financials() -> None:
    """Fetch and upsert financial statements for all stock items."""
    logger.info("Starting financial statement accumulation")

    async for session in get_session():
        result = await session.execute(
            select(WatchlistItem).where(WatchlistItem.asset_type == "stock")
        )
        items = list(result.scalars().all())

        count = 0
        for item in items:
            try:
                loop = asyncio.get_event_loop()
                data = await loop.run_in_executor(None, _fetch_all_financials, item.symbol)
                now = datetime.now(timezone.utc)

                for freq, freq_data in data.items():
                    for stmt_type, periods in freq_data.items():
                        for period_date, line_items in periods.items():
                            if not line_items:
                                continue
                            stmt = pg_insert(FinancialStatement.__table__).values(
                                user_id=item.user_id,
                                watchlist_item_id=item.id,
                                statement_type=stmt_type,
                                fiscal_period=period_date,
                                frequency=freq,
                                line_items=line_items,
                                fetched_at=now,
                            ).on_conflict_do_update(
                                constraint="uq_financial_stmt_item_type_period_freq",
                                set_={"line_items": line_items, "fetched_at": now},
                            )
                            await session.execute(stmt)
                            count += 1

            except Exception as e:
                logger.warning(f"Financial accumulation failed for {item.symbol}: {e}")

        await session.commit()
        logger.info(f"Financial accumulation: {count} statement-periods upserted")


def _parse_financial_df(df) -> dict:
    """Parse a yfinance financial DataFrame into {period_date: {line_item: value}}."""
    result = {}
    if df is None or df.empty:
        return result
    for col in df.columns:
        period_date = col.date() if hasattr(col, "date") else None
        if not period_date:
            continue
        items = {}
        for idx in df.index:
            val = df.loc[idx, col]
            cleaned = _clean_value(val)
            if cleaned is not None:
                items[str(idx)] = cleaned
        if items:
            result[period_date] = items
    return result


def _fetch_all_financials(symbol: str) -> dict:
    """Fetch annual + quarterly income, balance sheet, and cash flow from yfinance."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)

    result = {
        "annual": {"income": {}, "balance": {}, "cashflow": {}},
        "quarterly": {"income": {}, "balance": {}, "cashflow": {}},
    }

    # Annual
    for attr, key in [("financials", "income"), ("balance_sheet", "balance"), ("cashflow", "cashflow")]:
        try:
            result["annual"][key] = _parse_financial_df(getattr(ticker, attr))
        except Exception as e:
            logger.warning(f"Failed to fetch annual {key} for {symbol}: {e}")

    # Quarterly
    for attr, key in [("quarterly_financials", "income"), ("quarterly_balance_sheet", "balance"), ("quarterly_cashflow", "cashflow")]:
        try:
            result["quarterly"][key] = _parse_financial_df(getattr(ticker, attr))
        except Exception as e:
            logger.warning(f"Failed to fetch quarterly {key} for {symbol}: {e}")

    return result


async def get_metric_history(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
    metric_key: str,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict]:
    """Get time-series of a specific metric for an item."""
    query = (
        select(MetricSnapshot)
        .where(
            MetricSnapshot.watchlist_item_id == item_id,
            MetricSnapshot.user_id == user_id,
        )
        .order_by(MetricSnapshot.recorded_date)
    )
    if from_date:
        query = query.where(MetricSnapshot.recorded_date >= from_date)
    if to_date:
        query = query.where(MetricSnapshot.recorded_date <= to_date)

    result = await session.execute(query)
    snapshots = result.scalars().all()

    points = []
    for s in snapshots:
        val = s.metrics.get(metric_key)
        if val is not None:
            points.append({"date": s.recorded_date.isoformat(), "value": val})

    return points


async def get_available_metrics(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
) -> list[str]:
    """Get list of metric keys available in snapshots for an item."""
    result = await session.execute(
        select(MetricSnapshot.metrics)
        .where(
            MetricSnapshot.watchlist_item_id == item_id,
            MetricSnapshot.user_id == user_id,
        )
        .order_by(MetricSnapshot.recorded_date.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if not row:
        return []
    return sorted(row.keys())


async def get_accumulated_financials(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
    statement_type: str | None = None,
    frequency: str = "annual",
) -> list[dict]:
    """Get all accumulated financial statement data for an item."""
    query = (
        select(FinancialStatement)
        .where(
            FinancialStatement.watchlist_item_id == item_id,
            FinancialStatement.user_id == user_id,
            FinancialStatement.frequency == frequency,
        )
        .order_by(FinancialStatement.fiscal_period)
    )
    if statement_type:
        query = query.where(FinancialStatement.statement_type == statement_type)

    result = await session.execute(query)
    stmts = result.scalars().all()

    return [
        {
            "statement_type": s.statement_type,
            "fiscal_period": s.fiscal_period.isoformat(),
            "frequency": s.frequency,
            "line_items": s.line_items,
            "fetched_at": s.fetched_at.isoformat(),
        }
        for s in stmts
    ]
