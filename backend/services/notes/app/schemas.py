"""Notes Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# --- Folder schemas ---

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class FolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


class FolderResponse(BaseModel):
    id: UUID
    name: str
    position: int
    note_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Tag schemas ---

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TagResponse(BaseModel):
    id: UUID
    name: str
    note_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Note schemas ---

class NoteCreate(BaseModel):
    title: str = Field("", max_length=500)
    content: dict | None = None  # Tiptap JSON document
    folder_id: UUID | None = None
    color: str | None = Field(None, max_length=20)
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    title: str | None = Field(None, max_length=500)
    content: dict | None = None
    folder_id: UUID | None = None
    color: str | None = Field(None, max_length=20)
    is_pinned: bool | None = None


class NoteSummaryResponse(BaseModel):
    """Note without content — used in list views."""
    id: UUID
    title: str
    preview_text: str | None
    color: str | None
    is_pinned: bool
    is_deleted: bool
    deleted_at: datetime | None
    folder_id: UUID | None
    tags: list[TagResponse] = []
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NoteResponse(BaseModel):
    """Full note with content — used for single note fetch."""
    id: UUID
    title: str
    content: dict | None
    preview_text: str | None
    color: str | None
    is_pinned: bool
    is_deleted: bool
    deleted_at: datetime | None
    folder_id: UUID | None
    tags: list[TagResponse] = []
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Reorder ---

class ReorderRequest(BaseModel):
    ordered_ids: list[UUID]
