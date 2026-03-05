"""Shared Pydantic schemas used across services."""

from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel

T = TypeVar("T")


class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = ""


class ErrorResponse(BaseModel):
    detail: str


class PaginationParams(BaseModel):
    page: int = 1
    page_size: int = 20


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
