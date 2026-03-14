"""Auth business logic — registration, login, token management, profile."""

import hashlib
import secrets
from uuid import UUID

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_common.auth import create_access_token, create_refresh_token, validate_token
from pos_common.exceptions import AuthenticationError, NotFoundError, ValidationError

from .models import RefreshToken, User
from .schemas import ChangePasswordRequest, RegisterRequest, UserUpdateRequest


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def _hash_token(token: str) -> str:
    """Hash a refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


async def register_user(
    session: AsyncSession,
    data: RegisterRequest,
    secret_key: str,
    algorithm: str,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict:
    """Register a new user and return tokens."""
    # Check if email already exists
    result = await session.execute(
        select(User).where(User.email == data.email)
    )
    if result.scalar_one_or_none():
        raise ValidationError("Email already registered")

    user = User(
        email=data.email,
        password_hash=_hash_password(data.password),
        name=data.name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    user_id = str(user.id)
    access_token = create_access_token(user_id, secret_key, algorithm, access_expire_minutes)
    refresh_token = create_refresh_token(user_id, secret_key, algorithm, refresh_expire_days)

    # Store refresh token hash
    from datetime import datetime, timedelta, timezone
    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=refresh_expire_days),
    )
    session.add(rt)
    await session.commit()

    return {"user": user, "access_token": access_token, "refresh_token": refresh_token}


async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
    secret_key: str,
    algorithm: str,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict:
    """Verify credentials and return tokens."""
    result = await session.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if not user or not _verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    user_id = str(user.id)
    access_token = create_access_token(user_id, secret_key, algorithm, access_expire_minutes)
    refresh_token = create_refresh_token(user_id, secret_key, algorithm, refresh_expire_days)

    from datetime import datetime, timedelta, timezone
    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=refresh_expire_days),
    )
    session.add(rt)
    await session.commit()

    return {"user": user, "access_token": access_token, "refresh_token": refresh_token}


async def refresh_token(
    session: AsyncSession,
    token: str,
    secret_key: str,
    algorithm: str,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict:
    """Validate refresh token and issue new tokens (rotation)."""
    # Validate JWT
    user_id = validate_token(token, secret_key, algorithm)

    # Check token exists and is not revoked
    token_hash = _hash_token(token)
    result = await session.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )
    )
    stored_token = result.scalar_one_or_none()
    if not stored_token:
        raise AuthenticationError("Invalid or revoked refresh token")

    # Revoke old token
    stored_token.revoked = True

    # Issue new tokens
    new_access = create_access_token(user_id, secret_key, algorithm, access_expire_minutes)
    new_refresh = create_refresh_token(user_id, secret_key, algorithm, refresh_expire_days)

    from datetime import datetime, timedelta, timezone
    new_rt = RefreshToken(
        user_id=stored_token.user_id,
        token_hash=_hash_token(new_refresh),
        expires_at=datetime.now(timezone.utc) + timedelta(days=refresh_expire_days),
    )
    session.add(new_rt)
    await session.commit()

    return {"access_token": new_access, "refresh_token": new_refresh}


async def revoke_token(session: AsyncSession, token: str) -> None:
    """Revoke a refresh token (logout)."""
    token_hash = _hash_token(token)
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored_token = result.scalar_one_or_none()
    if stored_token:
        stored_token.revoked = True
        await session.commit()


async def get_user(session: AsyncSession, user_id: UUID) -> User:
    """Get user by ID."""
    result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("User not found")
    return user


async def update_user(
    session: AsyncSession, user_id: UUID, data: UserUpdateRequest
) -> User:
    """Update user profile."""
    user = await get_user(session, user_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await session.commit()
    await session.refresh(user)
    return user


async def change_password(
    session: AsyncSession, user_id: UUID, data: ChangePasswordRequest
) -> None:
    """Change user password after verifying current password."""
    user = await get_user(session, user_id)
    if not _verify_password(data.current_password, user.password_hash):
        raise AuthenticationError("Current password is incorrect")
    user.password_hash = _hash_password(data.new_password)
    await session.commit()
