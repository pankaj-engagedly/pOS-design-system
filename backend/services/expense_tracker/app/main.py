"""Expense Tracker service — accounts, transactions, statement import, categorization."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from pos_contracts.logging import setup_logging
from pos_contracts.schemas import HealthResponse
from pos_events import event_bus

from .config import ExpenseTrackerConfig
from .db import close_db, init_db


class UserIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


config = ExpenseTrackerConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    app.state.config = config
    await event_bus.init(config.RABBITMQ_URL)
    logger.info("Expense Tracker service ready")
    yield
    await event_bus.close()
    await close_db()
    logger.info("Expense Tracker service stopped")


app = FastAPI(
    title="pOS Expense Tracker Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(UserIdMiddleware)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
