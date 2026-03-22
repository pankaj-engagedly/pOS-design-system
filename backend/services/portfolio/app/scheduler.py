"""APScheduler setup for portfolio service — daily NAV fetch."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

_scheduler: AsyncIOScheduler | None = None


async def _daily_nav_fetch():
    """Scheduled job: fetch latest NAV from AMFI."""
    from .db import _session_factory
    from .service_nav import fetch_and_update_nav

    if _session_factory is None:
        logger.warning("DB not initialized, skipping NAV fetch")
        return

    async with _session_factory() as session:
        try:
            result = await fetch_and_update_nav(session)
            logger.info(f"Scheduled NAV fetch: {result}")
        except Exception as e:
            logger.error(f"Scheduled NAV fetch failed: {e}")


def start_scheduler():
    """Start the APScheduler with daily NAV fetch job."""
    global _scheduler
    _scheduler = AsyncIOScheduler()

    # Daily at 23:30 IST (18:00 UTC)
    _scheduler.add_job(
        _daily_nav_fetch,
        "cron",
        hour=18,
        minute=0,
        id="daily_nav_fetch",
        replace_existing=True,
    )

    _scheduler.start()
    logger.info("Scheduler started — daily NAV fetch at 23:30 IST")


def stop_scheduler():
    """Stop the scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")
