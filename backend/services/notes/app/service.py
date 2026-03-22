"""Notes business logic — folders, notes, tags CRUD with user scoping."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError
from pos_contracts.logging import trace
from pos_contracts import tag_service
from pos_contracts.models import Tag, Taggable

from .models import Folder, Note
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
) -> list[dict]:
    """Get notes with optional filters. Non-deleted by default."""
    if tag is not None:
        tag_note_ids = await tag_service.get_entities_by_tag(session, user_id, "note", tag)
        if not tag_note_ids:
            return []

    stmt = (
        select(Note)
        .where(Note.user_id == user_id, Note.is_deleted.is_(is_deleted))
    )

    if folder_id is not None:
        stmt = stmt.where(Note.folder_id == folder_id)

    if is_pinned is not None:
        stmt = stmt.where(Note.is_pinned.is_(is_pinned))

    if tag is not None:
        stmt = stmt.where(Note.id.in_(tag_note_ids))

    if search:
        stmt = stmt.where(
            text("notes.search_vector @@ plainto_tsquery('english', :query)")
        ).params(query=search)
        stmt = stmt.order_by(
            text("ts_rank(notes.search_vector, plainto_tsquery('english', :query)) DESC")
        ).params(query=search)
    elif is_deleted:
        stmt = stmt.order_by(Note.deleted_at.desc())
    else:
        stmt = stmt.order_by(Note.is_pinned.desc(), Note.position)

    result = await session.execute(stmt)
    notes = list(result.scalars().all())

    # Fetch tags for all notes in one query
    if not notes:
        return []
    note_ids = [n.id for n in notes]
    tags_by_note = await _get_tags_for_notes(session, note_ids)

    return [
        {**_model_to_dict(n), "tags": tags_by_note.get(n.id, [])}
        for n in notes
    ]


@trace
async def create_note(
    session: AsyncSession, user_id: UUID, data: NoteCreate
) -> dict:
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
async def get_note(session: AsyncSession, user_id: UUID, note_id: UUID) -> dict:
    """Fetch note and enrich with tags from shared tag_service."""
    note = await _get_note_orm(session, user_id, note_id)
    tags = await tag_service.get_tags_for_entity(session, "note", note_id)
    return {
        **_model_to_dict(note),
        "tags": [_model_to_dict(t) for t in tags],
    }


@trace
async def update_note(
    session: AsyncSession, user_id: UUID, note_id: UUID, data: NoteUpdate
) -> dict:
    note = await _get_note_orm(session, user_id, note_id)
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
    note = await _get_note_orm(session, user_id, note_id)
    note.is_deleted = True
    note.deleted_at = datetime.now(timezone.utc)
    await session.commit()


@trace
async def restore_note(session: AsyncSession, user_id: UUID, note_id: UUID) -> dict:
    result = await session.execute(
        select(Note)
        .where(Note.id == note_id, Note.user_id == user_id, Note.is_deleted.is_(True))
    )
    note = result.scalar_one_or_none()
    if not note:
        raise NotFoundError(f"Deleted note {note_id} not found")
    note.is_deleted = False
    note.deleted_at = None
    await session.commit()
    return await get_note(session, user_id, note_id)


@trace
async def permanent_delete_note(
    session: AsyncSession, user_id: UUID, note_id: UUID
) -> None:
    note = await _get_note_orm(session, user_id, note_id)
    await session.delete(note)
    await session.commit()


@trace
async def empty_trash(session: AsyncSession, user_id: UUID) -> int:
    """Permanently delete all trashed notes for a user. Returns count deleted."""
    result = await session.execute(
        select(Note).where(Note.user_id == user_id, Note.is_deleted.is_(True))
    )
    notes = result.scalars().all()
    count = len(notes)
    for note in notes:
        await session.delete(note)
    await session.commit()
    return count


# --- Tags ---


async def get_tags(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all tags for user with note counts via shared tag_service."""
    all_tags = await tag_service.get_all_tags(session, user_id)
    return [
        {**t, "note_count": t["counts"].get("note", 0)}
        for t in all_tags
    ]


@trace
async def add_tag_to_note(
    session: AsyncSession, user_id: UUID, note_id: UUID, data: TagCreate
) -> dict:
    await _get_note_orm(session, user_id, note_id)  # verify note exists and is owned
    await tag_service.add_tag(session, user_id, "note", note_id, data.name)
    return await get_note(session, user_id, note_id)


@trace
async def remove_tag_from_note(
    session: AsyncSession, user_id: UUID, note_id: UUID, tag_id: UUID
) -> None:
    await _get_note_orm(session, user_id, note_id)  # verify note exists
    await tag_service.remove_tag(session, user_id, "note", note_id, tag_id)


# --- Helpers ---


async def _get_note_orm(session: AsyncSession, user_id: UUID, note_id: UUID) -> Note:
    """Fetch Note ORM object. Internal use only — does not include tags."""
    result = await session.execute(
        select(Note).where(Note.id == note_id, Note.user_id == user_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise NotFoundError(f"Note {note_id} not found")
    return note


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


async def _get_tags_for_notes(
    session: AsyncSession, note_ids: list[UUID]
) -> dict[UUID, list[dict]]:
    """Batch fetch tags for a list of notes. Returns {note_id: [tag_dicts]}."""
    if not note_ids:
        return {}
    result = await session.execute(
        select(Tag, Taggable.entity_id)
        .join(Taggable, Taggable.tag_id == Tag.id)
        .where(
            Taggable.entity_type == "note",
            Taggable.entity_id.in_(note_ids),
        )
    )
    tags_by_note: dict[UUID, list[dict]] = {}
    for tag, note_id in result.all():
        tags_by_note.setdefault(note_id, []).append(_model_to_dict(tag))
    return tags_by_note


def _model_to_dict(obj) -> dict:
    """Convert SQLAlchemy model to dict."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
