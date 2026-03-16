"""Documents API routes — folders, documents, tags, shares, recent."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError
from pos_contracts.models import Tag
from sqlalchemy import select

from .db import get_session as get_async_session
from . import service
from .events import (
    publish_doc_event,
    publish_folder_event,
    publish_share_event,
    publish_tag_event,
)
from .schemas import (
    DocumentCreate,
    DocumentResponse,
    DocumentUpdate,
    FolderCreate,
    FolderResponse,
    FolderUpdate,
    RecentDocumentResponse,
    ReorderRequest,
    ShareCreate,
    ShareResponse,
    SharedWithMeResponse,
    TagCreate,
    TagResponse,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def _handle_not_found(e: NotFoundError):
    raise HTTPException(status_code=404, detail=str(e))


# --- Folders ---


@router.get("/folders", response_model=list[FolderResponse])
async def list_folders(
    parent_id: UUID | None = None,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_folders(session, user_id, parent_id=parent_id)


@router.post("/folders", response_model=FolderResponse, status_code=201)
async def create_folder(
    data: FolderCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        folder = await service.create_folder(session, user_id, data)
        await publish_folder_event("doc.folder.created", folder)
        return await service.get_folder(session, user_id, folder.id)
    except NotFoundError as e:
        _handle_not_found(e)
    except Exception as e:
        if "uq_doc_folders_user_parent_name" in str(e):
            raise HTTPException(status_code=409, detail="Folder name already exists")
        raise


@router.get("/folders/{folder_id}", response_model=FolderResponse)
async def get_folder(
    folder_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        return await service.get_folder(session, user_id, folder_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/folders/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: UUID,
    data: FolderUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        folder = await service.update_folder(session, user_id, folder_id, data)
        await publish_folder_event("doc.folder.updated", folder)
        return await service.get_folder(session, user_id, folder_id)
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        folder_data = await service.get_folder(session, user_id, folder_id)
        await service.delete_folder(session, user_id, folder_id)
        # Publish with a plain object that has the fields
        class _FolderProxy:
            def __init__(self, d):
                for k, v in d.items():
                    setattr(self, k, v)
            __table__ = type("t", (), {"columns": []})()
        proxy = _FolderProxy(folder_data)
        await publish_folder_event("doc.folder.deleted", proxy)
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/folders/reorder", status_code=204)
async def reorder_folders(
    data: ReorderRequest,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await service.reorder_folders(session, user_id, data)


# --- Documents ---


@router.get("/documents", response_model=list[DocumentResponse])
async def list_documents(
    folder_id: UUID | None = None,
    tag: str | None = None,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_documents(session, user_id, folder_id=folder_id, tag=tag)


@router.post("/documents", response_model=DocumentResponse, status_code=201)
async def create_document(
    data: DocumentCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        doc = await service.create_document(session, user_id, data)
        # Record access on upload
        await service.record_access(session, user_id, doc["id"])
        # Publish event using dict proxy
        class _DocProxy:
            def __init__(self, d):
                for k, v in d.items():
                    setattr(self, k, v)
        proxy = _DocProxy(doc)
        await publish_doc_event("doc.document.uploaded", proxy)
        return doc
    except NotFoundError as e:
        _handle_not_found(e)


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        doc = await service.get_document(session, user_id, document_id, allow_shared=True)
        await service.record_access(session, user_id, document_id)
        return doc
    except NotFoundError as e:
        _handle_not_found(e)


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: UUID,
    data: DocumentUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        doc = await service.update_document(session, user_id, document_id, data)
        class _DocProxy:
            def __init__(self, d):
                for k, v in d.items():
                    setattr(self, k, v)
        proxy = _DocProxy(doc)
        await publish_doc_event("doc.document.updated", proxy)
        return doc
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        doc_data = await service.delete_document(session, user_id, document_id)
        class _DocProxy:
            def __init__(self, d):
                for k, v in d.items():
                    setattr(self, k, v)
        proxy = _DocProxy(doc_data)
        await publish_doc_event("doc.document.deleted", proxy)
    except NotFoundError as e:
        _handle_not_found(e)


# --- Document tagging ---


@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_document_tags(session, user_id)


@router.post("/documents/{document_id}/tags", response_model=DocumentResponse)
async def add_tag(
    document_id: UUID,
    data: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        tag, doc = await service.add_tag_to_document(session, user_id, document_id, data.name)
        await publish_tag_event("doc.tag.added", tag, document_id=str(document_id))
        return doc
    except NotFoundError as e:
        _handle_not_found(e)


@router.delete("/documents/{document_id}/tags/{tag_id}", status_code=204)
async def remove_tag(
    document_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        # Fetch tag before removal for event
        tag_result = await session.execute(
            select(Tag).where(Tag.id == tag_id, Tag.user_id == user_id)
        )
        tag = tag_result.scalar_one_or_none()
        await service.remove_tag_from_document(session, user_id, document_id, tag_id)
        if tag:
            await publish_tag_event("doc.tag.removed", tag, document_id=str(document_id))
    except NotFoundError as e:
        _handle_not_found(e)


# --- Sharing ---


@router.get("/shares", response_model=list[ShareResponse])
async def list_shares(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.list_my_shares(session, user_id)


@router.post("/shares", response_model=ShareResponse, status_code=201)
async def create_share(
    data: ShareCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        share = await service.create_share(
            session, user_id,
            email=data.email,
            document_id=data.document_id,
            folder_id=data.folder_id,
        )
        await publish_share_event("doc.share.created", share)
        return share
    except NotFoundError as e:
        _handle_not_found(e)


@router.get("/shared-with-me", response_model=list[SharedWithMeResponse])
async def shared_with_me(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.list_shared_with_me(session, user_id)


@router.delete("/shares/{share_id}", status_code=204)
async def revoke_share(
    share_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        await service.revoke_share(session, user_id, share_id)
    except NotFoundError as e:
        _handle_not_found(e)


# --- Recent access ---


@router.get("/recent", response_model=list[RecentDocumentResponse])
async def recent_documents(
    limit: int = 20,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await service.get_recent_documents(session, user_id, limit=min(limit, 50))
