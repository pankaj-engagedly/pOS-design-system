"""Portfolio Pydantic schemas for request/response validation."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Portfolio ────────────────────────────────────────────


class PortfolioCreate(BaseModel):
    name: str = Field(..., max_length=200)
    holder_name: str = Field(..., max_length=200)
    pan: str | None = Field(None, max_length=20)  # plaintext, encrypted before storage
    email: str | None = Field(None, max_length=200)
    description: str | None = None


class PortfolioUpdate(BaseModel):
    name: str | None = None
    holder_name: str | None = None
    pan: str | None = None
    email: str | None = None
    description: str | None = None


class PortfolioResponse(BaseModel):
    id: UUID
    name: str
    holder_name: str
    pan_masked: str | None = None
    email: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class PortfolioSummary(BaseModel):
    id: UUID
    name: str
    holder_name: str
    pan_masked: str | None = None
    email: str | None
    total_invested: Decimal = Decimal("0")
    current_value: Decimal = Decimal("0")
    total_return: Decimal = Decimal("0")
    return_pct: float = 0.0
    scheme_count: int = 0


# ── CAS Import ───────────────────────────────────────────


class CASImportResponse(BaseModel):
    id: UUID
    portfolio_id: UUID
    filename: str
    import_type: str
    source_type: str
    transaction_count: int
    duplicates_skipped: int
    status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ImportSummaryResponse(BaseModel):
    import_id: UUID
    filename: str
    import_type: str = "cas_pdf"
    source_type: str
    schemes_found: int = 0
    transactions_imported: int = 0
    duplicates_skipped: int = 0
    status: str


# ── Transaction ──────────────────────────────────────────


class TransactionResponse(BaseModel):
    id: UUID
    portfolio_id: UUID
    asset_class: str
    folio_number: str
    amc_name: str
    scheme_name: str
    scheme_isin: str | None
    amfi_code: str | None
    exchange: str | None
    transaction_date: date
    transaction_type: str
    amount: Decimal
    units: Decimal
    nav: Decimal | None
    balance_units: Decimal | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Holdings ─────────────────────────────────────────────


class HoldingResponse(BaseModel):
    asset_class: str = "mutual_fund"
    scheme_name: str
    scheme_isin: str | None
    amfi_code: str | None
    exchange: str | None = None
    folio_number: str
    total_units: Decimal
    invested_amount: Decimal
    current_nav: Decimal | None = None
    current_value: Decimal | None = None
    absolute_return: Decimal | None = None
    return_pct: float | None = None
    xirr: float | None = None


class PortfolioHoldingsSummary(BaseModel):
    portfolio_id: UUID
    portfolio_name: str
    holder_name: str
    total_invested: Decimal
    total_current_value: Decimal
    total_return: Decimal
    return_pct: float
    overall_xirr: float | None = None
    scheme_count: int
    holdings: list[HoldingResponse]


# ── Aggregation ──────────────────────────────────────────


class HolderAggregation(BaseModel):
    holder_name: str
    pan_masked: str | None = None
    portfolio_count: int
    total_invested: Decimal
    total_current_value: Decimal
    total_return: Decimal
    return_pct: float
    overall_xirr: float | None = None


class FamilyAggregation(BaseModel):
    total_invested: Decimal
    total_current_value: Decimal
    total_return: Decimal
    return_pct: float
    overall_xirr: float | None = None
    holder_count: int
    portfolio_count: int
    holders: list[HolderAggregation]


# ── Investment Plans ─────────────────────────────────────


class PlanCreate(BaseModel):
    name: str = Field(..., max_length=200)
    total_corpus: Decimal
    start_date: date
    end_date: date | None = None
    notes: str | None = None


class PlanUpdate(BaseModel):
    name: str | None = None
    total_corpus: Decimal | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None
    notes: str | None = None


class PlanResponse(BaseModel):
    id: UUID
    name: str
    total_corpus: Decimal
    start_date: date
    end_date: date | None
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class PlanSummary(BaseModel):
    id: UUID
    name: str
    total_corpus: Decimal
    total_allocated: Decimal = Decimal("0")
    total_deployed: Decimal = Decimal("0")
    remaining: Decimal = Decimal("0")
    deployment_pct: float = 0.0
    over_allocated: bool = False
    allocation_count: int = 0
    status: str
    start_date: date
    end_date: date | None


# ── Allocations ──────────────────────────────────────────


class AllocationCreate(BaseModel):
    asset_identifier: str = Field(..., max_length=50)
    asset_name: str = Field(..., max_length=500)
    asset_type: str = Field(..., max_length=30)
    target_amount: Decimal
    target_price: Decimal | None = None
    priority: int = 0


class AllocationUpdate(BaseModel):
    asset_identifier: str | None = None
    asset_name: str | None = None
    asset_type: str | None = None
    target_amount: Decimal | None = None
    target_price: Decimal | None = None
    priority: int | None = None


class AllocationResponse(BaseModel):
    id: UUID
    plan_id: UUID
    asset_identifier: str
    asset_name: str
    asset_type: str
    target_amount: Decimal
    target_price: Decimal | None
    priority: int
    deployed_amount: Decimal = Decimal("0")
    remaining_amount: Decimal = Decimal("0")
    deployment_count: int = 0
    deployment_pct: float = 0.0
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Deployment Events ────────────────────────────────────


class DeploymentEventCreate(BaseModel):
    event_date: date
    amount: Decimal
    units: Decimal | None = None
    price_per_unit: Decimal | None = None
    transaction_id: UUID | None = None
    notes: str | None = None


class DeploymentEventResponse(BaseModel):
    id: UUID
    allocation_id: UUID
    event_date: date
    amount: Decimal
    units: Decimal | None
    price_per_unit: Decimal | None
    transaction_id: UUID | None
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Revision Events ─────────────────────────────────────


class RevisionEventResponse(BaseModel):
    id: UUID
    plan_id: UUID
    event_type: str
    previous_value: str | None
    new_value: str | None
    event_date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PlanHistoryResponse(BaseModel):
    plan_id: UUID
    events: list[dict]  # mixed deployment + revision events, sorted by date


# ── Tags ─────────────────────────────────────────────────


class TagCreate(BaseModel):
    name: str = Field(..., max_length=100)


class TagInfo(BaseModel):
    id: UUID
    name: str
