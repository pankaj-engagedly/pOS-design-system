"""Portfolio service — investment portfolios, CAS import, holdings, investment plans."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from pos_contracts.logging import setup_logging
from pos_contracts.schemas import HealthResponse
from pos_events import event_bus

from .config import PortfolioConfig
from .db import close_db, init_db
from .routes_portfolio import router as portfolio_router
from .routes_import import router as import_router
from .routes_holdings import router as holdings_router
from .routes_plans import router as plans_router
from .scheduler import start_scheduler, stop_scheduler


class UserIdMiddleware(BaseHTTPMiddleware):
    """Read X-User-Id header (set by gateway) and store in request state."""

    async def dispatch(self, request: Request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


config = PortfolioConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    app.state.config = config
    await event_bus.init(config.RABBITMQ_URL)
    start_scheduler()
    logger.info("Portfolio service ready")
    yield
    stop_scheduler()
    await event_bus.close()
    await close_db()
    logger.info("Portfolio service stopped")


app = FastAPI(
    title="pOS Portfolio Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(UserIdMiddleware)
app.include_router(plans_router, prefix="/api/portfolio")
app.include_router(import_router, prefix="/api/portfolio")
app.include_router(holdings_router, prefix="/api/portfolio")
app.include_router(portfolio_router, prefix="/api/portfolio")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
