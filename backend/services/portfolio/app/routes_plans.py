"""Investment plan API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_plans as plans_svc
from .schemas import (
    AllocationCreate,
    AllocationResponse,
    AllocationUpdate,
    DeploymentEventCreate,
    DeploymentEventResponse,
    PlanCreate,
    PlanHistoryResponse,
    PlanResponse,
    PlanSummary,
    PlanUpdate,
    RevisionEventResponse,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


# ── Plans ────────────────────────────────────────────────


@router.get("/plans", response_model=list[PlanSummary])
async def list_plans(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    status: str | None = Query(None),
):
    plans = await plans_svc.list_plans(session, user_id, status=status)
    return [PlanSummary(**plans_svc.compute_plan_summary(p)) for p in plans]


@router.post("/plans", response_model=PlanResponse, status_code=201)
async def create_plan(
    body: PlanCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    plan = await plans_svc.create_plan(
        session, user_id,
        name=body.name,
        total_corpus=body.total_corpus,
        start_date=body.start_date,
        end_date=body.end_date,
        notes=body.notes,
    )
    return PlanResponse.model_validate(plan)


@router.get("/plans/{plan_id}", response_model=PlanSummary)
async def get_plan(
    plan_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    plan = await plans_svc.get_plan(session, user_id, plan_id)
    return PlanSummary(**plans_svc.compute_plan_summary(plan))


@router.patch("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(
    plan_id: UUID,
    body: PlanUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    plan = await plans_svc.update_plan(
        session, user_id, plan_id,
        **body.model_dump(exclude_unset=True),
    )
    return PlanResponse.model_validate(plan)


@router.delete("/plans/{plan_id}", status_code=204)
async def delete_plan(
    plan_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await plans_svc.delete_plan(session, user_id, plan_id)


# ── Plan History ─────────────────────────────────────────


@router.get("/plans/{plan_id}/history", response_model=PlanHistoryResponse)
async def get_plan_history(
    plan_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    events = await plans_svc.get_plan_history(session, user_id, plan_id)
    return PlanHistoryResponse(plan_id=plan_id, events=events)


# ── Allocations ──────────────────────────────────────────


@router.get("/plans/{plan_id}/allocations", response_model=list[AllocationResponse])
async def list_allocations(
    plan_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    plan = await plans_svc.get_plan(session, user_id, plan_id)
    result = []
    for alloc in plan.allocations:
        summary = plans_svc.compute_allocation_summary(alloc)
        result.append(AllocationResponse(
            id=alloc.id,
            plan_id=alloc.plan_id,
            asset_identifier=alloc.asset_identifier,
            asset_name=alloc.asset_name,
            asset_type=alloc.asset_type,
            target_amount=alloc.target_amount,
            target_price=alloc.target_price,
            priority=alloc.priority,
            created_at=alloc.created_at,
            **summary,
        ))
    return result


@router.post("/plans/{plan_id}/allocations", response_model=AllocationResponse, status_code=201)
async def create_allocation(
    plan_id: UUID,
    body: AllocationCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    alloc = await plans_svc.create_allocation(
        session, user_id, plan_id,
        **body.model_dump(),
    )
    return AllocationResponse(
        id=alloc.id,
        plan_id=alloc.plan_id,
        asset_identifier=alloc.asset_identifier,
        asset_name=alloc.asset_name,
        asset_type=alloc.asset_type,
        target_amount=alloc.target_amount,
        target_price=alloc.target_price,
        priority=alloc.priority,
        created_at=alloc.created_at,
    )


@router.patch("/plans/{plan_id}/allocations/{allocation_id}", response_model=AllocationResponse)
async def update_allocation(
    plan_id: UUID,
    allocation_id: UUID,
    body: AllocationUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    alloc = await plans_svc.update_allocation(
        session, user_id, allocation_id, plan_id,
        **body.model_dump(exclude_unset=True),
    )
    summary = plans_svc.compute_allocation_summary(alloc)
    return AllocationResponse(
        id=alloc.id,
        plan_id=alloc.plan_id,
        asset_identifier=alloc.asset_identifier,
        asset_name=alloc.asset_name,
        asset_type=alloc.asset_type,
        target_amount=alloc.target_amount,
        target_price=alloc.target_price,
        priority=alloc.priority,
        created_at=alloc.created_at,
        **summary,
    )


@router.delete("/plans/{plan_id}/allocations/{allocation_id}", status_code=204)
async def delete_allocation(
    plan_id: UUID,
    allocation_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await plans_svc.delete_allocation(session, user_id, allocation_id)


# ── Deployment Events ────────────────────────────────────


@router.get("/allocations/{allocation_id}/deployments", response_model=list[DeploymentEventResponse])
async def list_deployments(
    allocation_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    events = await plans_svc.list_deployment_events(session, user_id, allocation_id)
    return [DeploymentEventResponse.model_validate(e) for e in events]


@router.post("/allocations/{allocation_id}/deployments", response_model=DeploymentEventResponse, status_code=201)
async def create_deployment(
    allocation_id: UUID,
    body: DeploymentEventCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    event = await plans_svc.create_deployment_event(
        session, user_id, allocation_id,
        **body.model_dump(),
    )
    return DeploymentEventResponse.model_validate(event)
