"""Todo Pydantic schemas for request/response validation."""

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"
    archived = "archived"


class TaskPriority(str, Enum):
    none = "none"
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


# --- Subtask schemas ---

class SubtaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)


class SubtaskUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    is_completed: bool | None = None


class SubtaskResponse(BaseModel):
    id: UUID
    title: str
    is_completed: bool
    position: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- List schemas ---

class ListCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class ListUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


class ListResponse(BaseModel):
    id: UUID
    name: str
    position: int
    task_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Task schemas ---

class TaskCreate(BaseModel):
    list_id: UUID
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    priority: TaskPriority = TaskPriority.none
    due_date: date | None = None
    is_important: bool = False
    is_urgent: bool = False
    attachment_ids: list[UUID] = []


class TaskUpdate(BaseModel):
    list_id: UUID | None = None
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: date | None = None
    is_important: bool | None = None
    is_urgent: bool | None = None
    attachment_ids: list[UUID] | None = None


class TaskResponse(BaseModel):
    id: UUID
    list_id: UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    is_important: bool
    is_urgent: bool
    position: int
    attachment_ids: list[UUID] = []
    subtasks: list[SubtaskResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TaskSummaryResponse(BaseModel):
    """Task without subtasks — used in list views."""
    id: UUID
    list_id: UUID
    title: str
    status: TaskStatus
    priority: TaskPriority
    due_date: date | None
    is_important: bool
    is_urgent: bool
    position: int
    attachment_ids: list[UUID] = []
    subtask_total: int = 0
    subtask_done: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Reorder ---

class ReorderRequest(BaseModel):
    ordered_ids: list[UUID]
