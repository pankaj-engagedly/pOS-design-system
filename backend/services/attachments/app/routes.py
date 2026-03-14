"""Attachment API routes — upload, download, metadata, delete."""

from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from pos_common.database import get_async_session

from . import service
from .schemas import AttachmentResponse, BatchRequest

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    """Extract user_id from request state (set by auth middleware)."""
    return UUID(request.state.user_id)


@router.post("/upload", response_model=AttachmentResponse, status_code=201)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.upload_file(session, user_id, file)


@router.get("/{attachment_id}", response_model=AttachmentResponse)
async def get_metadata(
    attachment_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_attachment(session, user_id, attachment_id)


@router.get("/{attachment_id}/download")
async def download_file(
    attachment_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    attachment = await service.get_attachment(session, user_id, attachment_id)
    file_path = service.get_file_path(attachment)
    if not file_path.exists():
        return {"detail": "File not found on disk"}, 404
    return FileResponse(
        path=str(file_path),
        filename=attachment.filename,
        media_type=attachment.content_type,
    )


@router.post("/batch", response_model=list[AttachmentResponse])
async def batch_metadata(
    data: BatchRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_attachments_batch(session, user_id, data.ids)


@router.delete("/{attachment_id}", status_code=204)
async def delete_file(
    attachment_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.delete_attachment(session, user_id, attachment_id)
