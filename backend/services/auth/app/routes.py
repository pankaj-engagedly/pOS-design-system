"""Auth API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session

from . import service
from .schemas import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    LogoutRequest,
    RegisterRequest,
    TokenRefreshRequest,
    TokenRefreshResponse,
    UserResponse,
    UserUpdateRequest,
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


@router.post("/login", response_model=AuthResponse)
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
    return result


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
