"""Market data refresh scheduler — APScheduler background jobs."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from .service_market_data import refresh_all_items
from .service_snapshots import accumulate_financials, take_daily_snapshots

scheduler = AsyncIOScheduler()


async def refresh_job():
    """Refresh market data for all watchlist items."""
    try:
        await refresh_all_items()
    except Exception as e:
        logger.error(f"Market data refresh job error: {e}")


async def daily_snapshot_job():
    """Daily: snapshot all metrics + accumulate financial statements."""
    try:
        await take_daily_snapshots()
    except Exception as e:
        logger.error(f"Daily snapshot job error: {e}")

    try:
        await accumulate_financials()
    except Exception as e:
        logger.error(f"Financial accumulation job error: {e}")


def start_scheduler():
    """Start all scheduled jobs."""
    # Price refresh every 15 minutes
    scheduler.add_job(
        refresh_job,
        "interval",
        minutes=15,
        id="market_data_refresh",
        replace_existing=True,
    )
    # Daily snapshot at 6:30 PM IST (after Indian market close) = 1:00 PM UTC
    scheduler.add_job(
        daily_snapshot_job,
        "cron",
        hour=13,
        minute=0,
        id="daily_snapshot",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: price refresh (15min) + daily snapshot (13:00 UTC)")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
