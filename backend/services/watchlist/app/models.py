"""Watchlist models — securities (shared), user watchlists, market data cache, snapshots."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


# ── Shared securities ───────────────────────────────────────────────────────
# These tables don't have user_id in the DB (migration 008 removed it), but
# the models extend UserScopedBase so SQLAlchemy can resolve cross-table
# foreign keys. We override user_id to be nullable and exclude it from queries.


class Security(UserScopedBase):
    """A ticker/instrument — shared across all users. Market data lives here."""

    __tablename__ = "securities"
    __table_args__ = (
        UniqueConstraint("symbol", "asset_type", name="uq_securities_symbol_type"),
        Index("ix_securities_asset_type", "asset_type"),
    )

    # Override user_id from UserScopedBase — not in DB, but needed for mapper compat
    user_id = None

    symbol = Column(String(30), nullable=False)
    name = Column(String(500), nullable=False)
    asset_type = Column(String(20), nullable=False)
    exchange = Column(String(20), nullable=True)


class MarketDataCache(UserScopedBase):
    """Cached market data for a security — refreshed periodically. Shared across users."""

    __tablename__ = "market_data_cache"
    __table_args__ = (
        UniqueConstraint("security_id", name="uq_market_data_cache_security"),
    )

    user_id = None

    security_id = Column(UUID(as_uuid=True), ForeignKey("securities.id", ondelete="CASCADE"), nullable=False)

    # Price
    current_price = Column(Float, nullable=True)
    previous_close = Column(Float, nullable=True)
    day_change = Column(Float, nullable=True)
    day_change_pct = Column(Float, nullable=True)

    # Company info
    company_description = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    full_time_employees = Column(Integer, nullable=True)
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    industry = Column(String(200), nullable=True)
    sector = Column(String(200), nullable=True)

    # Valuation ratios
    pe_ratio = Column(Float, nullable=True)
    pb_ratio = Column(Float, nullable=True)
    forward_pe = Column(Float, nullable=True)
    peg_ratio = Column(Float, nullable=True)
    price_to_sales = Column(Float, nullable=True)
    market_cap = Column(BigInteger, nullable=True)
    enterprise_value = Column(BigInteger, nullable=True)
    eps = Column(Float, nullable=True)
    book_value = Column(Float, nullable=True)
    beta = Column(Float, nullable=True)

    # Profitability & growth
    roe = Column(Float, nullable=True)
    roce = Column(Float, nullable=True)
    return_on_assets = Column(Float, nullable=True)
    profit_margins = Column(Float, nullable=True)
    operating_margins = Column(Float, nullable=True)
    gross_margins = Column(Float, nullable=True)
    ebitda_margins = Column(Float, nullable=True)
    revenue_growth = Column(Float, nullable=True)
    earnings_growth = Column(Float, nullable=True)

    # Financial aggregates
    total_revenue = Column(BigInteger, nullable=True)
    total_debt = Column(BigInteger, nullable=True)
    total_cash = Column(BigInteger, nullable=True)
    free_cashflow = Column(BigInteger, nullable=True)
    ebitda = Column(BigInteger, nullable=True)
    debt_to_equity = Column(Float, nullable=True)
    current_ratio = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    fifty_two_week_low = Column(Float, nullable=True)
    fifty_two_week_high = Column(Float, nullable=True)

    # Analyst
    target_mean_price = Column(Float, nullable=True)
    target_high_price = Column(Float, nullable=True)
    target_low_price = Column(Float, nullable=True)
    recommendation_key = Column(String(30), nullable=True)
    analyst_count = Column(Integer, nullable=True)

    # Ownership
    held_pct_institutions = Column(Float, nullable=True)
    held_pct_insiders = Column(Float, nullable=True)

    # MF fields
    nav = Column(Float, nullable=True)
    expense_ratio = Column(Float, nullable=True)
    aum = Column(Float, nullable=True)
    return_1y = Column(Float, nullable=True)
    return_3y = Column(Float, nullable=True)
    return_5y = Column(Float, nullable=True)
    category = Column(String(200), nullable=True)
    risk_rating = Column(String(50), nullable=True)

    # Currency
    currency = Column(String(10), nullable=True)
    financial_currency = Column(String(10), nullable=True)

    # Crypto / ETF / Bond fields
    volume_24h = Column(Float, nullable=True)
    circulating_supply = Column(Float, nullable=True)
    bond_yield = Column(Float, nullable=True)
    holdings_count = Column(Integer, nullable=True)

    # Shared
    sparkline_data = Column(JSONB, nullable=True)
    price_fetched_at = Column(DateTime(timezone=True), nullable=True)
    fundamentals_fetched_at = Column(DateTime(timezone=True), nullable=True)

    # relationship set up below


class MetricSnapshot(UserScopedBase):
    """Daily snapshot of all cached metrics for a security."""

    __tablename__ = "metric_snapshots"
    __table_args__ = (
        UniqueConstraint("security_id", "recorded_date", name="uq_metric_snapshots_security_date"),
        Index("ix_metric_snapshots_security_date", "security_id", "recorded_date"),
    )

    user_id = None
    updated_at = None

    security_id = Column(UUID(as_uuid=True), ForeignKey("securities.id", ondelete="CASCADE"), nullable=False)
    recorded_date = Column(Date, nullable=False)
    metrics = Column(JSONB, nullable=False)


class FinancialStatement(UserScopedBase):
    """Accumulated financial statement data — one row per statement per fiscal period per frequency."""

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint("security_id", "statement_type", "fiscal_period", "frequency", name="uq_financial_stmt_security_type_period_freq"),
        Index("ix_financial_statements_security_type", "security_id", "statement_type"),
    )

    user_id = None
    updated_at = None

    security_id = Column(UUID(as_uuid=True), ForeignKey("securities.id", ondelete="CASCADE"), nullable=False)
    statement_type = Column(String(20), nullable=False)
    fiscal_period = Column(Date, nullable=False)
    frequency = Column(String(10), nullable=False, default="annual")
    line_items = Column(JSONB, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False)


# ── User-scoped ─────────────────────────────────────────────────────────────


class PipelineStage(UserScopedBase):
    """Configurable status stage in the investment pipeline."""

    __tablename__ = "pipeline_stages"
    __table_args__ = (
        UniqueConstraint("user_id", "slug", name="uq_pipeline_stages_user_slug"),
        Index("ix_pipeline_stages_user_position", "user_id", "position"),
    )

    name = Column(String(50), nullable=False)
    slug = Column(String(50), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    color = Column(String(20), nullable=True)
    is_terminal = Column(Boolean, nullable=False, default=False)

    items = relationship("WatchlistItem", back_populates="stage")


class WatchlistTheme(UserScopedBase):
    """User-defined two-level categorization (themes + sub-themes), scoped by asset class."""

    __tablename__ = "watchlist_themes"
    __table_args__ = (
        UniqueConstraint("user_id", "name", "parent_id", "asset_type", name="uq_watchlist_themes_user_name_parent_asset"),
        Index("ix_watchlist_themes_user_parent", "user_id", "parent_id"),
        Index("ix_watchlist_themes_user_asset_type", "user_id", "asset_type"),
    )

    name = Column(String(100), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("watchlist_themes.id", ondelete="SET NULL"), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    color = Column(String(20), nullable=True)
    asset_type = Column(String(20), nullable=True)

    parent = relationship("WatchlistTheme", remote_side="WatchlistTheme.id", backref="children")
    items = relationship("WatchlistItem", back_populates="theme")


class WatchlistItem(UserScopedBase):
    """A user's watchlist entry — references a shared Security."""

    __tablename__ = "watchlist_items"
    __table_args__ = (
        UniqueConstraint("user_id", "security_id", name="uq_watchlist_items_user_security"),
        Index("ix_watchlist_items_user_asset_type", "user_id", "asset_type"),
        Index("ix_watchlist_items_user_stage", "user_id", "stage_id"),
    )

    # Reference to shared security
    security_id = Column(UUID(as_uuid=True), ForeignKey("securities.id", ondelete="CASCADE"), nullable=False)

    # Denormalized from security for convenience (set on creation)
    symbol = Column(String(30), nullable=False)
    name = Column(String(500), nullable=False)
    asset_type = Column(String(20), nullable=False)
    exchange = Column(String(20), nullable=True)

    # User-specific fields
    stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("watchlist_themes.id", ondelete="SET NULL"), nullable=True)
    remarks = Column(Text, nullable=True)
    added_reason = Column(Text, nullable=True)
    is_favourite = Column(Boolean, nullable=False, default=False)
    metadata_ = Column("metadata", JSONB, nullable=True)

    stage = relationship("PipelineStage", back_populates="items")
    theme = relationship("WatchlistTheme", back_populates="items")

    @property
    def cache(self):
        """Convenience: access market data via security."""
        return self.security.cache if self.security else None


# ── Cross-base relationships (must use direct class refs, not strings) ──────

Security.cache = relationship(MarketDataCache, uselist=False, cascade="all, delete-orphan", foreign_keys=[MarketDataCache.security_id])
Security.snapshots = relationship(MetricSnapshot, cascade="all, delete-orphan", foreign_keys=[MetricSnapshot.security_id])
Security.financials = relationship(FinancialStatement, cascade="all, delete-orphan", foreign_keys=[FinancialStatement.security_id])
Security.watchlist_items = relationship(WatchlistItem, foreign_keys=[WatchlistItem.security_id])
WatchlistItem.security = relationship(Security, foreign_keys=[WatchlistItem.security_id])
