"""Transaction routes — list, update, create (manual), delete."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.tag_service import add_tag, get_all_tags, get_tags_for_entity, remove_tag

from .db import get_session as get_async_session
from . import service_transactions as svc
from .schemas import (
    TagCreate, TagInfo, TransactionCreate, TransactionResponse, TransactionUpdate,
)

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/transactions", response_model=list[TransactionResponse])
async def list_transactions(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    account_id: UUID | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    is_transfer: bool | None = None,
    uncategorized_only: bool = False,
    owner_label: str | None = None,
    search: str | None = None,
    limit: int = Query(500, le=2000),
    offset: int = 0,
):
    txns = await svc.list_transactions(
        session, user_id,
        account_id=account_id, category_id=category_id,
        date_from=date_from, date_to=date_to,
        is_transfer=is_transfer, uncategorized_only=uncategorized_only,
        owner_label=owner_label, search=search,
        limit=limit, offset=offset,
    )
    return [_txn_response(t) for t in txns]


@router.post("/transactions", response_model=TransactionResponse, status_code=201)
async def create_transaction(
    body: TransactionCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    txn = await svc.create_transaction(session, user_id, **body.model_dump())
    return _txn_response(txn)


@router.patch("/transactions/{txn_id}", response_model=TransactionResponse)
async def update_transaction(
    txn_id: UUID,
    body: TransactionUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    txn = await svc.update_transaction(session, user_id, txn_id, **body.model_dump(exclude_unset=True))
    return _txn_response(txn)


@router.get("/transactions/{txn_id}/similar-uncategorized")
async def count_similar(
    txn_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """After category change, check how many similar uncategorized transactions exist."""
    return await svc.count_similar_uncategorized(session, user_id, txn_id)


@router.post("/transactions/batch-categorize")
async def batch_categorize(
    body: dict,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Apply a category to all uncategorized transactions matching a keyword."""
    keyword = body.get("keyword")
    category_id = body.get("category_id")
    if not keyword or not category_id:
        return {"updated": 0}
    count = await svc.apply_category_to_similar(session, user_id, keyword, UUID(category_id))
    return {"updated": count}


@router.post("/transactions/apply-rules")
async def apply_rules(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    """Re-apply all rules to uncategorized transactions."""
    count = await svc.apply_rules_to_uncategorized(session, user_id)
    return {"updated": count}


@router.delete("/transactions/{txn_id}", status_code=204)
async def delete_transaction(
    txn_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_transaction(session, user_id, txn_id)


# ── Tags ─────────────────────────────────────────────────


@router.get("/tags", response_model=list[dict])
async def list_tags(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    return await get_all_tags(session, user_id)


@router.get("/transactions/{txn_id}/tags", response_model=list[TagInfo])
async def list_txn_tags(
    txn_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.get_transaction(session, user_id, txn_id)
    tags = await get_tags_for_entity(session, "transaction", txn_id)
    return [TagInfo(id=t.id, name=t.name) for t in tags]


@router.post("/transactions/{txn_id}/tags", response_model=TagInfo, status_code=201)
async def add_txn_tag(
    txn_id: UUID,
    body: TagCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.get_transaction(session, user_id, txn_id)
    tag = await add_tag(session, user_id, "transaction", txn_id, body.name)
    return TagInfo(id=tag.id, name=tag.name)


@router.delete("/transactions/{txn_id}/tags/{tag_id}", status_code=204)
async def remove_txn_tag(
    txn_id: UUID,
    tag_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.get_transaction(session, user_id, txn_id)
    await remove_tag(session, user_id, "transaction", txn_id, tag_id)


def _txn_response(txn) -> TransactionResponse:
    return TransactionResponse(
        id=txn.id,
        date=txn.date,
        description=txn.description,
        merchant=txn.merchant,
        amount=txn.amount,
        txn_type=txn.txn_type,
        category_id=txn.category_id,
        category_name=txn.category.name if txn.category else None,
        account_id=txn.account_id,
        account_name=txn.account.name if txn.account else None,
        owner_label=txn.account.owner_label if txn.account else None,
        notes=txn.notes,
        reference=txn.reference,
        is_transfer=txn.is_transfer,
        transfer_pair_id=txn.transfer_pair_id,
        hash=txn.hash,
        import_id=txn.import_id,
        created_at=txn.created_at,
    )
