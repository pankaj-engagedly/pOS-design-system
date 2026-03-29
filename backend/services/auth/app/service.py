"""Auth business logic — registration, login, token management, profile."""

import hashlib
import secrets
from uuid import UUID

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import AuthenticationError, NotFoundError, ValidationError
from pos_contracts.logging import trace

from .tokens import create_access_token, create_mfa_token, create_refresh_token, validate_mfa_token, validate_token

from .models import RefreshToken, User
from .schemas import ChangePasswordRequest, ConfirmTotpRequest, RegisterRequest, UserUpdateRequest


def _hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its bcrypt hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def _hash_token(token: str) -> str:
    """Hash a refresh token for storage."""
    return hashlib.sha256(token.encode()).hexdigest()


@trace
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


@trace
async def authenticate_user(
    session: AsyncSession,
    email: str,
    password: str,
    secret_key: str,
    algorithm: str,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict:
    """Verify credentials and return tokens (or MFA challenge)."""
    result = await session.execute(
        select(User).where(User.email == email)
    )
    user = result.scalar_one_or_none()
    if not user or not _verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    # If TOTP is enabled, return an MFA challenge instead of full tokens
    if user.totp_enabled:
        mfa_token = create_mfa_token(str(user.id), secret_key, algorithm)
        return {"requires_mfa": True, "mfa_token": mfa_token}

    return await _issue_tokens(session, user, secret_key, algorithm, access_expire_minutes, refresh_expire_days)


@trace
async def verify_totp(
    session: AsyncSession,
    mfa_token: str,
    totp_code: str,
    secret_key: str,
    algorithm: str,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict:
    """Verify TOTP code after password auth and issue full tokens."""
    import json
    import pyotp

    user_id = validate_mfa_token(mfa_token, secret_key, algorithm)
    user = await get_user(session, UUID(user_id))

    if not user.totp_enabled or not user.totp_secret:
        raise AuthenticationError("TOTP not configured")

    totp = pyotp.TOTP(user.totp_secret)

    # Check TOTP code (with 30s window tolerance)
    if totp.verify(totp_code, valid_window=1):
        return await _issue_tokens(session, user, secret_key, algorithm, access_expire_minutes, refresh_expire_days)

    # Check backup codes
    if user.backup_codes:
        codes = json.loads(user.backup_codes)
        code_hash = hashlib.sha256(totp_code.encode()).hexdigest()
        if code_hash in codes:
            codes.remove(code_hash)
            user.backup_codes = json.dumps(codes)
            await session.commit()
            return await _issue_tokens(session, user, secret_key, algorithm, access_expire_minutes, refresh_expire_days)

    raise AuthenticationError("Invalid TOTP code")


async def _issue_tokens(
    session: AsyncSession,
    user: User,
    secret_key: str,
    algorithm: str,
    access_expire_minutes: int,
    refresh_expire_days: int,
) -> dict:
    """Create access + refresh tokens and store refresh hash."""
    user_id = str(user.id)
    access_token = create_access_token(user_id, secret_key, algorithm, access_expire_minutes)
    refresh_tok = create_refresh_token(user_id, secret_key, algorithm, refresh_expire_days)

    from datetime import datetime, timedelta, timezone
    rt = RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(refresh_tok),
        expires_at=datetime.now(timezone.utc) + timedelta(days=refresh_expire_days),
    )
    session.add(rt)
    await session.commit()

    return {"user": user, "access_token": access_token, "refresh_token": refresh_tok}


@trace
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


@trace
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


# --- TOTP MFA ---


async def setup_totp(session: AsyncSession, user_id: UUID) -> dict:
    """Generate a TOTP secret and provisioning URI for QR code."""
    import pyotp

    user = await get_user(session, user_id)
    if user.totp_enabled:
        raise ValidationError("TOTP is already enabled")

    # Generate secret and store it (not yet enabled)
    secret = pyotp.random_base32()
    user.totp_secret = secret
    await session.commit()

    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.email, issuer_name="pOS")

    return {"secret": secret, "provisioning_uri": uri}


async def confirm_totp(
    session: AsyncSession, user_id: UUID, data: ConfirmTotpRequest,
) -> dict:
    """Verify a TOTP code to confirm setup, then enable MFA and return backup codes."""
    import json
    import pyotp

    user = await get_user(session, user_id)
    if not _verify_password(data.password, user.password_hash):
        raise AuthenticationError("Incorrect password")
    if not user.totp_secret:
        raise ValidationError("TOTP not set up — call /setup-totp first")
    if user.totp_enabled:
        raise ValidationError("TOTP is already enabled")

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(data.totp_code, valid_window=1):
        raise AuthenticationError("Invalid TOTP code — scan the QR code and try again")

    # Generate backup codes
    raw_codes = [secrets.token_hex(4) for _ in range(8)]  # 8 codes, 8 hex chars each
    hashed_codes = [hashlib.sha256(c.encode()).hexdigest() for c in raw_codes]

    user.totp_enabled = True
    user.backup_codes = json.dumps(hashed_codes)
    await session.commit()

    return {"backup_codes": raw_codes}


async def disable_totp(
    session: AsyncSession, user_id: UUID, password: str,
) -> None:
    """Disable TOTP MFA after verifying password."""
    user = await get_user(session, user_id)
    if not _verify_password(password, user.password_hash):
        raise AuthenticationError("Incorrect password")
    user.totp_enabled = False
    user.totp_secret = None
    user.backup_codes = None
    await session.commit()
