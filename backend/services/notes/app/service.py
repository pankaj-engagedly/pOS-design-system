"""Notes business logic — folders, notes, tags CRUD with user scoping."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError
from pos_contracts.logging import trace

from .models import Folder, Note, Tag, note_tags
from .schemas import (
    FolderCreate,
    FolderUpdate,
    NoteCreate,
    NoteUpdate,
    ReorderRequest,
    TagCreate,
)
from .utils import extract_preview_text


# --- Folders ---


@trace
async def get_folders(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all folders for user, ordered by position, with note counts."""
    result = await session.execute(
        select(Folder).where(Folder.user_id == user_id).order_by(Folder.position)
    )
    folders = list(result.scalars().all())

    # Get note counts per folder (non-deleted only)
    count_result = await session.execute(
        select(Note.folder_id, func.count(Note.id))
        .where(Note.user_id == user_id, Note.is_deleted.is_(False))
        .group_by(Note.folder_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    return [
        {**_model_to_dict(f), "note_count": counts.get(f.id, 0)}
        for f in folders
    ]


@trace
async def create_folder(
    session: AsyncSession, user_id: UUID, data: FolderCreate
) -> Folder:
    result = await session.execute(
        select(func.coalesce(func.max(Folder.position), -1))
        .where(Folder.user_id == user_id)
    )
    max_pos = result.scalar() or -1
    folder = Folder(user_id=user_id, name=data.name, position=max_pos + 1)
    session.add(folder)
    await session.commit()
    await session.refresh(folder)
    return folder


@trace
async def update_folder(
    session: AsyncSession, user_id: UUID, folder_id: UUID, data: FolderUpdate
) -> Folder:
    folder = await _get_folder(session, user_id, folder_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(folder, key, value)
    await session.commit()
    await session.refresh(folder)
    return folder


@trace
async def delete_folder(session: AsyncSession, user_id: UUID, folder_id: UUID) -> None:
    folder = await _get_folder(session, user_id, folder_id)
    # Nullify folder_id on owned notes
    result = await session.execute(
        select(Note).where(Note.user_id == user_id, Note.folder_id == folder_id)
    )
    for note in result.scalars().all():
        note.folder_id = None
    await session.delete(folder)
    await session.commit()


async def reorder_folders(
    session: AsyncSession, user_id: UUID, data: ReorderRequest
) -> None:
    for idx, folder_id in enumerate(data.ordered_ids):
        result = await session.execute(
            select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
        )
        folder = result.scalar_one_or_none()
        if folder:
            folder.position = idx
    await session.commit()


# --- Notes ---


@trace
async def get_notes(
    session: AsyncSession,
    user_id: UUID,
    folder_id: UUID | None = None,
    tag: str | None = None,
    is_pinned: bool | None = None,
    is_deleted: bool = False,
    search: str | None = None,
) -> list[Note]:
    """Get notes with optional filters. Non-deleted by default."""
    stmt = (
        select(Note)
        .options(selectinload(Note.tags))
        .where(Note.user_id == user_id, Note.is_deleted.is_(is_deleted))
    )

    if folder_id is not None:
        stmt = stmt.where(Note.folder_id == folder_id)

    if is_pinned is not None:
        stmt = stmt.where(Note.is_pinned.is_(is_pinned))

    if tag is not None:
        stmt = stmt.join(Note.tags).where(Tag.name == tag)

    if search:
        # Full-text search using generated search_vector column
        stmt = stmt.where(
            text("notes.search_vector @@ plainto_tsquery('english', :query)")
        ).params(query=search)
        # Order by relevance for search, else pinned first then position
        stmt = stmt.order_by(
            text("ts_rank(notes.search_vector, plainto_tsquery('english', :query)) DESC")
        ).params(query=search)
    elif is_deleted:
        stmt = stmt.order_by(Note.deleted_at.desc())
    else:
        stmt = stmt.order_by(Note.is_pinned.desc(), Note.position)

    result = await session.execute(stmt)
    return list(result.scalars().all())


@trace
async def create_note(
    session: AsyncSession, user_id: UUID, data: NoteCreate
) -> Note:
    if data.folder_id:
        await _get_folder(session, user_id, data.folder_id)

    result = await session.execute(
        select(func.coalesce(func.max(Note.position), -1))
        .where(Note.user_id == user_id, Note.is_deleted.is_(False))
    )
    max_pos = result.scalar() or -1

    preview = extract_preview_text(data.content)
    note = Note(
        user_id=user_id,
        title=data.title,
        content=data.content,
        preview_text=preview,
        folder_id=data.folder_id,
        color=data.color,
        is_pinned=data.is_pinned,
        position=max_pos + 1,
    )
    session.add(note)
    await session.commit()
    return await get_note(session, user_id, note.id)


@trace
async def get_note(session: AsyncSession, user_id: UUID, note_id: UUID) -> Note:
    result = await session.execute(
        select(Note)
        .options(selectinload(Note.tags))
        .where(Note.id == note_id, Note.user_id == user_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise NotFoundError(f"Note {note_id} not found")
    return note


@trace
async def update_note(
    session: AsyncSession, user_id: UUID, note_id: UUID, data: NoteUpdate
) -> Note:
    note = await get_note(session, user_id, note_id)
    updates = data.model_dump(exclude_unset=True)

    # Re-extract preview if content changed
    if "content" in updates:
        updates["preview_text"] = extract_preview_text(updates["content"])

    for key, value in updates.items():
        setattr(note, key, value)

    await session.commit()
    return await get_note(session, user_id, note_id)


async def reorder_notes(
    session: AsyncSession, user_id: UUID, data: ReorderRequest
) -> None:
    for idx, note_id in enumerate(data.ordered_ids):
        result = await session.execute(
            select(Note).where(Note.id == note_id, Note.user_id == user_id)
        )
        note = result.scalar_one_or_none()
        if note:
            note.position = idx
    await session.commit()


@trace
async def soft_delete_note(
    session: AsyncSession, user_id: UUID, note_id: UUID
) -> None:
    note = await get_note(session, user_id, note_id)
    note.is_deleted = True
    note.deleted_at = datetime.now(timezone.utc)
    await session.commit()


@trace
async def restore_note(session: AsyncSession, user_id: UUID, note_id: UUID) -> Note:
    result = await session.execute(
        select(Note)
        .options(selectinload(Note.tags))
        .where(Note.id == note_id, Note.user_id == user_id, Note.is_deleted.is_(True))
    )
    note = result.scalar_one_or_none()
    if not note:
        raise NotFoundError(f"Deleted note {note_id} not found")
    note.is_deleted = False
    note.deleted_at = None
    await session.commit()
    await session.refresh(note)
    return note


@trace
async def permanent_delete_note(
    session: AsyncSession, user_id: UUID, note_id: UUID
) -> None:
    result = await session.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise NotFoundError(f"Note {note_id} not found")
    await session.delete(note)
    await session.commit()


# --- Tags ---


async def get_tags(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all tags for user with note counts."""
    result = await session.execute(
        select(Tag).where(Tag.user_id == user_id).order_by(Tag.name)
    )
    tags = list(result.scalars().all())

    # Count non-deleted notes per tag
    count_result = await session.execute(
        select(note_tags.c.tag_id, func.count(note_tags.c.note_id))
        .join(Note, Note.id == note_tags.c.note_id)
        .where(Note.user_id == user_id, Note.is_deleted.is_(False))
        .group_by(note_tags.c.tag_id)
    )
    counts = {row[0]: row[1] for row in count_result.all()}

    return [
        {**_model_to_dict(t), "note_count": counts.get(t.id, 0)}
        for t in tags
    ]


@trace
async def add_tag_to_note(
    session: AsyncSession, user_id: UUID, note_id: UUID, data: TagCreate
) -> Note:
    note = await get_note(session, user_id, note_id)

    # Get or create tag
    result = await session.execute(
        select(Tag).where(Tag.user_id == user_id, Tag.name == data.name)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        tag = Tag(user_id=user_id, name=data.name)
        session.add(tag)
        await session.flush()

    if tag not in note.tags:
        note.tags.append(tag)

    await session.commit()
    return await get_note(session, user_id, note_id)


@trace
async def remove_tag_from_note(
    session: AsyncSession, user_id: UUID, note_id: UUID, tag_id: UUID
) -> None:
    note = await get_note(session, user_id, note_id)

    result = await session.execute(
        select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
    )
    tag = result.scalar_one_or_none()
    if not tag:
        raise NotFoundError(f"Tag {tag_id} not found")

    if tag in note.tags:
        note.tags.remove(tag)
    await session.commit()


# --- Helpers ---


async def _get_folder(
    session: AsyncSession, user_id: UUID, folder_id: UUID
) -> Folder:
    result = await session.execute(
        select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise NotFoundError(f"Folder {folder_id} not found")
    return folder


def _model_to_dict(obj) -> dict:
    """Convert SQLAlchemy model to dict."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
