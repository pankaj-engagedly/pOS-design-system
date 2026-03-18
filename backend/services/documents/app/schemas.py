"""Documents Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# --- Folder schemas ---

class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: UUID | None = None


class FolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    parent_id: UUID | None = None


class FolderResponse(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None
    position: int
    child_count: int = 0
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Tag schemas ---

class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TagResponse(BaseModel):
    id: UUID
    name: str
    document_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Document schemas ---

class DocumentCreate(BaseModel):
    attachment_id: UUID
    name: str = Field(..., min_length=1, max_length=500)
    folder_id: UUID | None = None
    description: str | None = Field(None, max_length=1000)
    file_size: int | None = None
    content_type: str | None = None


class DocumentUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = Field(None, max_length=1000)
    folder_id: UUID | None = None


class DocumentResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    attachment_id: UUID
    file_size: int | None
    content_type: str | None
    folder_id: UUID | None
    tags: list[TagResponse] = []
    is_favourite: bool = False
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Share schemas ---

class ShareCreate(BaseModel):
    email: str = Field(..., description="Email of the pOS user to share with")
    document_id: UUID | None = None
    folder_id: UUID | None = None


class ShareResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    shared_with_user_id: UUID
    document_id: UUID | None
    folder_id: UUID | None
    permission: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SharedWithMeResponse(BaseModel):
    """A document or folder shared with the current user."""
    share_id: UUID
    shared_by_user_id: UUID
    document: DocumentResponse | None = None
    folder: FolderResponse | None = None
    permission: str


# --- Recent access schemas ---

class RecentDocumentResponse(BaseModel):
    document: DocumentResponse
    accessed_at: datetime


# --- Reorder ---

class ReorderRequest(BaseModel):
    ordered_ids: list[UUID]


# --- Folder path ---

class FolderPathItem(BaseModel):
    id: UUID
    name: str


# --- Comment schemas ---

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1)


class CommentUpdate(BaseModel):
    content: str | None = None


class CommentResponse(BaseModel):
    id: UUID
    document_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
