"""PAN encryption helpers — same pattern as vault (Fernet + HKDF)."""

import base64
from uuid import UUID

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def derive_key(app_secret: str, user_id: UUID) -> bytes:
    """Derive a 32-byte key from app_secret + user_id using HKDF."""
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=str(user_id).encode(),
        info=b"pos-portfolio-pan-encryption",
    )
    raw = hkdf.derive(app_secret.encode())
    return base64.urlsafe_b64encode(raw)


def get_fernet(app_secret: str, user_id: UUID) -> Fernet:
    """Return a Fernet instance for the given user."""
    return Fernet(derive_key(app_secret, user_id))


def encrypt_pan(pan: str, fernet: Fernet) -> str:
    """Encrypt a PAN string."""
    return fernet.encrypt(pan.encode()).decode()


def decrypt_pan(ciphertext: str, fernet: Fernet) -> str:
    """Decrypt a PAN string."""
    return fernet.decrypt(ciphertext.encode()).decode()


def mask_pan(pan: str) -> str:
    """Mask PAN showing only last 4 chars: ABCDE1234F → ******234F"""
    if not pan or len(pan) < 4:
        return pan
    return "*" * (len(pan) - 4) + pan[-4:]
