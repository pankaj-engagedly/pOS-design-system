"""Sample Pydantic schemas — request/response models."""

from uuid import UUID

from pydantic import BaseModel


class SampleItemCreate(BaseModel):
    title: str
    description: str | None = None


class SampleItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class SampleItemResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: str | None

    model_config = {"from_attributes": True}
