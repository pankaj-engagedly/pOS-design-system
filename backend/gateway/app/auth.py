"""JWT token validation for the API gateway.

Edge authentication: the gateway is the single trust boundary.
It validates every inbound JWT and injects X-User-Id into the request
so downstream services never touch auth logic — they just read the header.

Services behind the gateway operate in a trusted network. Adding auth logic
to individual services would mean every service must be updated when the
auth scheme changes. With edge auth, only the gateway changes.
"""

from datetime import datetime, timezone

from jose import JWTError, jwt

from pos_contracts.exceptions import AuthenticationError


def validate_token(token: str, secret_key: str, algorithm: str = "HS256") -> str:
    """Validate a JWT access token and return the user_id.

    Args:
        token: Bearer token string (without the 'Bearer ' prefix)
        secret_key: HS256 signing key
        algorithm: JWT algorithm (default HS256)

    Returns:
        user_id — the 'sub' claim from the token payload

    Raises:
        AuthenticationError: if the token is invalid, expired, or missing sub
    """
    try:
        payload = jwt.decode(token, secret_key, algorithms=[algorithm])
        user_id = payload.get("sub")
        if user_id is None:
            raise AuthenticationError("Token missing user identity")
        return user_id
    except JWTError as e:
        raise AuthenticationError(f"Invalid token: {e}")
