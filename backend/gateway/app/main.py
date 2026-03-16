"""pOS API Gateway — entry point for all backend API requests."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from pos_contracts.config import BaseServiceConfig
from pos_contracts.logging import setup_logging
from pos_contracts.schemas import HealthResponse

from .middleware.auth import AuthMiddleware
from .routes import AUTH_SERVICE_URL, TODO_SERVICE_URL, router


class GatewayConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-gateway"
    AUTH_SERVICE_URL: str = "http://localhost:8001"
    TODO_SERVICE_URL: str = "http://localhost:8002"
    DOCUMENTS_SERVICE_URL: str = "http://localhost:8005"
    VAULT_SERVICE_URL: str = "http://localhost:8006"


config = GatewayConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)
    # Configure service URLs from environment
    from . import routes as routes_module
    routes_module.AUTH_SERVICE_URL = config.AUTH_SERVICE_URL
    routes_module.TODO_SERVICE_URL = config.TODO_SERVICE_URL
    routes_module.DOCUMENTS_SERVICE_URL = config.DOCUMENTS_SERVICE_URL
    routes_module.VAULT_SERVICE_URL = config.VAULT_SERVICE_URL
    logger.info("Gateway ready")
    yield
    logger.info("Gateway stopped")


app = FastAPI(
    title="pOS API Gateway",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth middleware
app.add_middleware(AuthMiddleware, config=config)

# Routes
app.include_router(router)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
