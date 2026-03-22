"""Photo source API routes — CRUD + manual sync trigger."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_sources as svc
from .models import PhotoSource
from .schemas import PhotoSourceCreate, PhotoSourceResponse, PhotoSourceUpdate

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/providers")
async def list_providers(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
):
    """List available sync providers and their status."""
    try:
        from .service_sync_apple import is_apple_photos_available
        apple_available = is_apple_photos_available()
    except ImportError:
        apple_available = False

    # Check Google availability and connection
    from .main import config
    google_available = bool(config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET)
    google_entry = {"id": "google_photos", "name": "Google Photos", "available": google_available}

    if google_available:
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            result = await session.execute(
                select(PhotoSource).where(
                    PhotoSource.user_id == user_id,
                    PhotoSource.provider == "google_photos",
                    PhotoSource.is_active.is_(True),
                )
            )
            google_source = result.scalar_one_or_none()
            if google_source:
                google_email = (google_source.config or {}).get("google_email", "")
                google_entry["connected"] = True
                google_entry["email"] = google_email
            else:
                google_entry["connected"] = False

    return {
        "providers": [
            {"id": "folder", "name": "Folder", "available": True},
            {"id": "apple_photos", "name": "Apple Photos", "available": apple_available},
            google_entry,
        ]
    }


@router.get("", response_model=list[PhotoSourceResponse])
async def list_sources(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    sources = await svc.list_sources(session, str(user_id))
    return sources


@router.post("", response_model=PhotoSourceResponse, status_code=201)
async def create_source(
    body: PhotoSourceCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    try:
        source = await svc.create_source(
            session, str(user_id), body.provider, body.source_path, body.label
        )
    except ValueError as e:
        return JSONResponse(status_code=409, content={"detail": str(e)})
    return source


@router.get("/{source_id}", response_model=PhotoSourceResponse)
async def get_source(
    source_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.get_source(session, str(user_id), source_id)


@router.patch("/{source_id}", response_model=PhotoSourceResponse)
async def update_source(
    source_id: UUID,
    body: PhotoSourceUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await svc.update_source(
        session, str(user_id), source_id,
        label=body.label, is_active=body.is_active,
    )


@router.delete("/{source_id}", status_code=204)
async def delete_source(
    source_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    # Revoke Google token before deleting (best-effort)
    source = await svc.get_source(session, str(user_id), source_id)
    if source.provider == "google_photos" and source.config:
        try:
            from .google_oauth import revoke_token
            token = source.config.get("access_token", "")
            if token:
                await revoke_token(token)
        except Exception:
            pass  # best-effort
    await svc.delete_source(session, str(user_id), source_id)


@router.post("/{source_id}/sync", status_code=202)
async def trigger_sync(
    source_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    source = await svc.get_source(session, str(user_id), source_id)
    if source.sync_status == "syncing":
        return JSONResponse(
            status_code=409,
            content={"detail": "Sync already in progress"},
        )
    # Import here to avoid circular imports at module level
    from .scheduler import run_source_sync
    await run_source_sync(source_id=source.id, user_id=str(user_id))
    return {"detail": "Sync started"}
