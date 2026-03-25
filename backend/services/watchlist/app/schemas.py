"""Watchlist Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Pipeline Stages ──────────────────────────────────────


class StageCreate(BaseModel):
    name: str = Field(..., max_length=50)
    slug: str | None = Field(None, max_length=50)
    position: int = 0
    color: str | None = None
    is_terminal: bool = False


class StageUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    position: int | None = None
    color: str | None = None
    is_terminal: bool | None = None


class StageReorder(BaseModel):
    stage_ids: list[UUID]


class StageResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    position: int
    color: str | None
    is_terminal: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Themes ───────────────────────────────────────────────


class ThemeCreate(BaseModel):
    name: str = Field(..., max_length=100)
    parent_id: UUID | None = None
    position: int = 0
    color: str | None = None
    asset_type: str | None = None


class ThemeUpdate(BaseModel):
    name: str | None = None
    parent_id: UUID | None = None
    position: int | None = None
    color: str | None = None
    asset_type: str | None = None


class ThemeResponse(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None
    position: int
    color: str | None
    asset_type: str | None = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThemeTreeResponse(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None
    position: int
    color: str | None
    asset_type: str | None = None
    item_count: int = 0
    children: list["ThemeTreeResponse"] = []

    model_config = {"from_attributes": True}


# ── Tags ─────────────────────────────────────────────────


class TagInfo(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str


# ── Market Data ──────────────────────────────────────────


class MarketDataResponse(BaseModel):
    currency: str | None = None
    financial_currency: str | None = None
    current_price: float | None = None
    previous_close: float | None = None
    day_change: float | None = None
    day_change_pct: float | None = None

    # Company info
    company_description: str | None = None
    website: str | None = None
    full_time_employees: int | None = None
    country: str | None = None
    city: str | None = None
    industry: str | None = None
    sector: str | None = None

    # Valuation
    pe_ratio: float | None = None
    pb_ratio: float | None = None
    forward_pe: float | None = None
    peg_ratio: float | None = None
    price_to_sales: float | None = None
    market_cap: int | None = None
    enterprise_value: int | None = None
    eps: float | None = None
    book_value: float | None = None
    beta: float | None = None

    # Profitability & growth
    roe: float | None = None
    roce: float | None = None
    return_on_assets: float | None = None
    profit_margins: float | None = None
    operating_margins: float | None = None
    gross_margins: float | None = None
    ebitda_margins: float | None = None
    revenue_growth: float | None = None
    earnings_growth: float | None = None

    # Financial aggregates
    total_revenue: int | None = None
    total_debt: int | None = None
    total_cash: int | None = None
    free_cashflow: int | None = None
    ebitda: int | None = None
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    dividend_yield: float | None = None
    fifty_two_week_low: float | None = None
    fifty_two_week_high: float | None = None

    # Analyst
    target_mean_price: float | None = None
    target_high_price: float | None = None
    target_low_price: float | None = None
    recommendation_key: str | None = None
    analyst_count: int | None = None

    # Ownership
    held_pct_institutions: float | None = None
    held_pct_insiders: float | None = None

    # MF fields
    nav: float | None = None
    expense_ratio: float | None = None
    aum: float | None = None
    return_1y: float | None = None
    return_3y: float | None = None
    return_5y: float | None = None
    category: str | None = None
    risk_rating: str | None = None

    # Crypto / ETF / Bond
    volume_24h: float | None = None
    circulating_supply: float | None = None
    bond_yield: float | None = None
    holdings_count: int | None = None

    # Shared
    sparkline_data: list[float] | None = None
    price_fetched_at: datetime | None = None
    fundamentals_fetched_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Watchlist Items ──────────────────────────────────────


class ItemCreate(BaseModel):
    symbol: str = Field(..., max_length=30)
    name: str = Field(..., max_length=500)
    asset_type: str = Field(..., pattern="^(stock|mutual_fund|etf|precious_metal|bond|crypto)$")
    exchange: str | None = None
    stage_id: UUID | None = None
    theme_id: UUID | None = None
    remarks: str | None = None
    added_reason: str | None = None


class ItemUpdate(BaseModel):
    name: str | None = None
    stage_id: UUID | None = None
    theme_id: UUID | None = None
    remarks: str | None = None
    added_reason: str | None = None
    is_favourite: bool | None = None
    metadata: dict | None = None


class ItemSummary(BaseModel):
    id: UUID
    symbol: str
    name: str
    asset_type: str
    exchange: str | None
    stage_id: UUID | None
    stage: StageResponse | None = None
    theme_id: UUID | None
    theme_name: str | None = None
    remarks: str | None
    added_reason: str | None
    is_favourite: bool
    tags: list[TagInfo] = []
    cache: MarketDataResponse | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ItemDetail(ItemSummary):
    """Full item detail — same as summary for now, extensible."""
    metadata: dict | None = None

    model_config = {"from_attributes": True}


# ── Search ───────────────────────────────────────────────


class SearchResult(BaseModel):
    symbol: str
    name: str
    exchange: str | None = None
    asset_type: str


# ── Stats ────────────────────────────────────────────────


class AssetClassColumn(BaseModel):
    key: str
    label: str
    width: str
    source: str
    align: str
    format: str | None = None


class AssetClassResponse(BaseModel):
    slug: str
    label: str
    icon: str
    columns: list[AssetClassColumn]
    default_columns: list[str]


class StatsResponse(BaseModel):
    total: int = 0
    by_stage: dict[str, int] = {}
    by_asset_type: dict[str, int] = {}
    by_theme: dict[str, int] = {}
    favourites: int = 0
