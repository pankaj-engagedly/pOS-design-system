"""Portfolio CRUD API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.tag_service import add_tag, get_all_tags, get_tags_for_entity, remove_tag

from .db import get_session as get_async_session
from . import service_portfolio as svc
from .schemas import (
    PortfolioCreate,
    PortfolioResponse,
    PortfolioSummary,
    PortfolioUpdate,
    TagCreate,
    TagInfo,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def get_app_secret(request: Request) -> str:
    return request.app.state.config.APP_SECRET_KEY


# ── Portfolio CRUD ───────────────────────────────────────


@router.get("/portfolios", response_model=list[PortfolioSummary])
async def list_portfolios(
    user_id: UUID = Depends(get_user_id),
    app_secret: str = Depends(get_app_secret),
    session: AsyncSession = Depends(get_async_session),
):
    portfolios = await svc.list_portfolios(session, user_id)
    result = []
    for p in portfolios:
        pan_masked = svc.get_pan_masked(p, app_secret, user_id)
        result.append(PortfolioSummary(
            id=p.id,
            name=p.name,
            holder_name=p.holder_name,
            pan_masked=pan_masked,
            email=p.email,
        ))
    return result


@router.post("/portfolios", response_model=PortfolioResponse, status_code=201)
async def create_portfolio(
    body: PortfolioCreate,
    user_id: UUID = Depends(get_user_id),
    app_secret: str = Depends(get_app_secret),
    session: AsyncSession = Depends(get_async_session),
):
    portfolio = await svc.create_portfolio(
        session, user_id, app_secret,
        name=body.name,
        holder_name=body.holder_name,
        pan=body.pan,
        email=body.email,
        description=body.description,
    )
    pan_masked = svc.get_pan_masked(portfolio, app_secret, user_id)
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        holder_name=portfolio.holder_name,
        pan_masked=pan_masked,
        email=portfolio.email,
        description=portfolio.description,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
    )


@router.get("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(
    portfolio_id: UUID,
    user_id: UUID = Depends(get_user_id),
    app_secret: str = Depends(get_app_secret),
    session: AsyncSession = Depends(get_async_session),
):
    portfolio = await svc.get_portfolio(session, user_id, portfolio_id)
    pan_masked = svc.get_pan_masked(portfolio, app_secret, user_id)
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        holder_name=portfolio.holder_name,
        pan_masked=pan_masked,
        email=portfolio.email,
        description=portfolio.description,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
    )


@router.patch("/portfolios/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(
    portfolio_id: UUID,
    body: PortfolioUpdate,
    user_id: UUID = Depends(get_user_id),
    app_secret: str = Depends(get_app_secret),
    session: AsyncSession = Depends(get_async_session),
):
    portfolio = await svc.update_portfolio(
        session, user_id, portfolio_id, app_secret,
        **body.model_dump(exclude_unset=True),
    )
    pan_masked = svc.get_pan_masked(portfolio, app_secret, user_id)
    return PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        holder_name=portfolio.holder_name,
        pan_masked=pan_masked,
        email=portfolio.email,
        description=portfolio.description,
        created_at=portfolio.created_at,
        updated_at=portfolio.updated_at,
    )


@router.delete("/portfolios/{portfolio_id}", status_code=204)
async def delete_portfolio(
    portfolio_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_portfolio(session, user_id, portfolio_id)


# ── Tags ─────────────────────────────────────────────────


@router.get("/portfolios/{portfolio_id}/tags", response_model=list[TagInfo])
async def list_portfolio_tags(
    portfolio_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.get_portfolio(session, user_id, portfolio_id)
    tags = await get_tags_for_entity(session, "portfolio", portfolio_id)
    return [TagInfo(id=t.id, name=t.name) for t in tags]


@router.post("/portfolios/{portfolio_id}/tags", response_model=TagInfo, status_code=201)
async def add_portfolio_tag(
    portfolio_id: UUID,
    body: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.get_portfolio(session, user_id, portfolio_id)
    tag = await add_tag(session, user_id, "portfolio", portfolio_id, body.name)
    return TagInfo(id=tag.id, name=tag.name)


@router.delete("/portfolios/{portfolio_id}/tags/{tag_id}", status_code=204)
async def remove_portfolio_tag(
    portfolio_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.get_portfolio(session, user_id, portfolio_id)
    await remove_tag(session, user_id, "portfolio", portfolio_id, tag_id)


# ── Transactions ─────────────────────────────────────────


@router.get("/portfolios/{portfolio_id}/transactions", response_model=list)
async def list_transactions(
    portfolio_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    scheme_isin: str | None = None,
    transaction_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
):
    from datetime import date as date_type
    from sqlalchemy import select
    from .models import Transaction

    await svc.get_portfolio(session, user_id, portfolio_id)

    q = (
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio_id, Transaction.user_id == user_id)
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
    )
    if scheme_isin:
        q = q.where(Transaction.scheme_isin == scheme_isin)
    if transaction_type:
        q = q.where(Transaction.transaction_type == transaction_type)
    if date_from:
        q = q.where(Transaction.transaction_date >= date_type.fromisoformat(date_from))
    if date_to:
        q = q.where(Transaction.transaction_date <= date_type.fromisoformat(date_to))

    result = await session.execute(q)
    txns = result.scalars().all()

    from .schemas import TransactionResponse
    return [TransactionResponse.model_validate(t) for t in txns]
