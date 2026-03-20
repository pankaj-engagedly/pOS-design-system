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


# ── Constants ─────────────────────────────────────────────────────────────────

FIELD_TYPES = {"text", "secret", "url", "email", "phone", "notes"}
MASK = "••••••••"


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None


class CategoryReorderRequest(BaseModel):
    ordered_ids: List[UUID]


class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    icon: Optional[str]
    position: int
    item_count: int = 0


# ── Field Templates ───────────────────────────────────────────────────────────

class FieldTemplateCreate(BaseModel):
    field_name: str
    field_type: str = "text"
    section: str = "General"


class FieldTemplateUpdate(BaseModel):
    field_name: Optional[str] = None
    field_type: Optional[str] = None
    section: Optional[str] = None


class FieldTemplateReorderRequest(BaseModel):
    ordered_ids: List[UUID]


class FieldTemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    field_name: str
    field_type: str
    section: str
    position: int


# ── Field Values ──────────────────────────────────────────────────────────────

class FieldValueCreate(BaseModel):
    template_id: Optional[UUID] = None     # Link to template field
    field_name: Optional[str] = None       # Required if template_id is None
    field_type: Optional[str] = "text"     # Required if template_id is None
    section: Optional[str] = "General"    # Required if template_id is None
    field_value: str = ""


class FieldValueUpdate(BaseModel):
    field_value: Optional[str] = None
    # For standalone fields, allow renaming
    field_name: Optional[str] = None
    field_type: Optional[str] = None
    section: Optional[str] = None


class ResolvedFieldResponse(BaseModel):
    """A field as rendered in item detail — merges template definition + value."""
    id: Optional[UUID]            # None if no value stored yet (empty template field)
    template_id: Optional[UUID]
    field_name: str
    field_type: str
    section: str
    field_value: Optional[str]    # masked if secret, None if no value
    has_value: bool
    position: int


class FieldValueRevealResponse(BaseModel):
    id: UUID
    field_name: str
    field_type: str
    value: str  # plaintext


# ── Vault Items ───────────────────────────────────────────────────────────────

class VaultItemCreate(BaseModel):
    category_id: UUID
    name: str
    icon: Optional[str] = None


class VaultItemUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    is_favorite: Optional[bool] = None
    category_id: Optional[UUID] = None


class VaultItemResponse(BaseModel):
    """Summary — for list views."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    category_name: str = ""
    name: str
    icon: Optional[str]
    is_favorite: bool
    field_count: int = 0
    tags: List[TagResponse] = []


class SectionResponse(BaseModel):
    name: str
    fields: List[ResolvedFieldResponse]


class VaultItemDetailResponse(BaseModel):
    """Full detail — resolved sections (templates merged with values)."""
    id: UUID
    category_id: UUID
    category_name: str
    name: str
    icon: Optional[str]
    is_favorite: bool
    sections: List[SectionResponse] = []
    tags: List[TagResponse] = []
