"""Attachment Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AttachmentResponse(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BatchRequest(BaseModel):
    ids: list[UUID]
