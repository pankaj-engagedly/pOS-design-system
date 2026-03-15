"""Sample service — template for creating new pOS services."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from pos_contracts.config import BaseServiceConfig
from .db import close_db, init_db
from pos_contracts.schemas import HealthResponse

from .routes import router


class SampleConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-sample"


config = SampleConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    yield
    await close_db()


app = FastAPI(
    title="pOS Sample Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(router, prefix="/api/sample")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
