"""Statement import route."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from .models import StatementImport
from .schemas import ImportResponse, ImportSummary
from .service_import import import_statement

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.post("/accounts/{account_id}/import", response_model=ImportSummary)
async def import_file(
    account_id: UUID,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    file_bytes = await file.read()
    return await import_statement(session, user_id, account_id, file_bytes, file.filename)


@router.get("/imports", response_model=list[ImportResponse])
async def list_imports(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    account_id: UUID | None = None,
):
    q = (
        select(StatementImport)
        .where(StatementImport.user_id == user_id)
        .order_by(StatementImport.created_at.desc())
    )
    if account_id:
        q = q.where(StatementImport.account_id == account_id)
    result = await session.execute(q)
    return [ImportResponse.model_validate(i) for i in result.scalars().all()]
