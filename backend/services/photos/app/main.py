"""Photos service — photo library, albums, people tagging."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from pos_contracts.config import BaseServiceConfig
from pos_contracts.logging import setup_logging
from pos_contracts.schemas import HealthResponse
from pos_events import event_bus

from .db import close_db, init_db
from .routes_photos import router as photos_router
from .routes_albums import router as albums_router
from .routes_comments import router as comments_router
from .routes_people import router as people_router
from .routes_sources import router as sources_router
from .routes_google_oauth import router as google_oauth_router
from .scheduler import start_scheduler, stop_scheduler
from .video_processor import check_ffmpeg_available


class UserIdMiddleware(BaseHTTPMiddleware):
    """Read X-User-Id header (set by gateway) and store in request state."""

    async def dispatch(self, request: Request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


class PhotosConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-photos"
    STORAGE_BASE: str = ""  # Set dynamically in lifespan

    # Google OAuth2 (optional — Google Photos sync)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/photos/sources/google/callback"
    APP_SECRET_KEY: str = "dev-secret-change-in-production"



config = PhotosConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    app.state.config = config
    await event_bus.init(config.RABBITMQ_URL)
    check_ffmpeg_available()
    start_scheduler()
    logger.info("Photos service ready")
    yield
    stop_scheduler()
    await event_bus.close()
    await close_db()
    logger.info("Photos service stopped")


app = FastAPI(
    title="pOS Photos Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(UserIdMiddleware)
# Order matters: specific routes before the catch-all /{photo_id} in photos_router
app.include_router(google_oauth_router, prefix="/api/photos/sources/google")
app.include_router(sources_router, prefix="/api/photos/sources")
app.include_router(albums_router, prefix="/api/photos/albums")
app.include_router(people_router, prefix="/api/photos")
app.include_router(comments_router, prefix="/api/photos")
app.include_router(photos_router, prefix="/api/photos")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
