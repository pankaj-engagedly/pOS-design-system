"""Pydantic schemas for the vault service."""

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# ── Tags ──────────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    count: int = 0


# ── Fields ────────────────────────────────────────────────────────────────────

FIELD_TYPES = {"text", "secret", "url", "email", "phone", "notes"}
MASK = "••••••••"


class VaultFieldCreate(BaseModel):
    field_name: str
    field_value: str
    field_type: str = "text"


class VaultFieldUpdate(BaseModel):
    field_name: Optional[str] = None
    field_value: Optional[str] = None
    field_type: Optional[str] = None


class VaultFieldResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    vault_item_id: UUID
    field_name: str
    field_value: str  # masked to MASK if field_type == "secret"
    field_type: str
    position: int


class VaultFieldRevealResponse(BaseModel):
    id: UUID
    field_name: str
    field_type: str
    value: str  # plaintext


class ReorderRequest(BaseModel):
    ordered_ids: List[UUID]


# ── Vault Items ───────────────────────────────────────────────────────────────

class VaultItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


class VaultItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: Optional[bool] = None


class VaultItemResponse(BaseModel):
    """Summary response — no field values, just counts and tags."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str]
    icon: Optional[str]
    is_favorite: bool
    field_count: int = 0
    tags: List[TagResponse] = []


class VaultItemDetailResponse(BaseModel):
    """Full detail response — includes fields (secrets masked) and tags."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str]
    icon: Optional[str]
    is_favorite: bool
    fields: List[VaultFieldResponse] = []
    tags: List[TagResponse] = []
