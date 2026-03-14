"""Todo API routes — lists, tasks, subtasks CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_common.database import get_async_session

from . import service
from .events import publish_task_event
from .schemas import (
    ListCreate,
    ListResponse,
    ListUpdate,
    ReorderRequest,
    SubtaskCreate,
    SubtaskResponse,
    SubtaskUpdate,
    TaskCreate,
    TaskResponse,
    TaskSummaryResponse,
    TaskUpdate,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    """Extract user_id from request state (set by auth middleware)."""
    return UUID(request.state.user_id)


# --- Lists ---


@router.get("/lists", response_model=list[ListResponse])
async def list_lists(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    # Ensure Inbox exists
    await service.ensure_inbox(session, user_id)
    return await service.get_lists(session, user_id)


@router.post("/lists", response_model=ListResponse, status_code=201)
async def create_list(
    data: ListCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    lst = await service.create_list(session, user_id, data)
    return {**service._model_to_dict(lst), "task_count": 0}


@router.patch("/lists/{list_id}", response_model=ListResponse)
async def update_list(
    list_id: UUID,
    data: ListUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    lst = await service.update_list(session, user_id, list_id, data)
    return {**service._model_to_dict(lst), "task_count": 0}


@router.delete("/lists/{list_id}", status_code=204)
async def delete_list(
    list_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.delete_list(session, user_id, list_id)


@router.patch("/lists/reorder", status_code=204)
async def reorder_lists(
    data: ReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.reorder_lists(session, user_id, data)


# --- Tasks ---


@router.get("/lists/{list_id}/tasks", response_model=list[TaskSummaryResponse])
async def list_tasks(
    list_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_tasks(session, user_id, list_id)


@router.post("/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    task = await service.create_task(session, user_id, data)
    await publish_task_event("todo.task.created", task, request.app.state.config)
    return task


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_task(session, user_id, task_id)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    data: TaskUpdate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    task = await service.update_task(session, user_id, task_id, data)
    event = "todo.task.updated"
    old_status = getattr(task, "_old_status", None)
    if old_status and old_status != "done" and task.status == "done":
        event = "todo.task.completed"
    await publish_task_event(event, task, request.app.state.config)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.delete_task(session, user_id, task_id)


@router.patch("/tasks/reorder", status_code=204)
async def reorder_tasks(
    list_id: UUID,
    data: ReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.reorder_tasks(session, user_id, list_id, data)


# --- Subtasks ---


@router.post("/tasks/{task_id}/subtasks", response_model=SubtaskResponse, status_code=201)
async def add_subtask(
    task_id: UUID,
    data: SubtaskCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.add_subtask(session, user_id, task_id, data)


@router.patch("/subtasks/{subtask_id}", response_model=SubtaskResponse)
async def update_subtask(
    subtask_id: UUID,
    data: SubtaskUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.update_subtask(session, user_id, subtask_id, data)


@router.delete("/subtasks/{subtask_id}", status_code=204)
async def delete_subtask(
    subtask_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.delete_subtask(session, user_id, subtask_id)
