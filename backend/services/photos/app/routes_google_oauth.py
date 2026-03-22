"""Google OAuth2 routes — auth initiation + callback."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from .google_oauth import (
    build_auth_url,
    encrypt_refresh_token,
    exchange_code,
    get_user_email,
    verify_state,
)
from .models import PhotoSource

router = APIRouter()


def _google_configured() -> bool:
    from .main import config
    return bool(config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET)


@router.get("/auth")
async def google_auth(request: Request):
    """Generate Google OAuth2 authorization URL."""
    if not _google_configured():
        return JSONResponse(status_code=503, content={"detail": "Google Photos not configured"})

    user_id = request.state.user_id
    auth_url = build_auth_url(user_id)
    return {"auth_url": auth_url}


@router.get("/callback")
async def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    session: AsyncSession = Depends(get_async_session),
):
    """Handle Google OAuth2 callback — exchange code, store tokens, redirect."""
    # Handle error from Google
    if error:
        return RedirectResponse(f"/#/photos?google_error={error}")

    # Validate state
    if not state:
        return JSONResponse(status_code=400, content={"detail": "Missing state parameter"})

    user_id = verify_state(state)
    if not user_id:
        return JSONResponse(status_code=400, content={"detail": "Invalid state parameter"})

    if not code:
        return JSONResponse(status_code=400, content={"detail": "Missing authorization code"})

    # Exchange code for tokens
    tokens = await exchange_code(code)
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 3600)

    # Fetch user email
    email = await get_user_email(access_token)

    # Encrypt refresh token
    encrypted_rt = encrypt_refresh_token(refresh_token, user_id) if refresh_token else ""

    token_expiry = (datetime.now(timezone.utc) + timedelta(seconds=expires_in)).isoformat()

    config_data = {
        "access_token": access_token,
        "refresh_token": encrypted_rt,
        "token_expiry": token_expiry,
        "google_email": email,
        "next_page_token": None,
    }

    # Check for existing source (update instead of duplicate)
    result = await session.execute(
        select(PhotoSource).where(
            PhotoSource.user_id == user_id,
            PhotoSource.provider == "google_photos",
            PhotoSource.source_path == email,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.config = config_data
        existing.sync_status = "idle"
        existing.last_error = None
        existing.is_active = True
    else:
        source = PhotoSource(
            user_id=user_id,
            provider="google_photos",
            source_path=email,
            label=f"Google Photos ({email})",
            config=config_data,
        )
        session.add(source)

    await session.commit()

    return RedirectResponse("/#/photos?google_connected=1")
