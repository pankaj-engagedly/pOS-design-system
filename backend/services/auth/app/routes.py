"""Auth API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session

from . import service
from .schemas import (
    AuthResponse,
    ChangePasswordRequest,
    ConfirmTotpRequest,
    ConfirmTotpResponse,
    DisableTotpRequest,
    LoginRequest,
    LogoutRequest,
    MFAPendingResponse,
    RegisterRequest,
    SetupTotpResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    UserResponse,
    UserUpdateRequest,
    VerifyTotpRequest,
)

router = APIRouter()


def _get_config(request: Request):
    """Get app config from request state."""
    return request.app.state.config


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(
    data: RegisterRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    config = _get_config(request)
    result = await service.register_user(
        session, data,
        secret_key=config.JWT_SECRET_KEY,
        algorithm=config.JWT_ALGORITHM,
        access_expire_minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_expire_days=config.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
    )
    return result


@router.post("/login")
async def login(
    data: LoginRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    config = _get_config(request)
    result = await service.authenticate_user(
        session, data.email, data.password,
        secret_key=config.JWT_SECRET_KEY,
        algorithm=config.JWT_ALGORITHM,
        access_expire_minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_expire_days=config.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
    )
    return result  # Returns AuthResponse or MFAPendingResponse


@router.post("/refresh", response_model=TokenRefreshResponse)
async def refresh(
    data: TokenRefreshRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    config = _get_config(request)
    result = await service.refresh_token(
        session, data.refresh_token,
        secret_key=config.JWT_SECRET_KEY,
        algorithm=config.JWT_ALGORITHM,
        access_expire_minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_expire_days=config.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
    )
    return result


@router.post("/logout", status_code=204)
async def logout(
    data: LogoutRequest,
    session: AsyncSession = Depends(get_async_session),
):
    await service.revoke_token(session, data.refresh_token)


@router.get("/me", response_model=UserResponse)
async def get_profile(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    user_id = UUID(request.state.user_id)
    return await service.get_user(session, user_id)


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    data: UserUpdateRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    user_id = UUID(request.state.user_id)
    return await service.update_user(session, user_id, data)


@router.post("/change-password", status_code=204)
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    user_id = UUID(request.state.user_id)
    await service.change_password(session, user_id, data)


# --- TOTP MFA ---


@router.post("/verify-totp")
async def verify_totp(
    data: VerifyTotpRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Verify TOTP code after password login. Returns full auth tokens."""
    config = _get_config(request)
    result = await service.verify_totp(
        session, data.mfa_token, data.totp_code,
        secret_key=config.JWT_SECRET_KEY,
        algorithm=config.JWT_ALGORITHM,
        access_expire_minutes=config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        refresh_expire_days=config.JWT_REFRESH_TOKEN_EXPIRE_DAYS,
    )
    return result


@router.post("/setup-totp", response_model=SetupTotpResponse)
async def setup_totp(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Generate TOTP secret and QR code provisioning URI."""
    user_id = UUID(request.state.user_id)
    return await service.setup_totp(session, user_id)


@router.post("/confirm-totp", response_model=ConfirmTotpResponse)
async def confirm_totp(
    data: ConfirmTotpRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Confirm TOTP setup with a code + password. Returns backup codes."""
    user_id = UUID(request.state.user_id)
    return await service.confirm_totp(session, user_id, data)


@router.post("/disable-totp", status_code=204)
async def disable_totp(
    data: DisableTotpRequest,
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """Disable TOTP MFA. Requires password confirmation."""
    user_id = UUID(request.state.user_id)
    await service.disable_totp(session, user_id, data.password)
