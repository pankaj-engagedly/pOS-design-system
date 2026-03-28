"""Portfolio import API routes — CAS PDF and stock tradebook CSV/Excel."""

import os
import tempfile
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_cas_import as import_svc
from . import service_stock_import as stock_import_svc
from . import service_portfolio as portfolio_svc
from .schemas import CASImportResponse, ImportSummaryResponse

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.post("/portfolios/{portfolio_id}/import", response_model=ImportSummaryResponse)
async def import_cas_pdf(
    portfolio_id: UUID,
    file: UploadFile = File(...),
    password: str = Form(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Upload and import a CAMS/KFintech CAS PDF."""
    # Verify portfolio exists and belongs to user
    await portfolio_svc.get_portfolio(session, user_id, portfolio_id)

    # Save uploaded file to temp location
    suffix = os.path.splitext(file.filename or "cas.pdf")[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await import_svc.import_cas_pdf(
            session=session,
            user_id=user_id,
            portfolio_id=portfolio_id,
            file_path=tmp_path,
            password=password,
            original_filename=file.filename or "cas.pdf",
        )
        return ImportSummaryResponse(**result)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/portfolios/{portfolio_id}/import-stocks", response_model=ImportSummaryResponse)
async def import_stock_file(
    portfolio_id: UUID,
    file: UploadFile = File(...),
    broker: str = Form(None),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Upload and import a stock tradebook CSV or Excel file.

    Supported brokers: Zerodha, Sharekhan (auto-detected from headers if not specified).
    """
    await portfolio_svc.get_portfolio(session, user_id, portfolio_id)

    suffix = os.path.splitext(file.filename or "tradebook.csv")[1]
    if suffix.lower() not in (".csv", ".xlsx", ".xls", ".txt"):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unsupported file format: {suffix}. Use CSV or Excel.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await stock_import_svc.import_stock_file(
            session=session,
            user_id=user_id,
            portfolio_id=portfolio_id,
            file_path=tmp_path,
            original_filename=file.filename or "tradebook.csv",
            broker=broker,
        )
        return ImportSummaryResponse(**result)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.get("/portfolios/{portfolio_id}/imports", response_model=list[CASImportResponse])
async def list_imports(
    portfolio_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """List all CAS imports for a portfolio."""
    await portfolio_svc.get_portfolio(session, user_id, portfolio_id)
    imports = await import_svc.list_imports(session, user_id, portfolio_id)
    return [CASImportResponse.model_validate(i) for i in imports]
