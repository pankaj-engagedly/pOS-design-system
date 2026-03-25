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
from .models import FinancialStatement, MarketDataCache, MetricSnapshot, Security, WatchlistItem


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
    skip = {"id", "security_id", "user_id", "watchlist_item_id", "created_at", "updated_at",
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


async def _take_snapshot_for_security(security_id: UUID, symbol: str, asset_type: str) -> None:
    """Take a snapshot for one security right now (used by manual refresh)."""
    today = date.today()
    async for session in get_session():
        # Check if already taken today
        existing = await session.execute(
            select(MetricSnapshot.id)
            .where(MetricSnapshot.security_id == security_id, MetricSnapshot.recorded_date == today)
        )
        if existing.scalar_one_or_none():
            # Update existing snapshot with latest cache data
            result = await session.execute(
                select(MarketDataCache).where(MarketDataCache.security_id == security_id)
            )
            cache = result.scalar_one_or_none()
            if cache:
                metrics = _cache_to_metrics(cache)
                loop = asyncio.get_event_loop()
                extra = await loop.run_in_executor(None, _fetch_extra_info, symbol, asset_type)
                metrics.update(extra)
                await session.execute(
                    select(MetricSnapshot)
                    .where(MetricSnapshot.security_id == security_id, MetricSnapshot.recorded_date == today)
                )
                snap = (await session.execute(
                    select(MetricSnapshot)
                    .where(MetricSnapshot.security_id == security_id, MetricSnapshot.recorded_date == today)
                )).scalar_one()
                snap.metrics = metrics
                await session.commit()
            return

        # Create new snapshot
        result = await session.execute(
            select(MarketDataCache).where(MarketDataCache.security_id == security_id)
        )
        cache = result.scalar_one_or_none()
        if not cache:
            return

        metrics = _cache_to_metrics(cache)
        loop = asyncio.get_event_loop()
        extra = await loop.run_in_executor(None, _fetch_extra_info, symbol, asset_type)
        metrics.update(extra)

        if metrics:
            snapshot = MetricSnapshot(
                security_id=security_id,
                recorded_date=today,
                metrics=metrics,
            )
            session.add(snapshot)
            await session.commit()
            logger.info(f"Snapshot taken for {symbol} on {today}")


async def take_daily_snapshots() -> None:
    """Take a daily metric snapshot for all securities that haven't been snapshotted today."""
    today = date.today()
    logger.info(f"Starting daily metric snapshots for {today}")

    async for session in get_session():
        # Get all securities with their cache
        result = await session.execute(
            select(Security, MarketDataCache)
            .join(MarketDataCache, MarketDataCache.security_id == Security.id)
        )
        rows = result.all()

        # Check which securities already have today's snapshot
        existing = await session.execute(
            select(MetricSnapshot.security_id)
            .where(MetricSnapshot.recorded_date == today)
        )
        already_done = {row[0] for row in existing.all()}

        count = 0
        for sec, cache in rows:
            if sec.id in already_done:
                continue

            metrics = _cache_to_metrics(cache)

            # Fetch extra info from yfinance (in thread)
            loop = asyncio.get_event_loop()
            extra = await loop.run_in_executor(None, _fetch_extra_info, sec.symbol, sec.asset_type)
            metrics.update(extra)

            if not metrics:
                continue

            snapshot = MetricSnapshot(
                security_id=sec.id,
                recorded_date=today,
                metrics=metrics,
            )
            session.add(snapshot)
            count += 1

        await session.commit()
        logger.info(f"Daily snapshots: {count} securities snapshotted for {today}")


async def _upsert_financial_statements(session: AsyncSession, security_id, data: dict) -> int:
    """Upsert financial statement data for one security. Returns count of upserted rows."""
    count = 0
    now = datetime.now(timezone.utc)
    for freq, freq_data in data.items():
        for stmt_type, periods in freq_data.items():
            for period_date, line_items in periods.items():
                if not line_items:
                    continue
                stmt = pg_insert(FinancialStatement.__table__).values(
                    security_id=security_id,
                    statement_type=stmt_type,
                    fiscal_period=period_date,
                    frequency=freq,
                    line_items=line_items,
                    fetched_at=now,
                ).on_conflict_do_update(
                    constraint="uq_financial_stmt_security_type_period_freq",
                    set_={"line_items": line_items, "fetched_at": now},
                )
                await session.execute(stmt)
                count += 1
    return count


async def accumulate_financials() -> None:
    """Fetch and upsert financial statements for all stock securities."""
    logger.info("Starting financial statement accumulation")

    async for session in get_session():
        result = await session.execute(
            select(Security).where(Security.asset_type == "stock")
        )
        securities = list(result.scalars().all())

        count = 0
        for sec in securities:
            try:
                loop = asyncio.get_event_loop()
                data = await loop.run_in_executor(None, _fetch_all_financials, sec.symbol)
                count += await _upsert_financial_statements(session, sec.id, data)
            except Exception as e:
                logger.warning(f"Financial accumulation failed for {sec.symbol}: {e}")

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


async def _resolve_security_id(session: AsyncSession, user_id: UUID, item_id: UUID) -> UUID:
    """Resolve a watchlist item to its security_id (with auth check)."""
    result = await session.execute(
        select(WatchlistItem.security_id)
        .where(WatchlistItem.id == item_id, WatchlistItem.user_id == user_id)
    )
    sid = result.scalar_one_or_none()
    if not sid:
        from pos_contracts.exceptions import NotFoundError
        raise NotFoundError("Item not found")
    return sid


# Reverse map: snake_case → camelCase keys that may exist in snapshot JSONB
_SNAKE_TO_CAMEL = {
    "forward_pe": "forwardPE", "forward_eps": "forwardEps",
    "profit_margins": "profitMargins", "operating_margins": "operatingMargins",
    "gross_margins": "grossMargins", "ebitda_margins": "ebitdaMargins",
    "revenue_growth": "revenueGrowth", "earnings_growth": "earningsGrowth",
    "debt_to_equity": "debtToEquity", "current_ratio": "currentRatio",
    "total_revenue": "totalRevenue", "total_debt": "totalDebt",
    "total_cash": "totalCash", "free_cashflow": "freeCashflow",
    "target_mean_price": "targetMeanPrice", "target_high_price": "targetHighPrice",
    "target_low_price": "targetLowPrice", "recommendation_mean": "recommendationMean",
    "analyst_count": "numberOfAnalystOpinions",
    "held_pct_institutions": "heldPercentInstitutions",
    "held_pct_insiders": "heldPercentInsiders",
    "enterprise_value": "enterpriseValue", "return_on_assets": "returnOnAssets",
    "price_to_sales": "priceToSalesTrailing12Months",
    "operating_cashflow": "operatingCashflow",
}


async def get_metric_history(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
    metric_key: str,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict]:
    """Get time-series of a specific metric for an item's security."""
    security_id = await _resolve_security_id(session, user_id, item_id)
    query = (
        select(MetricSnapshot)
        .where(MetricSnapshot.security_id == security_id)
        .order_by(MetricSnapshot.recorded_date)
    )
    if from_date:
        query = query.where(MetricSnapshot.recorded_date >= from_date)
    if to_date:
        query = query.where(MetricSnapshot.recorded_date <= to_date)

    result = await session.execute(query)
    snapshots = result.scalars().all()

    # Look up both snake_case and camelCase variants in snapshot JSONB
    camel_key = _SNAKE_TO_CAMEL.get(metric_key)

    points = []
    for s in snapshots:
        val = s.metrics.get(metric_key)
        if val is None and camel_key:
            val = s.metrics.get(camel_key)
        if val is not None:
            points.append({"date": s.recorded_date.isoformat(), "value": val})

    return points


async def get_available_metrics(
    session: AsyncSession,
    user_id: UUID,
    item_id: UUID,
) -> list[str]:
    """Get list of metric keys available in snapshots for an item's security."""
    security_id = await _resolve_security_id(session, user_id, item_id)
    result = await session.execute(
        select(MetricSnapshot.metrics)
        .where(MetricSnapshot.security_id == security_id)
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
    """Get all accumulated financial statement data for an item's security."""
    security_id = await _resolve_security_id(session, user_id, item_id)
    query = (
        select(FinancialStatement)
        .where(
            FinancialStatement.security_id == security_id,
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
