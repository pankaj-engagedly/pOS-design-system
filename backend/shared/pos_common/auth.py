"""JWT authentication utilities."""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from .exceptions import AuthenticationError


def create_access_token(
    user_id: str,
    secret_key: str,
    algorithm: str = "HS256",
    expires_minutes: int = 15,
) -> str:
    """Create a JWT access token."""
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
    """Create a JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=expires_days)
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, secret_key, algorithm=algorithm)


def validate_token(token: str, secret_key: str, algorithm: str = "HS256") -> str:
    """Validate a JWT token and return the user_id.

    Args:
        token: The JWT token string
        secret_key: The secret key used to sign the token
        algorithm: The algorithm used (default HS256)

    Returns:
        The user_id (sub claim) from the token

    Raises:
        AuthenticationError: If the token is invalid or expired
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Token missing user identity")
        return user_id
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e}")
