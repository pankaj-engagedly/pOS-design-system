"""Photo comment API routes — CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .db import get_session as get_async_session
from .models import Photo, PhotoComment
from .schemas import CommentCreate, CommentResponse, CommentUpdate

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/{photo_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    photo_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    # Verify photo exists
    photo = await session.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == user_id)
    )
    if not photo.scalar_one_or_none():
        raise NotFoundError(f"Photo {photo_id} not found")

    result = await session.execute(
        select(PhotoComment)
        .where(PhotoComment.photo_id == photo_id, PhotoComment.user_id == user_id)
        .order_by(PhotoComment.created_at)
    )
    return list(result.scalars().all())


@router.post("/{photo_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    photo_id: UUID,
    data: CommentCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    # Verify photo exists
    photo = await session.execute(
        select(Photo).where(Photo.id == photo_id, Photo.user_id == user_id)
    )
    if not photo.scalar_one_or_none():
        raise NotFoundError(f"Photo {photo_id} not found")

    comment = PhotoComment(
        user_id=user_id,
        photo_id=photo_id,
        text=data.text,
    )
    session.add(comment)
    await session.commit()
    await session.refresh(comment)
    return comment


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    comment_id: UUID,
    data: CommentUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(PhotoComment).where(
            PhotoComment.id == comment_id, PhotoComment.user_id == user_id
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise NotFoundError(f"Comment {comment_id} not found")

    comment.text = data.text
    await session.commit()
    await session.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(PhotoComment).where(
            PhotoComment.id == comment_id, PhotoComment.user_id == user_id
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise NotFoundError(f"Comment {comment_id} not found")

    await session.delete(comment)
    await session.commit()
