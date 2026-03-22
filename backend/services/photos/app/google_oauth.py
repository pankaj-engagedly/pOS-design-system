"""Google OAuth2 helpers for Photos service.

Handles: authorization URL generation, code exchange, token refresh,
token revocation, and HMAC-signed state parameter for CSRF protection.
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from .models import PhotoSource

# Google endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

# Scopes
SCOPES = [
    "https://www.googleapis.com/auth/photoslibrary.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
]


def _get_config():
    """Get photos service config (lazy import to avoid circular)."""
    from .main import config
    return config


def _hmac_sign(data: str, secret: str) -> str:
    """HMAC-SHA256 sign a string, return hex digest."""
    return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()


def build_auth_url(user_id: str) -> str:
    """Generate Google OAuth2 authorization URL with HMAC-signed state."""
    cfg = _get_config()
    # State = base64(json({user_id, sig}))
    sig = _hmac_sign(user_id, cfg.APP_SECRET_KEY)
    state_data = json.dumps({"uid": user_id, "sig": sig})
    state = base64.urlsafe_b64encode(state_data.encode()).decode()

    params = {
        "client_id": cfg.GOOGLE_CLIENT_ID,
        "redirect_uri": cfg.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def verify_state(state: str) -> str | None:
    """Verify HMAC-signed state parameter. Returns user_id or None."""
    cfg = _get_config()
    try:
        state_data = json.loads(base64.urlsafe_b64decode(state))
        user_id = state_data["uid"]
        sig = state_data["sig"]
        expected = _hmac_sign(user_id, cfg.APP_SECRET_KEY)
        if hmac.compare_digest(sig, expected):
            return user_id
        return None
    except Exception:
        return None


async def exchange_code(code: str) -> dict:
    """Exchange authorization code for tokens. Returns token dict."""
    cfg = _get_config()
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": cfg.GOOGLE_CLIENT_ID,
            "client_secret": cfg.GOOGLE_CLIENT_SECRET,
            "redirect_uri": cfg.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an access token using refresh token. Returns token dict."""
    cfg = _get_config()
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": cfg.GOOGLE_CLIENT_ID,
            "client_secret": cfg.GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
        if resp.status_code in (400, 401):
            data = resp.json()
            if data.get("error") == "invalid_grant":
                raise TokenRevokedError("Google access revoked — reconnect in Settings")
        resp.raise_for_status()
        return resp.json()


async def revoke_token(token: str) -> None:
    """Revoke a token with Google (best-effort)."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(GOOGLE_REVOKE_URL, params={"token": token})
    except Exception as e:
        logger.warning(f"Token revocation failed (best-effort): {e}")


async def get_user_email(access_token: str) -> str:
    """Fetch the Google account email using userinfo endpoint."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()["email"]


# ── Token encryption ───────────────────────────────────

def _get_fernet(user_id: str):
    """Get Fernet instance for encrypting Google tokens."""
    import base64 as b64
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF

    cfg = _get_config()
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=user_id.encode(),
        info=b"pos-google-oauth-token",
    )
    raw = hkdf.derive(cfg.APP_SECRET_KEY.encode())
    key = b64.urlsafe_b64encode(raw)
    return Fernet(key)


def encrypt_refresh_token(refresh_token: str, user_id: str) -> str:
    """Encrypt refresh token for storage."""
    f = _get_fernet(user_id)
    return "encrypted:" + f.encrypt(refresh_token.encode()).decode()


def decrypt_refresh_token(encrypted: str, user_id: str) -> str:
    """Decrypt stored refresh token."""
    f = _get_fernet(user_id)
    # Strip "encrypted:" prefix
    ciphertext = encrypted.removeprefix("encrypted:")
    return f.decrypt(ciphertext.encode()).decode()


# ── Token refresh helper ───────────────────────────────

class TokenRevokedError(Exception):
    """Raised when Google refresh token is revoked/invalid."""
    pass


async def ensure_fresh_token(session: AsyncSession, source: PhotoSource) -> str:
    """Check token expiry and refresh if needed. Returns valid access_token.

    Raises TokenRevokedError if the refresh token is invalid.
    """
    config_data = source.config or {}
    access_token = config_data.get("access_token")
    expiry_str = config_data.get("token_expiry")

    # Check if token needs refresh (expired or within 5 min)
    needs_refresh = True
    if expiry_str and access_token:
        try:
            expiry = datetime.fromisoformat(expiry_str)
            if expiry > datetime.now(timezone.utc) + timedelta(minutes=5):
                needs_refresh = False
        except (ValueError, TypeError):
            pass

    if not needs_refresh:
        return access_token

    # Decrypt refresh token
    encrypted_rt = config_data.get("refresh_token", "")
    if not encrypted_rt:
        raise TokenRevokedError("No refresh token stored")

    refresh_token = decrypt_refresh_token(encrypted_rt, source.user_id)

    # Refresh
    logger.info(f"Refreshing Google access token for source {source.id}")
    tokens = await refresh_access_token(refresh_token)

    # Update stored tokens
    new_config = dict(config_data)
    new_config["access_token"] = tokens["access_token"]
    new_config["token_expiry"] = (
        datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))
    ).isoformat()

    # If Google issued a new refresh token, encrypt and store it
    if "refresh_token" in tokens:
        new_config["refresh_token"] = encrypt_refresh_token(tokens["refresh_token"], source.user_id)

    source.config = new_config
    await session.commit()
    await session.refresh(source)

    return tokens["access_token"]
