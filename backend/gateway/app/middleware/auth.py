"""JWT + API Key authentication middleware."""

import httpx
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
    "/api/auth/verify-totp",
    "/api/photos/sources/google/callback",
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

        # Extract credentials — check API key first, then JWT
        api_key = request.headers.get("X-API-Key")
        auth_header = request.headers.get("Authorization")
        token = None

        # API Key authentication (for agents/integrations)
        if api_key and api_key.startswith("pos_k_"):
            user_id = await self._validate_api_key(api_key)
            if user_id:
                request.state.user_id = user_id
                return await call_next(request)
            return JSONResponse(status_code=401, content={"detail": "Invalid API key"})

        # JWT authentication
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
            # Also support API keys via Bearer header
            if token.startswith("pos_k_"):
                user_id = await self._validate_api_key(token)
                if user_id:
                    request.state.user_id = user_id
                    return await call_next(request)
                return JSONResponse(status_code=401, content={"detail": "Invalid API key"})
        elif request.query_params.get("token"):
            token = request.query_params.get("token")

        if not token:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        try:
            user_id = validate_token(token, self.config.JWT_SECRET_KEY, self.config.JWT_ALGORITHM)
            request.state.user_id = user_id
        except AuthenticationError:
            return JSONResponse(status_code=401, content={"detail": "Not authenticated"})

        return await call_next(request)

    async def _validate_api_key(self, key: str) -> str | None:
        """Validate API key via auth service."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.config.AUTH_SERVICE_URL}/api/auth/api-keys/validate",
                    json={"key": key},
                    timeout=5.0,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("valid"):
                        return data["user_id"]
        except Exception:
            pass
        return None
