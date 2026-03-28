"""Holdings & aggregation API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_holdings as holdings_svc
from . import service_nav as nav_svc
from . import service_stock_prices as stock_price_svc
from . import service_portfolio as portfolio_svc
from .schemas import (
    FamilyAggregation,
    HolderAggregation,
    HoldingResponse,
    PortfolioHoldingsSummary,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


def get_app_secret(request: Request) -> str:
    return request.app.state.config.APP_SECRET_KEY


# ── Holdings ─────────────────────────────────────────────


@router.get("/portfolios/{portfolio_id}/holdings", response_model=PortfolioHoldingsSummary)
async def get_portfolio_holdings(
    portfolio_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get computed holdings for a portfolio."""
    portfolio = await portfolio_svc.get_portfolio(session, user_id, portfolio_id)
    summary = await holdings_svc.compute_portfolio_summary(session, user_id, portfolio_id)

    return PortfolioHoldingsSummary(
        portfolio_id=portfolio.id,
        portfolio_name=portfolio.name,
        holder_name=portfolio.holder_name,
        total_invested=summary["total_invested"],
        total_current_value=summary["total_current_value"],
        total_return=summary["total_return"],
        return_pct=summary["return_pct"],
        overall_xirr=summary["overall_xirr"],
        scheme_count=summary["scheme_count"],
        holdings=[HoldingResponse(**h) for h in summary["holdings"]],
    )


# ── NAV ──────────────────────────────────────────────────


@router.post("/nav/refresh")
async def refresh_nav(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Trigger manual NAV refresh from AMFI (only for held schemes)."""
    result = await nav_svc.fetch_nav_for_portfolio_schemes(session, user_id)
    return result


# ── Stock Prices ────────────────────────────────────────


@router.post("/stock-prices/refresh")
async def refresh_stock_prices(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Trigger manual stock price refresh (only for held stocks)."""
    result = await stock_price_svc.fetch_prices_for_portfolio_stocks(session, user_id)
    return result


# ── Aggregation ──────────────────────────────────────────


@router.get("/aggregation/family", response_model=FamilyAggregation)
async def get_family_aggregation(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Get family-level aggregation across all portfolios."""
    result = await holdings_svc.compute_family_aggregation(session, user_id)
    return FamilyAggregation(
        total_invested=result["total_invested"],
        total_current_value=result["total_current_value"],
        total_return=result["total_return"],
        return_pct=result["return_pct"],
        overall_xirr=result["overall_xirr"],
        holder_count=result["holder_count"],
        portfolio_count=result["portfolio_count"],
        holders=[HolderAggregation(**h) for h in result["holders"]],
    )
