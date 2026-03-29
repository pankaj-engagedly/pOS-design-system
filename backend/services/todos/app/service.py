"""Todo business logic — lists, tasks, subtasks CRUD with user scoping."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError
from pos_contracts.logging import trace

from .models import Subtask, Task, TaskComment, TodoList
from .schemas import (
    CommentCreate,
    CommentUpdate,
    ListCreate,
    ListUpdate,
    ReorderRequest,
    SubtaskCreate,
    SubtaskUpdate,
    TaskCreate,
    TaskUpdate,
)


# --- Lists ---


@trace
async def get_lists(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all lists for user, ordered by position, with task counts."""
    result = await session.execute(
        select(TodoList).where(TodoList.user_id == user_id).order_by(TodoList.position)
    )
    lists = list(result.scalars().all())

    # Get active task counts per list
    count_result = await session.execute(
        select(Task.list_id, func.count(Task.id))
        .where(Task.user_id == user_id, Task.status != "archived")
        .group_by(Task.list_id)
    )
    counts = dict(count_result.all())

    return [
        {**_model_to_dict(lst), "task_count": counts.get(lst.id, 0)}
        for lst in lists
    ]


async def ensure_inbox(session: AsyncSession, user_id: UUID) -> TodoList:
    """Get or create the default Inbox list for a user."""
    result = await session.execute(
        select(TodoList).where(
            TodoList.user_id == user_id, TodoList.name == "Inbox"
        )
    )
    inbox = result.scalar_one_or_none()
    if not inbox:
        inbox = TodoList(user_id=user_id, name="Inbox", position=0)
        session.add(inbox)
        await session.commit()
        await session.refresh(inbox)
    return inbox


@trace
async def create_list(
    session: AsyncSession, user_id: UUID, data: ListCreate
) -> TodoList:
    # Get next position
    result = await session.execute(
        select(func.coalesce(func.max(TodoList.position), -1))
        .where(TodoList.user_id == user_id)
    )
    max_pos = result.scalar()
    lst = TodoList(user_id=user_id, name=data.name, position=max_pos + 1)
    session.add(lst)
    await session.commit()
    await session.refresh(lst)
    return lst


