"""Expense Tracker Pydantic schemas for request/response validation."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Account ──────────────────────────────────────────────


class AccountCreate(BaseModel):
    name: str = Field(..., max_length=200)
    bank: str = Field(..., max_length=100)
    type: str = Field(..., pattern="^(savings|current|credit_card|wallet|cash)$")
    owner_label: str = Field("", max_length=100)
    account_number_masked: str | None = Field(None, max_length=20)


class AccountUpdate(BaseModel):
    name: str | None = None
    bank: str | None = None
    type: str | None = None
    owner_label: str | None = None
    account_number_masked: str | None = None


class AccountResponse(BaseModel):
    id: UUID
    name: str
    bank: str
    type: str
    owner_label: str
    account_number_masked: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


# ── Category ─────────────────────────────────────────────


class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    parent_id: UUID | None = None
    icon: str | None = None
    group_type: str = Field("expense", pattern="^(income|expense|transfer|investment)$")
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    name: str | None = None
    parent_id: UUID | None = None
    icon: str | None = None
    sort_order: int | None = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None
    icon: str | None
    is_system: bool
    sort_order: int
    group_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CategoryTreeNode(BaseModel):
    id: UUID
    name: str
    icon: str | None
    is_system: bool
    sort_order: int
    group_type: str
    children: list["CategoryTreeNode"] = []


# ── Category Rule ────────────────────────────────────────


class RuleCreate(BaseModel):
    keyword: str = Field(..., max_length=200)
    category_id: UUID
    priority: int = 0


class RuleUpdate(BaseModel):
    keyword: str | None = None
    category_id: UUID | None = None
    priority: int | None = None


class RuleResponse(BaseModel):
    id: UUID
    keyword: str
    category_id: UUID
    category_name: str | None = None
    priority: int
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Transaction ──────────────────────────────────────────


class TransactionCreate(BaseModel):
    date: date
    description: str
    merchant: str | None = None
    amount: Decimal
    txn_type: str = Field(..., pattern="^(debit|credit)$")
    category_id: UUID | None = None
    account_id: UUID
    notes: str | None = None
    reference: str | None = None


class TransactionUpdate(BaseModel):
    category_id: UUID | None = None
    merchant: str | None = None
    notes: str | None = None
    is_transfer: bool | None = None


class TransactionResponse(BaseModel):
    id: UUID
    date: date
    description: str
    merchant: str | None
    amount: Decimal
    txn_type: str
    category_id: UUID | None
    category_name: str | None = None
    account_id: UUID
    account_name: str | None = None
    owner_label: str | None = None
    notes: str | None
    reference: str | None
    is_transfer: bool
    transfer_pair_id: UUID | None
    hash: str
    import_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Import ───────────────────────────────────────────────


class ImportResponse(BaseModel):
    id: UUID
    account_id: UUID
    filename: str
    file_type: str
    bank: str
    period_start: date | None
    period_end: date | None
    total_transactions: int
    new_transactions: int
    status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportSummary(BaseModel):
    import_id: UUID
    filename: str
    total_parsed: int
    new_transactions: int
    duplicates_skipped: int
    auto_categorized: int
    uncategorized: int
    transfers_detected: int


# ── Dashboard ────────────────────────────────────────────


class DashboardSummary(BaseModel):
    total_spend: Decimal
    total_income: Decimal
    net_savings: Decimal
    spend_prev_month: Decimal
    mom_change_pct: float | None


class CategoryBreakdown(BaseModel):
    category_id: UUID | None
    category_name: str
    total: Decimal
    percentage: float
    transaction_count: int


class MonthlyTrend(BaseModel):
    month: str  # "2026-03"
    spend: Decimal
    income: Decimal


class OwnerSplit(BaseModel):
    owner_label: str
    total_spend: Decimal
    total_income: Decimal


# ── Tags (reuse shared pattern) ──────────────────────────


class TagCreate(BaseModel):
    name: str = Field(..., max_length=100)


class TagInfo(BaseModel):
    id: UUID
    name: str
