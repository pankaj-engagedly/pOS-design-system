"""JWT token creation and validation for the auth service.

Token lifecycle lives here — the auth service is the only service that creates
tokens and the only service that needs to validate them (for refresh/revoke flows).
All other services trust the X-User-Id header set by the gateway.

Why not shared? Token creation details (expiry, claims, algorithm) are an
auth-service concern. If we add claims (roles, scopes) in the future, only
this file changes — not a shared library and not every service.
"""

import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from pos_contracts.exceptions import AuthenticationError


def create_access_token(
    user_id: str,
    secret_key: str,
    algorithm: str = "HS256",
    expires_minutes: int = 15,
) -> str:
    """Create a short-lived JWT access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, secret_key, algorithm=algorithm)


def create_refresh_token(
    user_id: str,
    secret_key: str,
    algorithm: str = "HS256",
    expires_days: int = 7,
) -> str:
    """Create a long-lived JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
        "jti": str(uuid.uuid4()),  # unique ID to prevent hash collisions
    }
    return jwt.encode(payload, secret_key, algorithm=algorithm)


def validate_token(token: str, secret_key: str, algorithm: str = "HS256") -> str:
    """Validate a JWT and return the user_id.

    Used internally for refresh token validation — the only time the auth
    service needs to decode a token it didn't just create.

    Raises:
        AuthenticationError: if invalid or expired
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Token missing user identity")
        return user_id
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e}")
