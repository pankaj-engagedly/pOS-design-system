"""JWT authentication middleware."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from pos_contracts.exceptions import AuthenticationError

from app.auth import validate_token

# Paths that don't require authentication
PUBLIC_PATHS = {
    "/health",
    "/api/",
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class AuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, config):
        super().__init__(app)
        self.config = config

    async def dispatch(self, request: Request, call_next):
        # Skip auth for public paths
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        # Skip auth for OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        # Extract token from Authorization header or ?token= query param
        # (query param needed for <img>/<video> src which can't set headers)
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
        elif request.query_params.get("token"):
            token = request.query_params.get("token")

        if not token:
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
            )

        try:
            user_id = validate_token(
                token,
                self.config.JWT_SECRET_KEY,
                self.config.JWT_ALGORITHM,
            )
            request.state.user_id = user_id
        except AuthenticationError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated"},
            )

        return await call_next(request)
