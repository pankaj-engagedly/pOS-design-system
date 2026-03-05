"""pOS API Gateway — entry point for all backend API requests."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from pos_common.config import BaseServiceConfig
from pos_common.schemas import HealthResponse

from .middleware.auth import AuthMiddleware
from .routes import router

config = BaseServiceConfig(SERVICE_NAME="pos-gateway")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: initialize connections if needed
    yield
    # Shutdown: cleanup


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
