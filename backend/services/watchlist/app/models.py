"""Watchlist models — pipeline stages, themes, items, market data cache."""

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
    asset_type = Column(String(20), nullable=True)  # scoped to asset class

    parent = relationship("WatchlistTheme", remote_side="WatchlistTheme.id", backref="children")
    items = relationship("WatchlistItem", back_populates="theme")


class WatchlistItem(UserScopedBase):
    """A stock or mutual fund on the user's watchlist."""

    __tablename__ = "watchlist_items"
    __table_args__ = (
        UniqueConstraint("user_id", "symbol", name="uq_watchlist_items_user_symbol"),
        Index("ix_watchlist_items_user_asset_type", "user_id", "asset_type"),
        Index("ix_watchlist_items_user_stage", "user_id", "stage_id"),
    )

    symbol = Column(String(30), nullable=False)
    name = Column(String(500), nullable=False)
    asset_type = Column(String(20), nullable=False)  # "stock" | "mutual_fund"
    exchange = Column(String(20), nullable=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id", ondelete="SET NULL"), nullable=True)
    theme_id = Column(UUID(as_uuid=True), ForeignKey("watchlist_themes.id", ondelete="SET NULL"), nullable=True)
    remarks = Column(Text, nullable=True)
    added_reason = Column(Text, nullable=True)
    is_favourite = Column(Boolean, nullable=False, default=False)
    metadata_ = Column("metadata", JSONB, nullable=True)

    stage = relationship("PipelineStage", back_populates="items")
    theme = relationship("WatchlistTheme", back_populates="items")
    cache = relationship("MarketDataCache", back_populates="item", uselist=False, cascade="all, delete-orphan")


class MarketDataCache(UserScopedBase):
    """Cached market data for a watchlist item — refreshed periodically."""

    __tablename__ = "market_data_cache"
    __table_args__ = (
        UniqueConstraint("watchlist_item_id", name="uq_market_data_cache_item"),
    )

    watchlist_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("watchlist_items.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Stock fields
    current_price = Column(Float, nullable=True)
    previous_close = Column(Float, nullable=True)
    day_change = Column(Float, nullable=True)
    day_change_pct = Column(Float, nullable=True)
    pe_ratio = Column(Float, nullable=True)
    pb_ratio = Column(Float, nullable=True)
    market_cap = Column(BigInteger, nullable=True)
    roe = Column(Float, nullable=True)
    roce = Column(Float, nullable=True)
    eps = Column(Float, nullable=True)
    book_value = Column(Float, nullable=True)
    dividend_yield = Column(Float, nullable=True)
    fifty_two_week_low = Column(Float, nullable=True)
    fifty_two_week_high = Column(Float, nullable=True)
    industry = Column(String(200), nullable=True)
    sector = Column(String(200), nullable=True)

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
    currency = Column(String(10), nullable=True)           # trading currency (USD, INR, etc.)
    financial_currency = Column(String(10), nullable=True)  # reporting currency for financials

    # Crypto / ETF / Bond fields
    volume_24h = Column(Float, nullable=True)
    circulating_supply = Column(Float, nullable=True)
    bond_yield = Column(Float, nullable=True)
    holdings_count = Column(Integer, nullable=True)

    # Shared
    sparkline_data = Column(JSONB, nullable=True)  # Array of 30 close prices
    price_fetched_at = Column(DateTime(timezone=True), nullable=True)
    fundamentals_fetched_at = Column(DateTime(timezone=True), nullable=True)

    item = relationship("WatchlistItem", back_populates="cache")


class MetricSnapshot(UserScopedBase):
    """Daily snapshot of all cached metrics for a watchlist item."""

    __tablename__ = "metric_snapshots"
    __table_args__ = (
        UniqueConstraint("watchlist_item_id", "recorded_date", name="uq_metric_snapshots_item_date"),
        Index("ix_metric_snapshots_item_date", "watchlist_item_id", "recorded_date"),
    )

    watchlist_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("watchlist_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    recorded_date = Column(Date, nullable=False)
    metrics = Column(JSONB, nullable=False)

    item = relationship("WatchlistItem")


class FinancialStatement(UserScopedBase):
    """Accumulated financial statement data — one row per statement per fiscal period per frequency."""

    __tablename__ = "financial_statements"
    __table_args__ = (
        UniqueConstraint("watchlist_item_id", "statement_type", "fiscal_period", "frequency", name="uq_financial_stmt_item_type_period_freq"),
        Index("ix_financial_statements_item_type", "watchlist_item_id", "statement_type"),
    )

    watchlist_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("watchlist_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    statement_type = Column(String(20), nullable=False)  # income, balance, cashflow
    fiscal_period = Column(Date, nullable=False)
    frequency = Column(String(10), nullable=False, default="annual")  # annual, quarterly
    line_items = Column(JSONB, nullable=False)
    fetched_at = Column(DateTime(timezone=True), nullable=False)

    item = relationship("WatchlistItem")