@trace
async def update_list(
    session: AsyncSession, user_id: UUID, list_id: UUID, data: ListUpdate
) -> TodoList:
    lst = await _get_list(session, user_id, list_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(lst, key, value)
    await session.commit()
    await session.refresh(lst)
    return lst


@trace
async def delete_list(session: AsyncSession, user_id: UUID, list_id: UUID) -> None:
    lst = await _get_list(session, user_id, list_id)
    await session.delete(lst)
    await session.commit()


async def reorder_lists(
    session: AsyncSession, user_id: UUID, data: ReorderRequest
) -> None:
    for idx, list_id in enumerate(data.ordered_ids):
        result = await session.execute(
            select(TodoList).where(TodoList.id == list_id, TodoList.user_id == user_id)
        )
        lst = result.scalar_one_or_none()
        if lst:
            lst.position = idx
    await session.commit()


# --- Tasks ---


@trace
async def get_tasks(
    session: AsyncSession, user_id: UUID, list_id: UUID
) -> list[dict]:
    """Get tasks for a list, ordered by position, with subtask counts."""
    result = await session.execute(
        select(Task)
        .options(selectinload(Task.subtasks))
        .where(Task.user_id == user_id, Task.list_id == list_id)
        .order_by(Task.position)
    )
    tasks = list(result.scalars().all())
    return [
        {
            **_model_to_dict(t),
            "subtask_total": len(t.subtasks),
            "subtask_done": sum(1 for s in t.subtasks if s.is_completed),
            "subtasks": sorted(t.subtasks, key=lambda s: s.position),
        }
        for t in tasks
    ]


@trace
async def create_task(
    session: AsyncSession, user_id: UUID, data: TaskCreate
) -> Task:
    # Verify list belongs to user
    await _get_list(session, user_id, data.list_id)

    # Get next position
    result = await session.execute(
        select(func.coalesce(func.max(Task.position), -1))
        .where(Task.user_id == user_id, Task.list_id == data.list_id)
    )
    max_pos = result.scalar()

    task_data = data.model_dump()
    # Convert UUID objects to strings for JSON column storage
    if task_data.get("attachment_ids"):
        task_data["attachment_ids"] = [str(uid) for uid in task_data["attachment_ids"]]
    task = Task(
        user_id=user_id,
        position=max_pos + 1,
        **task_data,
    )
    session.add(task)
    await session.commit()
    # Re-fetch with subtasks eagerly loaded for TaskResponse serialization
    return await get_task(session, user_id, task.id)


@trace
async def get_task(session: AsyncSession, user_id: UUID, task_id: UUID) -> Task:
    """Get a single task with subtasks and comments."""
    result = await session.execute(
        select(Task)
        .options(selectinload(Task.subtasks), selectinload(Task.comments))
        .where(Task.id == task_id, Task.user_id == user_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise NotFoundError(f"Task {task_id} not found")
    return task


@trace
async def update_task(
    session: AsyncSession, user_id: UUID, task_id: UUID, data: TaskUpdate
) -> Task:
    task = await get_task(session, user_id, task_id)
    old_status = task.status
    for key, value in data.model_dump(exclude_unset=True).items():
        # Convert UUID objects to strings for JSON column storage
        if key == "attachment_ids" and value is not None:
            value = [str(uid) for uid in value]
        setattr(task, key, value)
    await session.commit()

    # Re-fetch with subtasks eagerly loaded for TaskResponse serialization
    updated = await get_task(session, user_id, task_id)
    # Carry old_status for event publishing
    updated._old_status = old_status
    return updated


@trace
async def delete_task(session: AsyncSession, user_id: UUID, task_id: UUID) -> None:
    task = await get_task(session, user_id, task_id)
    await session.delete(task)
    await session.commit()


async def reorder_tasks(
    session: AsyncSession, user_id: UUID, list_id: UUID, data: ReorderRequest
) -> None:
    for idx, task_id in enumerate(data.ordered_ids):
        result = await session.execute(
            select(Task).where(
                Task.id == task_id,
                Task.user_id == user_id,
                Task.list_id == list_id,
            )
        )
        task = result.scalar_one_or_none()
        if task:
            task.position = idx
    await session.commit()


# --- Subtasks ---


async def add_subtask(
    session: AsyncSession, user_id: UUID, task_id: UUID, data: SubtaskCreate
) -> Subtask:
    # Verify task belongs to user
    await get_task(session, user_id, task_id)

    result = await session.execute(
        select(func.coalesce(func.max(Subtask.position), -1))
        .where(Subtask.task_id == task_id)
    )
    max_pos = result.scalar()

    subtask = Subtask(
        user_id=user_id,
        task_id=task_id,
        title=data.title,
        position=max_pos + 1,
    )
    session.add(subtask)
    await session.commit()
    await session.refresh(subtask)
    return subtask


async def update_subtask(
    session: AsyncSession, user_id: UUID, subtask_id: UUID, data: SubtaskUpdate
) -> Subtask:
    result = await session.execute(
        select(Subtask).where(Subtask.id == subtask_id, Subtask.user_id == user_id)
    )
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(subtask, key, value)
    await session.commit()
    await session.refresh(subtask)
    return subtask


async def delete_subtask(
    session: AsyncSession, user_id: UUID, subtask_id: UUID
) -> None:
    result = await session.execute(
        select(Subtask).where(Subtask.id == subtask_id, Subtask.user_id == user_id)
    )
    subtask = result.scalar_one_or_none()
    if not subtask:
        raise NotFoundError(f"Subtask {subtask_id} not found")
    await session.delete(subtask)
    await session.commit()


# --- Comments ---


async def add_comment(
    session: AsyncSession, user_id: UUID, task_id: UUID, data: CommentCreate
) -> TaskComment:
    await get_task(session, user_id, task_id)
    comment = TaskComment(user_id=user_id, task_id=task_id, content=data.content)
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment


async def update_comment(
    session: AsyncSession, user_id: UUID, comment_id: UUID, data: CommentUpdate
) -> TaskComment:
    result = await session.execute(
        select(TaskComment).where(TaskComment.id == comment_id, TaskComment.user_id == user_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise NotFoundError(f"Comment {comment_id} not found")
    comment.content = data.content
    await session.commit()
    await session.refresh(comment)
    return comment


async def delete_comment(session: AsyncSession, user_id: UUID, comment_id: UUID) -> None:
    result = await session.execute(
        select(TaskComment).where(TaskComment.id == comment_id, TaskComment.user_id == user_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise NotFoundError(f"Comment {comment_id} not found")
    await session.delete(comment)
    await session.commit()


# --- Duplicate ---


async def duplicate_task(
    session: AsyncSession, user_id: UUID, task_id: UUID
) -> Task:
    """Duplicate a task with its subtasks (not comments/attachments)."""
    source = await get_task(session, user_id, task_id)

    # Get next position in the same list
    result = await session.execute(
        select(func.coalesce(func.max(Task.position), -1))
        .where(Task.user_id == user_id, Task.list_id == source.list_id)
    )
    max_pos = result.scalar()

    new_task = Task(
        user_id=user_id,
        list_id=source.list_id,
        title=f"{source.title} (copy)",
        description=source.description,
        status="todo",
        priority=source.priority,
        due_date=source.due_date,
        is_important=source.is_important,
        is_urgent=source.is_urgent,
        position=max_pos + 1,
        attachment_ids=[],
    )
    session.add(new_task)
    await session.flush()

    # Duplicate subtasks
    for s in sorted(source.subtasks, key=lambda x: x.position):
        new_sub = Subtask(
            user_id=user_id,
            task_id=new_task.id,
            title=s.title,
            is_completed=False,
            position=s.position,
        )
        session.add(new_sub)

    await session.commit()
    return await get_task(session, user_id, new_task.id)


# --- Helpers ---


async def _get_list(session: AsyncSession, user_id: UUID, list_id: UUID) -> TodoList:
    result = await session.execute(
        select(TodoList).where(TodoList.id == list_id, TodoList.user_id == user_id)
    )
    lst = result.scalar_one_or_none()
    if not lst:
        raise NotFoundError(f"List {list_id} not found")
    return lst


def _model_to_dict(obj):
    """Convert SQLAlchemy model to dict for merging with extra fields."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
