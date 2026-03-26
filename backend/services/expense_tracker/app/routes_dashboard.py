"""Dashboard aggregation routes."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from .models import Account, Category, Transaction
from .schemas import CategoryBreakdown, DashboardSummary, MonthlyTrend, OwnerSplit

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    month: str | None = None,  # "2026-03"
):
    today = date.today()
    if month:
        year, mo = int(month[:4]), int(month[5:])
    else:
        year, mo = today.year, today.month

    # Current month totals (excluding transfers)
    spend = await _sum_for_month(session, user_id, year, mo, "debit")
    income = await _sum_for_month(session, user_id, year, mo, "credit")

    # Previous month
    if mo == 1:
        prev_year, prev_mo = year - 1, 12
    else:
        prev_year, prev_mo = year, mo - 1

    spend_prev = await _sum_for_month(session, user_id, prev_year, prev_mo, "debit")

    mom_pct = None
    if spend_prev and spend_prev > 0:
        mom_pct = float((spend - spend_prev) / spend_prev * 100)

    return DashboardSummary(
        total_spend=spend,
        total_income=income,
        net_savings=income - spend,
        spend_prev_month=spend_prev,
        mom_change_pct=mom_pct,
    )


@router.get("/dashboard/category-breakdown", response_model=list[CategoryBreakdown])
async def category_breakdown(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    month: str | None = None,
):
    today = date.today()
    if month:
        year, mo = int(month[:4]), int(month[5:])
    else:
        year, mo = today.year, today.month

    result = await session.execute(
        select(
            Transaction.category_id,
            func.coalesce(Category.name, "Uncategorized").label("cat_name"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.txn_type == "debit",
            Transaction.is_transfer == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == mo,
        )
        .group_by(Transaction.category_id, Category.name)
        .order_by(func.sum(Transaction.amount).desc())
    )

    rows = result.all()
    grand_total = sum(r.total for r in rows) if rows else Decimal("0")

    return [
        CategoryBreakdown(
            category_id=r.category_id,
            category_name=r.cat_name,
            total=r.total,
            percentage=float(r.total / grand_total * 100) if grand_total > 0 else 0,
            transaction_count=r.cnt,
        )
        for r in rows
    ]


@router.get("/dashboard/monthly-trend", response_model=list[MonthlyTrend])
async def monthly_trend(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    months: int = Query(12, le=24),
):
    today = date.today()
    start = date(today.year, today.month, 1) - timedelta(days=30 * months)

    result = await session.execute(
        select(
            func.to_char(Transaction.date, "YYYY-MM").label("month"),
            Transaction.txn_type,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.is_transfer == False,
            Transaction.date >= start,
        )
        .group_by(func.to_char(Transaction.date, "YYYY-MM"), Transaction.txn_type)
        .order_by(func.to_char(Transaction.date, "YYYY-MM"))
    )

    # Pivot into {month: {debit: x, credit: y}}
    monthly = {}
    for row in result.all():
        if row.month not in monthly:
            monthly[row.month] = {"debit": Decimal("0"), "credit": Decimal("0")}
        monthly[row.month][row.txn_type] = row.total

    return [
        MonthlyTrend(month=m, spend=d["debit"], income=d["credit"])
        for m, d in sorted(monthly.items())
    ]


@router.get("/dashboard/owner-split", response_model=list[OwnerSplit])
async def owner_split(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    month: str | None = None,
):
    today = date.today()
    if month:
        year, mo = int(month[:4]), int(month[5:])
    else:
        year, mo = today.year, today.month

    result = await session.execute(
        select(
            Account.owner_label,
            Transaction.txn_type,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.is_transfer == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == mo,
        )
        .group_by(Account.owner_label, Transaction.txn_type)
    )

    owners = {}
    for row in result.all():
        label = row.owner_label or "Unknown"
        if label not in owners:
            owners[label] = {"spend": Decimal("0"), "income": Decimal("0")}
        if row.txn_type == "debit":
            owners[label]["spend"] = row.total
        else:
            owners[label]["income"] = row.total

    return [
        OwnerSplit(owner_label=label, total_spend=d["spend"], total_income=d["income"])
        for label, d in sorted(owners.items())
    ]


async def _sum_for_month(
    session: AsyncSession, user_id: UUID, year: int, month: int, txn_type: str,
) -> Decimal:
    """Sum transaction amounts for a given month, excluding transfers and investment categories."""
    from sqlalchemy import or_

    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.txn_type == txn_type,
            Transaction.is_transfer == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            or_(
                Transaction.category_id.is_(None),
                ~Category.group_type.in_(["transfer", "investment"]),
            ),
        )
    )
    return result.scalar() or Decimal("0")
