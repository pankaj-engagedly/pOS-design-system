"""Auth service — user registration, login, JWT token lifecycle."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware

from pos_common.config import BaseServiceConfig
from pos_common.database import close_db, init_db
from pos_common.schemas import HealthResponse

from .routes import router


class UserIdMiddleware(BaseHTTPMiddleware):
    """Read X-User-Id header (set by gateway) and store in request state."""

    async def dispatch(self, request: Request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


class AuthConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-auth"


config = AuthConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown."""
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    app.state.config = config
    yield
    await close_db()


app = FastAPI(
    title="pOS Auth Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(UserIdMiddleware)
app.include_router(router, prefix="/api/auth")


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
