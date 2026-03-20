"""Feed polling scheduler — APScheduler background job."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

from .db import get_session
from .feed_parser import parse_feed
from . import service_feeds


scheduler = AsyncIOScheduler()


async def poll_feeds():
    """Check for due feeds and fetch new items."""
    async for session in get_session():
        try:
            sources = await service_feeds.get_due_sources(session)
            if not sources:
                return

            logger.info(f"Polling {len(sources)} due feed(s)")

            for source in sources:
                try:
                    parsed = await parse_feed(source.url)
                    new_count = await service_feeds.refresh_source(
                        session, source.user_id, source.id, parsed
                    )
                    if new_count > 0:
                        logger.info(f"Feed '{source.title}': {new_count} new items")
                except Exception as e:
                    logger.warning(f"Feed '{source.title}' poll failed: {e}")
                    await service_feeds.record_poll_error(session, source.id, str(e))

        except Exception as e:
            logger.error(f"Feed polling job error: {e}")


def start_scheduler():
    """Start the feed polling scheduler."""
    scheduler.add_job(poll_feeds, "interval", minutes=5, id="feed_poll", replace_existing=True)
    scheduler.start()
    logger.info("Feed scheduler started (polling every 5 minutes)")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Feed scheduler stopped")
