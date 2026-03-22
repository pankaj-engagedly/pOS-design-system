"""Investment plan business logic — plans, allocations, deployment/revision events."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError

from .models import DeploymentEvent, InvestmentPlan, PlanAllocation, PlanRevisionEvent


# ── Plans CRUD ───────────────────────────────────────────


async def create_plan(session: AsyncSession, user_id: UUID, **kwargs) -> InvestmentPlan:
    plan = InvestmentPlan(user_id=user_id, **kwargs)
    session.add(plan)
    await session.commit()
    await session.refresh(plan)
    logger.info(f"Created investment plan '{plan.name}' for user {user_id}")
    return plan


async def list_plans(
    session: AsyncSession, user_id: UUID, status: str | None = None
) -> list[InvestmentPlan]:
    q = (
        select(InvestmentPlan)
        .where(InvestmentPlan.user_id == user_id)
        .options(selectinload(InvestmentPlan.allocations).selectinload(PlanAllocation.deployment_events))
        .order_by(InvestmentPlan.created_at.desc())
    )
    if status:
        q = q.where(InvestmentPlan.status == status)
    result = await session.execute(q)
    return list(result.scalars().all())


async def get_plan(session: AsyncSession, user_id: UUID, plan_id: UUID) -> InvestmentPlan:
    result = await session.execute(
        select(InvestmentPlan)
        .where(InvestmentPlan.id == plan_id, InvestmentPlan.user_id == user_id)
        .options(selectinload(InvestmentPlan.allocations).selectinload(PlanAllocation.deployment_events))
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise NotFoundError("Investment plan not found")
    return plan


async def update_plan(
    session: AsyncSession, user_id: UUID, plan_id: UUID, **kwargs
) -> InvestmentPlan:
    plan = await get_plan(session, user_id, plan_id)

    # Track corpus changes as revision events
    new_corpus = kwargs.get("total_corpus")
    if new_corpus is not None and new_corpus != plan.total_corpus:
        revision = PlanRevisionEvent(
            user_id=user_id,
            plan_id=plan_id,
            event_type="corpus_change",
            previous_value=str(plan.total_corpus),
            new_value=str(new_corpus),
            event_date=date.today(),
            notes=kwargs.pop("revision_notes", None),
        )
        session.add(revision)

    for k, v in kwargs.items():
        if v is not None and k != "revision_notes":
            setattr(plan, k, v)

    await session.commit()
    await session.refresh(plan)
    return plan


async def delete_plan(session: AsyncSession, user_id: UUID, plan_id: UUID) -> None:
    plan = await get_plan(session, user_id, plan_id)
    await session.delete(plan)
    await session.commit()
    logger.info(f"Deleted plan {plan_id}")


# ── Allocations CRUD ─────────────────────────────────────


async def create_allocation(
    session: AsyncSession, user_id: UUID, plan_id: UUID, **kwargs
) -> PlanAllocation:
    await get_plan(session, user_id, plan_id)
    allocation = PlanAllocation(user_id=user_id, plan_id=plan_id, **kwargs)
    session.add(allocation)
    await session.commit()
    await session.refresh(allocation)
    return allocation


async def get_allocation(
    session: AsyncSession, user_id: UUID, allocation_id: UUID
) -> PlanAllocation:
    result = await session.execute(
        select(PlanAllocation)
        .where(PlanAllocation.id == allocation_id, PlanAllocation.user_id == user_id)
        .options(selectinload(PlanAllocation.deployment_events))
    )
    allocation = result.scalar_one_or_none()
    if not allocation:
        raise NotFoundError("Allocation not found")
    return allocation


async def update_allocation(
    session: AsyncSession, user_id: UUID, allocation_id: UUID, plan_id: UUID, **kwargs
) -> PlanAllocation:
    allocation = await get_allocation(session, user_id, allocation_id)

    # Track target changes as revision events on the parent plan
    new_target = kwargs.get("target_amount")
    if new_target is not None and new_target != allocation.target_amount:
        revision = PlanRevisionEvent(
            user_id=user_id,
            plan_id=plan_id,
            event_type="allocation_change",
            previous_value=f"{allocation.asset_name}: {allocation.target_amount}",
            new_value=f"{allocation.asset_name}: {new_target}",
            event_date=date.today(),
        )
        session.add(revision)

    for k, v in kwargs.items():
        if v is not None:
            setattr(allocation, k, v)

    await session.commit()
    await session.refresh(allocation)
    return allocation


async def delete_allocation(
    session: AsyncSession, user_id: UUID, allocation_id: UUID
) -> None:
    allocation = await get_allocation(session, user_id, allocation_id)
    await session.delete(allocation)
    await session.commit()


# ── Deployment Events (immutable) ────────────────────────


async def create_deployment_event(
    session: AsyncSession, user_id: UUID, allocation_id: UUID, **kwargs
) -> DeploymentEvent:
    await get_allocation(session, user_id, allocation_id)
    event = DeploymentEvent(user_id=user_id, allocation_id=allocation_id, **kwargs)
    session.add(event)
    await session.commit()
    await session.refresh(event)
    return event


async def list_deployment_events(
    session: AsyncSession, user_id: UUID, allocation_id: UUID
) -> list[DeploymentEvent]:
    result = await session.execute(
        select(DeploymentEvent)
        .where(DeploymentEvent.allocation_id == allocation_id, DeploymentEvent.user_id == user_id)
        .order_by(DeploymentEvent.event_date)
    )
    return list(result.scalars().all())


# ── Plan Summary Computation ─────────────────────────────


def compute_plan_summary(plan: InvestmentPlan) -> dict:
    """Compute plan-level summary from loaded allocations and deployment events."""
    total_allocated = Decimal("0")
    total_deployed = Decimal("0")
    allocation_count = 0

    for alloc in plan.allocations:
        total_allocated += alloc.target_amount
        allocation_count += 1

        for event in alloc.deployment_events:
            total_deployed += event.amount

    remaining = plan.total_corpus - total_deployed
    deployment_pct = float(total_deployed / plan.total_corpus * 100) if plan.total_corpus > 0 else 0.0
    over_allocated = total_allocated > plan.total_corpus

    return {
        "id": plan.id,
        "name": plan.name,
        "total_corpus": plan.total_corpus,
        "total_allocated": total_allocated,
        "total_deployed": total_deployed,
        "remaining": remaining,
        "deployment_pct": deployment_pct,
        "over_allocated": over_allocated,
        "allocation_count": allocation_count,
        "status": plan.status,
        "start_date": plan.start_date,
        "end_date": plan.end_date,
    }


def compute_allocation_summary(allocation: PlanAllocation) -> dict:
    """Compute allocation-level summary with deployed/remaining."""
    deployed = sum(e.amount for e in allocation.deployment_events)
    remaining = allocation.target_amount - deployed
    deployment_pct = float(deployed / allocation.target_amount * 100) if allocation.target_amount > 0 else 0.0

    return {
        "deployed_amount": deployed,
        "remaining_amount": remaining,
        "deployment_count": len(allocation.deployment_events),
        "deployment_pct": deployment_pct,
    }


# ── Plan History ─────────────────────────────────────────


async def get_plan_history(
    session: AsyncSession, user_id: UUID, plan_id: UUID
) -> list[dict]:
    """Get chronological history of all events for a plan."""
    plan = await get_plan(session, user_id, plan_id)

    events = []

    # Revision events
    rev_result = await session.execute(
        select(PlanRevisionEvent)
        .where(PlanRevisionEvent.plan_id == plan_id, PlanRevisionEvent.user_id == user_id)
    )
    for rev in rev_result.scalars().all():
        events.append({
            "type": "revision",
            "id": str(rev.id),
            "event_date": rev.event_date.isoformat(),
            "event_type": rev.event_type,
            "previous_value": rev.previous_value,
            "new_value": rev.new_value,
            "notes": rev.notes,
            "created_at": rev.created_at.isoformat() if rev.created_at else None,
        })

    # Deployment events from all allocations
    for alloc in plan.allocations:
        for dep in alloc.deployment_events:
            events.append({
                "type": "deployment",
                "id": str(dep.id),
                "event_date": dep.event_date.isoformat(),
                "allocation_id": str(alloc.id),
                "asset_name": alloc.asset_name,
                "amount": str(dep.amount),
                "units": str(dep.units) if dep.units else None,
                "price_per_unit": str(dep.price_per_unit) if dep.price_per_unit else None,
                "notes": dep.notes,
                "created_at": dep.created_at.isoformat() if dep.created_at else None,
            })

    # Sort by event_date
    events.sort(key=lambda e: e["event_date"])
    return events
