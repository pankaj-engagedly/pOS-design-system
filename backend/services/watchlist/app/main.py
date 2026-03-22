"""Watchlist service — stock & mutual fund tracking with pipeline stages."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from pos_contracts.config import BaseServiceConfig
from pos_contracts.logging import setup_logging
from pos_contracts.schemas import HealthResponse
from pos_events import event_bus

from .db import close_db, init_db
from .routes_watchlist import router as watchlist_router
from .routes_search import router as search_router
from .routes_snapshots import router as snapshots_router
from .scheduler import start_scheduler, stop_scheduler


class UserIdMiddleware(BaseHTTPMiddleware):
    """Read X-User-Id header (set by gateway) and store in request state."""

    async def dispatch(self, request: Request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


class WatchlistConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-watchlist"


config = WatchlistConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    app.state.config = config
    await event_bus.init(config.RABBITMQ_URL)
    start_scheduler()
    logger.info("Watchlist service ready")
    yield
    stop_scheduler()
    await event_bus.close()
    await close_db()
    logger.info("Watchlist service stopped")


app = FastAPI(
    title="pOS Watchlist Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(UserIdMiddleware)
app.include_router(search_router, prefix="/api/watchlist")
app.include_router(snapshots_router, prefix="/api/watchlist")
app.include_router(watchlist_router, prefix="/api/watchlist")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
