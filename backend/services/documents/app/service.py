"""Documents business logic — folders, documents, sharing, recent access."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import relationship

from pos_contracts.exceptions import NotFoundError
from pos_contracts.logging import trace
from pos_contracts import tag_service
from pos_contracts.models import Tag, Taggable

from .models import DocFolder, Document, DocShare, DocRecentAccess
from .schemas import (
    DocumentCreate,
    DocumentUpdate,
    FolderCreate,
    FolderUpdate,
    ReorderRequest,
)

MAX_FOLDER_DEPTH = 5
MAX_RECENT_ACCESS = 50


# --- Folders ---


@trace
async def get_folders(
    session: AsyncSession, user_id: UUID, parent_id: UUID | None = None
) -> list[dict]:
    """Get folders for user at a given parent level (default root)."""
    stmt = select(DocFolder).where(
        DocFolder.user_id == user_id,
        DocFolder.parent_id == parent_id,
    ).order_by(DocFolder.position)
    result = await session.execute(stmt)
    folders = list(result.scalars().all())

    # Get child counts and document counts per folder
    child_counts = await _get_child_counts(session, user_id, [f.id for f in folders])
    doc_counts = await _get_document_counts(session, user_id, [f.id for f in folders])

    return [
        {
            **_model_to_dict(f),
            "child_count": child_counts.get(f.id, 0),
            "document_count": doc_counts.get(f.id, 0),
        }
        for f in folders
    ]


@trace
async def get_folder(session: AsyncSession, user_id: UUID, folder_id: UUID) -> dict:
    folder = await _get_folder_orm(session, user_id, folder_id)
    child_counts = await _get_child_counts(session, user_id, [folder_id])
    doc_counts = await _get_document_counts(session, user_id, [folder_id])
    return {
        **_model_to_dict(folder),
        "child_count": child_counts.get(folder_id, 0),
        "document_count": doc_counts.get(folder_id, 0),
    }


@trace
async def create_folder(
    session: AsyncSession, user_id: UUID, data: FolderCreate
) -> DocFolder:
    if data.parent_id:
        # Validate parent exists and check depth
        await _get_folder_orm(session, user_id, data.parent_id)
        depth = await _get_folder_depth(session, data.parent_id)
        if depth >= MAX_FOLDER_DEPTH:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Maximum folder depth of {MAX_FOLDER_DEPTH} exceeded",
            )

    result = await session.execute(
        select(func.coalesce(func.max(DocFolder.position), -1))
        .where(DocFolder.user_id == user_id, DocFolder.parent_id == data.parent_id)
    )
    max_pos = result.scalar() or -1

    folder = DocFolder(
        user_id=user_id,
        name=data.name,
        parent_id=data.parent_id,
        position=max_pos + 1,
    )
    session.add(folder)
    await session.commit()
    await session.refresh(folder)
    return folder


@trace
async def update_folder(
    session: AsyncSession, user_id: UUID, folder_id: UUID, data: FolderUpdate
) -> DocFolder:
    folder = await _get_folder_orm(session, user_id, folder_id)
    updates = data.model_dump(exclude_unset=True)
    if "parent_id" in updates and updates["parent_id"] != folder.parent_id:
        if updates["parent_id"]:
            depth = await _get_folder_depth(session, updates["parent_id"])
            if depth >= MAX_FOLDER_DEPTH:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=400,
                    detail=f"Maximum folder depth of {MAX_FOLDER_DEPTH} exceeded",
                )
    for key, value in updates.items():
        setattr(folder, key, value)
    await session.commit()
    await session.refresh(folder)
    return folder


@trace
async def delete_folder(session: AsyncSession, user_id: UUID, folder_id: UUID) -> None:
    folder = await _get_folder_orm(session, user_id, folder_id)
    await session.delete(folder)
    await session.commit()


async def reorder_folders(
    session: AsyncSession, user_id: UUID, data: ReorderRequest
) -> None:
    for idx, folder_id in enumerate(data.ordered_ids):
        result = await session.execute(
            select(DocFolder).where(
                DocFolder.id == folder_id, DocFolder.user_id == user_id
            )
        )
        folder = result.scalar_one_or_none()
        if folder:
            folder.position = idx
    await session.commit()


# --- Documents ---


@trace
async def create_document(
    session: AsyncSession, user_id: UUID, data: DocumentCreate
) -> dict:
    if data.folder_id:
        await _get_folder_orm(session, user_id, data.folder_id)

    doc = Document(
        user_id=user_id,
        name=data.name,
        description=data.description,
        attachment_id=data.attachment_id,
        file_size=data.file_size,
        content_type=data.content_type,
        folder_id=data.folder_id,
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return await _doc_with_tags(session, doc)


@trace
async def get_document(
    session: AsyncSession,
    user_id: UUID,
    document_id: UUID,
    allow_shared: bool = False,
) -> dict:
    doc = await _get_doc_orm(session, user_id, document_id, allow_shared=allow_shared)
    return await _doc_with_tags(session, doc)


@trace
async def get_documents(
    session: AsyncSession,
    user_id: UUID,
    folder_id: UUID | None = None,
    tag: str | None = None,
) -> list[dict]:
    """Get documents with optional folder/tag filters.
    Also includes documents shared with the user.
    """
    if tag is not None:
        tag_doc_ids = await tag_service.get_entities_by_tag(session, user_id, "document", tag)
        if not tag_doc_ids:
            return []

    stmt = select(Document).where(Document.user_id == user_id)

    if folder_id is not None:
        stmt = stmt.where(Document.folder_id == folder_id)

    if tag is not None:
        stmt = stmt.where(Document.id.in_(tag_doc_ids))

    stmt = stmt.order_by(Document.updated_at.desc())
    result = await session.execute(stmt)
    docs = list(result.scalars().all())

    if not docs:
        return []

    doc_ids = [d.id for d in docs]
    tags_by_doc = await _get_tags_for_docs(session, doc_ids)

    return [
        {**_model_to_dict(d), "tags": tags_by_doc.get(d.id, [])}
        for d in docs
    ]


@trace
async def update_document(
    session: AsyncSession, user_id: UUID, document_id: UUID, data: DocumentUpdate
) -> dict:
    doc = await _get_doc_orm(session, user_id, document_id)
    if data.folder_id is not None:
        await _get_folder_orm(session, user_id, data.folder_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(doc, key, value)
    await session.commit()
    return await _doc_with_tags(session, doc)


@trace
async def delete_document(
    session: AsyncSession, user_id: UUID, document_id: UUID
) -> dict:
    """Delete a document and return its data (including attachment_id for caller cleanup)."""
    doc = await _get_doc_orm(session, user_id, document_id)
    doc_data = _model_to_dict(doc)
    await session.delete(doc)
    await session.commit()
    return doc_data


# --- Document tagging (via shared tag_service) ---


@trace
async def add_tag_to_document(
    session: AsyncSession, user_id: UUID, document_id: UUID, tag_name: str
) -> tuple:
    """Add a tag to a document. Returns (tag, document_dict)."""
    await _get_doc_orm(session, user_id, document_id)
    tag = await tag_service.add_tag(session, user_id, "document", document_id, tag_name)
    doc = await get_document(session, user_id, document_id)
    return tag, doc


@trace
async def remove_tag_from_document(
    session: AsyncSession, user_id: UUID, document_id: UUID, tag_id: UUID
) -> None:
    await _get_doc_orm(session, user_id, document_id)
    await tag_service.remove_tag(session, user_id, "document", document_id, tag_id)


async def get_document_tags(session: AsyncSession, user_id: UUID) -> list[dict]:
    """Get all tags for user with document counts."""
    all_tags = await tag_service.get_all_tags(session, user_id)
    return [
        {**t, "document_count": t["counts"].get("document", 0)}
        for t in all_tags
    ]


# --- Sharing ---


@trace
async def create_share(
    session: AsyncSession,
    user_id: UUID,
    email: str,
    document_id: UUID | None = None,
    folder_id: UUID | None = None,
) -> DocShare:
    """Create a share by looking up the target user by email."""
    from pos_contracts.models import Base
    from sqlalchemy import text

    # Lookup user by email in the users table (auth service tables)
    user_result = await session.execute(
        text("SELECT id FROM users WHERE email = :email LIMIT 1"),
        {"email": email},
    )
    target_user = user_result.fetchone()
    if not target_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"No user found with email {email}")

    shared_with_user_id = target_user[0]

    if document_id:
        await _get_doc_orm(session, user_id, document_id)
    if folder_id:
        await _get_folder_orm(session, user_id, folder_id)

    share = DocShare(
        user_id=user_id,
        owner_user_id=user_id,
        shared_with_user_id=shared_with_user_id,
        document_id=document_id,
        folder_id=folder_id,
        permission="read",
    )
    session.add(share)
    await session.commit()
    await session.refresh(share)
    return share


@trace
async def list_my_shares(session: AsyncSession, user_id: UUID) -> list[DocShare]:
    result = await session.execute(
        select(DocShare).where(DocShare.owner_user_id == user_id)
        .order_by(DocShare.created_at.desc())
    )
    return list(result.scalars().all())


@trace
async def list_shared_with_me(session: AsyncSession, user_id: UUID) -> list[dict]:
    result = await session.execute(
        select(DocShare).where(DocShare.shared_with_user_id == user_id)
        .order_by(DocShare.created_at.desc())
    )
    shares = list(result.scalars().all())

    shared_items = []
    for share in shares:
        item = {
            "share_id": share.id,
            "shared_by_user_id": share.owner_user_id,
            "permission": share.permission,
            "document": None,
            "folder": None,
        }
        if share.document_id:
            doc_result = await session.execute(
                select(Document).where(Document.id == share.document_id)
            )
            doc = doc_result.scalar_one_or_none()
            if doc:
                item["document"] = await _doc_with_tags(session, doc)
        elif share.folder_id:
            folder_result = await session.execute(
                select(DocFolder).where(DocFolder.id == share.folder_id)
            )
            folder = folder_result.scalar_one_or_none()
            if folder:
                item["folder"] = _model_to_dict(folder)
        shared_items.append(item)
    return shared_items


@trace
async def revoke_share(
    session: AsyncSession, user_id: UUID, share_id: UUID
) -> None:
    result = await session.execute(
        select(DocShare).where(DocShare.id == share_id, DocShare.owner_user_id == user_id)
    )
    share = result.scalar_one_or_none()
    if not share:
        raise NotFoundError(f"Share {share_id} not found")
    await session.delete(share)
    await session.commit()


async def check_document_access(
    session: AsyncSession, user_id: UUID, document_id: UUID
) -> bool:
    """Return True if user owns the document OR has a share (direct or via folder)."""
    # Check ownership
    doc_result = await session.execute(
        select(Document).where(Document.id == document_id, Document.user_id == user_id)
    )
    if doc_result.scalar_one_or_none():
        return True

    # Check direct document share
    share_result = await session.execute(
        select(DocShare).where(
            DocShare.document_id == document_id,
            DocShare.shared_with_user_id == user_id,
        )
    )
    if share_result.scalar_one_or_none():
        return True

    # Check folder share (walk up folder tree)
    doc_result = await session.execute(
        select(Document).where(Document.id == document_id)
    )
    doc = doc_result.scalar_one_or_none()
    if not doc or not doc.folder_id:
        return False

    folder_id = doc.folder_id
    visited = set()
    while folder_id and folder_id not in visited:
        visited.add(folder_id)
        folder_share_result = await session.execute(
            select(DocShare).where(
                DocShare.folder_id == folder_id,
                DocShare.shared_with_user_id == user_id,
            )
        )
        if folder_share_result.scalar_one_or_none():
            return True
        # Walk up
        folder_result = await session.execute(
            select(DocFolder.parent_id).where(DocFolder.id == folder_id)
        )
        row = folder_result.fetchone()
        folder_id = row[0] if row else None

    return False


# --- Recent access ---


@trace
async def record_access(
    session: AsyncSession, user_id: UUID, document_id: UUID
) -> None:
    """Upsert recent access record and prune to MAX_RECENT_ACCESS per user."""
    # Delete existing entry for this doc (upsert pattern)
    await session.execute(
        delete(DocRecentAccess).where(
            DocRecentAccess.user_id == user_id,
            DocRecentAccess.document_id == document_id,
        )
    )

    entry = DocRecentAccess(
        user_id=user_id,
        document_id=document_id,
        accessed_at=datetime.now(timezone.utc),
    )
    session.add(entry)
    await session.flush()

    # Prune to MAX_RECENT_ACCESS — delete oldest beyond the limit
    count_result = await session.execute(
        select(func.count(DocRecentAccess.id)).where(DocRecentAccess.user_id == user_id)
    )
    count = count_result.scalar() or 0

    if count > MAX_RECENT_ACCESS:
        # Get IDs of oldest entries to delete
        oldest_result = await session.execute(
            select(DocRecentAccess.id)
            .where(DocRecentAccess.user_id == user_id)
            .order_by(DocRecentAccess.accessed_at.asc())
            .limit(count - MAX_RECENT_ACCESS)
        )
        oldest_ids = [row[0] for row in oldest_result.all()]
        await session.execute(
            delete(DocRecentAccess).where(DocRecentAccess.id.in_(oldest_ids))
        )

    await session.commit()


@trace
async def get_recent_documents(
    session: AsyncSession, user_id: UUID, limit: int = 20
) -> list[dict]:
    result = await session.execute(
        select(DocRecentAccess, Document)
        .join(Document, Document.id == DocRecentAccess.document_id)
        .where(DocRecentAccess.user_id == user_id)
        .order_by(DocRecentAccess.accessed_at.desc())
        .limit(limit)
    )
    rows = result.all()

    if not rows:
        return []

    doc_ids = [row[1].id for row in rows]
    tags_by_doc = await _get_tags_for_docs(session, doc_ids)

    return [
        {
            "document": {**_model_to_dict(doc), "tags": tags_by_doc.get(doc.id, [])},
            "accessed_at": access.accessed_at,
        }
        for access, doc in rows
    ]


# --- Helpers ---


async def _get_folder_orm(
    session: AsyncSession, user_id: UUID, folder_id: UUID
) -> DocFolder:
    result = await session.execute(
        select(DocFolder).where(
            DocFolder.id == folder_id, DocFolder.user_id == user_id
        )
    )
    folder = result.scalar_one_or_none()
    if not folder:
        raise NotFoundError(f"Folder {folder_id} not found")
    return folder


async def _get_doc_orm(
    session: AsyncSession,
    user_id: UUID,
    document_id: UUID,
    allow_shared: bool = False,
) -> Document:
    result = await session.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user_id
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        if allow_shared and await check_document_access(session, user_id, document_id):
            result = await session.execute(
                select(Document).where(Document.id == document_id)
            )
            doc = result.scalar_one_or_none()
        if not doc:
            raise NotFoundError(f"Document {document_id} not found")
    return doc


async def _doc_with_tags(session: AsyncSession, doc: Document) -> dict:
    tags = await tag_service.get_tags_for_entity(session, "document", doc.id)
    return {
        **_model_to_dict(doc),
        "tags": [_model_to_dict(t) for t in tags],
    }


async def _get_tags_for_docs(
    session: AsyncSession, doc_ids: list[UUID]
) -> dict[UUID, list[dict]]:
    """Batch fetch tags for a list of documents."""
    if not doc_ids:
        return {}
    result = await session.execute(
        select(Tag, Taggable.entity_id)
        .join(Taggable, Taggable.tag_id == Tag.id)
        .where(
            Taggable.entity_type == "document",
            Taggable.entity_id.in_(doc_ids),
        )
    )
    tags_by_doc: dict[UUID, list[dict]] = {}
    for tag, doc_id in result.all():
        tags_by_doc.setdefault(doc_id, []).append(_model_to_dict(tag))
    return tags_by_doc


async def _get_folder_depth(session: AsyncSession, folder_id: UUID) -> int:
    """Walk parent_id chain to calculate depth (0 = root)."""
    depth = 0
    visited = set()
    current_id = folder_id
    while current_id and current_id not in visited:
        visited.add(current_id)
        result = await session.execute(
            select(DocFolder.parent_id).where(DocFolder.id == current_id)
        )
        row = result.fetchone()
        if not row or row[0] is None:
            break
        current_id = row[0]
        depth += 1
    return depth


async def _get_child_counts(
    session: AsyncSession, user_id: UUID, folder_ids: list[UUID]
) -> dict[UUID, int]:
    if not folder_ids:
        return {}
    result = await session.execute(
        select(DocFolder.parent_id, func.count(DocFolder.id))
        .where(DocFolder.user_id == user_id, DocFolder.parent_id.in_(folder_ids))
        .group_by(DocFolder.parent_id)
    )
    return {row[0]: row[1] for row in result.all()}


async def _get_document_counts(
    session: AsyncSession, user_id: UUID, folder_ids: list[UUID]
) -> dict[UUID, int]:
    if not folder_ids:
        return {}
    result = await session.execute(
        select(Document.folder_id, func.count(Document.id))
        .where(Document.user_id == user_id, Document.folder_id.in_(folder_ids))
        .group_by(Document.folder_id)
    )
    return {row[0]: row[1] for row in result.all()}


def _model_to_dict(obj) -> dict:
    """Convert SQLAlchemy model to dict."""
    return {c.name: getattr(obj, c.name) for c in obj.__table__.columns}
