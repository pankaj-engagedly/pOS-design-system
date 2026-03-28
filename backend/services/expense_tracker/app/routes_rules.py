"""Category rule CRUD routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pos_contracts.exceptions import NotFoundError

from .db import get_session as get_async_session
from .models import CategoryRule
from .schemas import RuleCreate, RuleResponse, RuleUpdate

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/rules", response_model=list[RuleResponse])
async def list_rules(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    from .models import Category
    result = await session.execute(
        select(CategoryRule)
        .options(joinedload(CategoryRule.category).joinedload(Category.parent))
        .where(CategoryRule.user_id == user_id)
        .order_by(CategoryRule.priority.desc(), CategoryRule.keyword)
    )
    rules = result.unique().scalars().all()
    return [
        RuleResponse(
            id=r.id, keyword=r.keyword, category_id=r.category_id,
            category_name=r.category.name if r.category else None,
            parent_category_name=r.category.parent.name if r.category and r.category.parent else None,
            priority=r.priority, source=r.source, created_at=r.created_at,
        )
        for r in rules
    ]


@router.post("/rules", response_model=RuleResponse, status_code=201)
async def create_rule(
    body: RuleCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    rule = CategoryRule(
        user_id=user_id, keyword=body.keyword.lower(),
        category_id=body.category_id, priority=body.priority,
        source="user_correction",
    )
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return RuleResponse(
        id=rule.id, keyword=rule.keyword, category_id=rule.category_id,
        priority=rule.priority, source=rule.source, created_at=rule.created_at,
    )


@router.patch("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: UUID,
    body: RuleUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id, CategoryRule.user_id == user_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundError("Rule not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(rule, k, v.lower() if k == "keyword" else v)
    await session.commit()
    await session.refresh(rule)
    return RuleResponse(
        id=rule.id, keyword=rule.keyword, category_id=rule.category_id,
        priority=rule.priority, source=rule.source, created_at=rule.created_at,
    )


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    result = await session.execute(
        select(CategoryRule).where(CategoryRule.id == rule_id, CategoryRule.user_id == user_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise NotFoundError("Rule not found")
    await session.delete(rule)
    await session.commit()
