"""Attachment business logic — file upload, download, delete."""

import os
import uuid as uuid_mod
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .models import Attachment

# Base directory for file storage — relative to project root
STORAGE_BASE = Path(__file__).resolve().parents[3] / "data" / "attachments"


async def upload_file(
    session: AsyncSession, user_id: UUID, file: UploadFile
) -> Attachment:
    """Store an uploaded file on disk and create a database record."""
    user_dir = STORAGE_BASE / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    ext = Path(file.filename or "file").suffix
    storage_name = f"{uuid_mod.uuid4()}{ext}"
    storage_path = user_dir / storage_name

    # Read and write file
    content = await file.read()
    storage_path.write_bytes(content)

    attachment = Attachment(
        user_id=user_id,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        size=len(content),
        storage_path=str(storage_path),
    )
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)
    return attachment


async def get_attachment(
    session: AsyncSession, user_id: UUID, attachment_id: UUID
) -> Attachment:
    """Get a single attachment by ID, scoped to user."""
    result = await session.execute(
        select(Attachment).where(
            Attachment.id == attachment_id, Attachment.user_id == user_id
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise NotFoundError(f"Attachment {attachment_id} not found")
    return attachment


async def get_attachments_batch(
    session: AsyncSession, user_id: UUID, ids: list[UUID]
) -> list[Attachment]:
    """Get multiple attachments by IDs, scoped to user."""
    if not ids:
        return []
    result = await session.execute(
        select(Attachment).where(
            Attachment.id.in_(ids), Attachment.user_id == user_id
        )
    )
    return list(result.scalars().all())


async def delete_attachment(
    session: AsyncSession, user_id: UUID, attachment_id: UUID
) -> None:
    """Delete an attachment — removes DB record and file on disk."""
    attachment = await get_attachment(session, user_id, attachment_id)

    # Remove file from disk
    try:
        os.remove(attachment.storage_path)
    except OSError:
        pass  # File already gone

    await session.delete(attachment)
    await session.commit()


def get_file_path(attachment: Attachment) -> Path:
    """Get the filesystem path for an attachment."""
    return Path(attachment.storage_path)
