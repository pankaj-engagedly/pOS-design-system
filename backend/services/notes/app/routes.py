"""Notes API routes — folders, notes, tags CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .db import get_session as get_async_session

from . import service
from .events import publish_folder_event, publish_note_event, publish_tag_event
from .schemas import (
    FolderCreate,
    FolderResponse,
    FolderUpdate,
    NoteCreate,
    NoteResponse,
    NoteSummaryResponse,
    NoteUpdate,
    ReorderRequest,
    TagCreate,
    TagResponse,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    """Extract user_id from request state (set by auth middleware)."""
    return UUID(request.state.user_id)


# --- Error handler helper ---

def _handle_not_found(e: NotFoundError):
    raise HTTPException(status_code=404, detail=str(e))


# --- Folders ---


@router.get("/folders", response_model=list[FolderResponse])
async def list_folders(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_folders(session, user_id)


@router.post("/folders", response_model=FolderResponse, status_code=201)
async def create_folder(
    data: FolderCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        folder = await service.create_folder(session, user_id, data)
        await publish_folder_event("folder.created", folder)
        return {**service._model_to_dict(folder), "note_count": 0}
    except Exception as e:
        if "uq_folders_user_name" in str(e):
            raise HTTPException(status_code=409, detail="Folder name already exists")
        raise


@router.patch("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    data: FolderUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        folder = await service.update_folder(session, user_id, folder_id, data)
        await publish_folder_event("folder.updated", folder)
        return {**service._model_to_dict(folder), "note_count": 0}
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        folder = await service._get_folder(session, user_id, folder_id)
        await service.delete_folder(session, user_id, folder_id)
        await publish_folder_event("folder.deleted", folder)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/folders/reorder", status_code=204)
async def reorder_folders(
    data: ReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.reorder_folders(session, user_id, data)


# --- Notes ---


@router.get("/notes", response_model=list[NoteSummaryResponse])
async def list_notes(
    folder_id: UUID | None = None,
    tag: str | None = None,
    is_pinned: bool | None = None,
    is_deleted: bool = False,
    search: str | None = None,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_notes(
        session,
        user_id,
        folder_id=folder_id,
        tag=tag,
        is_pinned=is_pinned,
        is_deleted=is_deleted,
        search=search,
    )


@router.post("/notes", response_model=NoteResponse, status_code=201)
async def create_note(
    data: NoteCreate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        note = await service.create_note(session, user_id, data)
        await publish_note_event("note.created", note, request.app.state.config)
        return note
    except NotFoundError as e:
        _handle_not_found(e)


@router.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.get_note(session, user_id, note_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: UUID,
    data: NoteUpdate,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        note = await service.update_note(session, user_id, note_id, data)
        await publish_note_event("note.updated", note, request.app.state.config)
        return note
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/notes/{note_id}", status_code=204)
async def delete_note(
    note_id: UUID,
    request: Request,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        note = await service.get_note(session, user_id, note_id)
        await service.soft_delete_note(session, user_id, note_id)
        await publish_note_event("note.deleted", note, request.app.state.config)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/notes/{note_id}/permanent", status_code=204)
async def permanent_delete_note(
    note_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.permanent_delete_note(session, user_id, note_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.post("/notes/{note_id}/restore", response_model=NoteResponse)
async def restore_note(
    note_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.restore_note(session, user_id, note_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/notes/reorder", status_code=204)
async def reorder_notes(
    data: ReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.reorder_notes(session, user_id, data)


# --- Tags ---


@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_tags(session, user_id)


@router.post("/notes/{note_id}/tags", response_model=NoteResponse)
async def add_tag(
    note_id: UUID,
    data: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        note = await service.add_tag_to_note(session, user_id, note_id, data)
        # Fetch the tag to get its id for the event
        from pos_contracts.models import Tag
        from sqlalchemy import select
        tag_result = await session.execute(
            select(Tag).where(Tag.user_id == user_id, Tag.name == data.name)
        )
        tag = tag_result.scalar_one_or_none()
        if tag:
            await publish_tag_event("tag.added", tag, note_id=str(note_id))
        return note
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/notes/{note_id}/tags/{tag_id}", status_code=204)
async def remove_tag(
    note_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        # Fetch tag before removal so we can publish its identity
        from pos_contracts.models import Tag
        from sqlalchemy import select
        tag_result = await session.execute(
            select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
        )
        tag = tag_result.scalar_one_or_none()
        await service.remove_tag_from_note(session, user_id, note_id, tag_id)
        if tag:
            await publish_tag_event("tag.removed", tag, note_id=str(note_id))
    except NotFoundError as e:
        _handle_not_found(e)
