"""Photo sync scheduler — APScheduler background job."""

import asyncio
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger
from sqlalchemy import select

from .db import get_session
from .models import PhotoSource
from . import service_sources
from . import service_sync


scheduler = AsyncIOScheduler()


async def poll_sources():
    """Check all active sources and run sync for each."""
    async for session in get_session():
        try:
            result = await session.execute(
                select(PhotoSource).where(
                    PhotoSource.is_active.is_(True),
                    PhotoSource.sync_status != "syncing",
                )
            )
            sources = list(result.scalars().all())
            if not sources:
                return

            logger.info(f"Sync scheduler: {len(sources)} source(s) to sync")

            for source in sources:
                try:
                    await _sync_single_source(session, source)
                except Exception as e:
                    logger.error(f"Source sync failed '{source.label or source.source_path}': {e}")

        except Exception as e:
            logger.error(f"Sync scheduler job error: {e}")


async def _sync_single_source(session, source: PhotoSource):
    """Sync a single source with status locking."""
    # Lock: set syncing status
    await service_sources.update_sync_status(session, source, "syncing")

    try:
        if source.provider == "folder":
            imported = await service_sync.sync_folder_source(session, source)
        elif source.provider == "apple_photos":
            try:
                from .service_sync_apple import sync_apple_photos_source
                imported = await sync_apple_photos_source(session, source)
            except ImportError:
                logger.warning("Apple Photos sync not available (osxphotos not installed)")
                imported = 0
        elif source.provider == "google_photos":
            try:
                from .service_sync_google import sync_google_photos_source
                imported = await sync_google_photos_source(session, source)
            except ImportError:
                logger.warning("Google Photos sync not available")
                imported = 0
        else:
            logger.warning(f"Unknown provider: {source.provider}")
            imported = 0

        logger.info(f"Source '{source.label or source.source_path}': {imported} new photos imported")

        # Success: update status
        await service_sources.update_sync_status(session, source, "idle")

    except Exception as e:
        # Handle token revocation specifically
        from .google_oauth import TokenRevokedError
        if isinstance(e, TokenRevokedError):
            logger.warning(f"Google token revoked for '{source.label or source.source_path}'")
            await service_sources.update_sync_status(session, source, "error", error=str(e))
            return

        logger.error(f"Sync error for '{source.label or source.source_path}': {e}", exc_info=True)
        await service_sources.update_sync_status(session, source, "error", error=str(e))


async def run_source_sync(source_id: UUID, user_id: str):
    """Trigger an immediate sync for a specific source (used by manual trigger endpoint)."""
    async for session in get_session():
        result = await session.execute(
            select(PhotoSource).where(
                PhotoSource.id == source_id,
                PhotoSource.user_id == user_id,
            )
        )
        source = result.scalar_one_or_none()
        if source:
            # Run in background to not block the HTTP response
            asyncio.create_task(_sync_single_source(session, source))


def start_scheduler():
    """Start the photo sync scheduler."""
    scheduler.add_job(
        poll_sources, "interval", minutes=5,
        id="photo_sync", replace_existing=True,
    )
    scheduler.start()
    logger.info("Photo sync scheduler started (polling every 5 minutes)")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Photo sync scheduler stopped")
