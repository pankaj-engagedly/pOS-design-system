"""Fernet encryption helpers for vault secret fields.

Key derivation: HKDF(SHA-256) with app_secret as input key material
and user_id as salt. Each user gets a unique encryption key derived
from the shared app secret — compromising the DB alone doesn't expose
secrets unless the APP_SECRET_KEY is also known.
"""

import base64
from uuid import UUID

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

MASK = "••••••••"


def derive_key(app_secret: str, user_id: UUID) -> bytes:
    """Derive a 32-byte key from app_secret + user_id using HKDF."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=str(user_id).encode(),
        info=b"pos-vault-field-encryption",
    )
    raw = hkdf.derive(app_secret.encode())
    # Fernet requires a url-safe base64-encoded 32-byte key
    return base64.urlsafe_b64encode(raw)


def get_encryption_key(app_secret: str, user_id: UUID) -> Fernet:
    """Return a Fernet instance for the given user."""
    return Fernet(derive_key(app_secret, user_id))


def encrypt_value(plaintext: str, fernet: Fernet) -> str:
    """Encrypt a plaintext string, returning a base64 Fernet token."""
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str, fernet: Fernet) -> str:
    """Decrypt a Fernet token back to plaintext string."""
    return fernet.decrypt(ciphertext.encode()).decode()
