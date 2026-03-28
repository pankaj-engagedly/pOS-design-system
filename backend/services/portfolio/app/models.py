"""Portfolio models — portfolios, CAS imports, transactions, NAV cache, investment plans."""

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


# ── Portfolio ────────────────────────────────────────────


class Portfolio(UserScopedBase):
    """A named investment container scoped by PAN/holder."""

    __tablename__ = "portfolios"
    __table_args__ = (
        Index("ix_portfolios_user_id", "user_id"),
    )

    name = Column(String(200), nullable=False)
    holder_name = Column(String(200), nullable=False)
    pan_encrypted = Column(Text, nullable=True)  # Fernet-encrypted PAN
    email = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    cas_imports = relationship("CASImport", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio", cascade="all, delete-orphan")


# ── CAS Import ───────────────────────────────────────────


class CASImport(UserScopedBase):
    """Record of an import (CAS PDF, broker CSV/Excel/PDF, etc.)."""

    __tablename__ = "cas_imports"
    __table_args__ = (
        Index("ix_cas_imports_portfolio", "portfolio_id"),
    )

    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    import_type = Column(String(30), nullable=False, default="cas_pdf")  # cas_pdf, stock_csv, stock_excel
    source_type = Column(String(50), nullable=False)  # CAS: CAMS/KFintech/NSDL | Stock: Zerodha/Sharekhan
    transaction_count = Column(Integer, nullable=False, default=0)
    duplicates_skipped = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="completed")  # "completed" | "failed" | "partial"
    raw_file_path = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    portfolio = relationship("Portfolio", back_populates="cas_imports")
    transactions = relationship("Transaction", back_populates="cas_import")


# ── Transaction ──────────────────────────────────────────


class Transaction(UserScopedBase):
    """A single investment transaction (MF or stock) from an import."""

    __tablename__ = "transactions"
    __table_args__ = (
        UniqueConstraint(
            "portfolio_id", "folio_number", "scheme_isin", "transaction_date",
            "transaction_type", "amount", "units",
            name="uq_transactions_dedup",
        ),
        Index("ix_transactions_portfolio", "portfolio_id"),
        Index("ix_transactions_scheme", "portfolio_id", "scheme_isin"),
        Index("ix_transactions_date", "portfolio_id", "transaction_date"),
        Index("ix_transactions_asset_class", "portfolio_id", "asset_class"),
    )

    portfolio_id = Column(UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False)
    import_id = Column(UUID(as_uuid=True), ForeignKey("cas_imports.id", ondelete="SET NULL"), nullable=True)
    asset_class = Column(String(20), nullable=False, default="mutual_fund")  # mutual_fund, stock, etf
    folio_number = Column(String(50), nullable=False)  # MF: folio number, stock: broker client ID
    amc_name = Column(String(300), nullable=False)  # MF: AMC name, stock: broker name
    scheme_name = Column(String(500), nullable=False)  # MF: scheme name, stock: company/symbol name
    scheme_isin = Column(String(20), nullable=True)  # ISIN for both MF and stocks
    amfi_code = Column(String(20), nullable=True)  # MF: AMFI code, stock: NSE/BSE symbol
    exchange = Column(String(10), nullable=True)  # stock: NSE/BSE
    transaction_date = Column(Date, nullable=False)
    transaction_type = Column(String(30), nullable=False)  # buy, sell, sip, switch_in, switch_out, dividend_payout, dividend_reinvest, redemption
    amount = Column(Numeric(18, 4), nullable=False)
    units = Column(Numeric(18, 4), nullable=False)
    nav = Column(Numeric(18, 4), nullable=True)  # MF: NAV per unit, stock: price per share
    balance_units = Column(Numeric(18, 4), nullable=True)

    portfolio = relationship("Portfolio", back_populates="transactions")
    cas_import = relationship("CASImport", back_populates="transactions")


# ── NAV Cache ────────────────────────────────────────────


class NAVCache(UserScopedBase):
    """Cached daily NAV from AMFI."""

    __tablename__ = "nav_cache"
    __table_args__ = (
        UniqueConstraint("amfi_code", "nav_date", name="uq_nav_cache_code_date"),
        Index("ix_nav_cache_amfi_code", "amfi_code"),
    )

    amfi_code = Column(String(20), nullable=False)
    scheme_name = Column(String(500), nullable=True)
    nav = Column(Numeric(18, 4), nullable=False)
    nav_date = Column(Date, nullable=False)


# ── Stock Price Cache ────────────────────────────────────


class StockPriceCache(UserScopedBase):
    """Cached daily stock/ETF price from NSE/BSE."""

    __tablename__ = "stock_price_cache"
    __table_args__ = (
        UniqueConstraint("symbol", "exchange", "price_date", name="uq_stock_price_symbol_date"),
        Index("ix_stock_price_symbol", "symbol"),
        Index("ix_stock_price_isin", "isin"),
    )

    symbol = Column(String(30), nullable=False)  # NSE/BSE trading symbol
    isin = Column(String(20), nullable=True)
    company_name = Column(String(500), nullable=True)
    exchange = Column(String(10), nullable=False, default="NSE")  # NSE, BSE
    price = Column(Numeric(18, 4), nullable=False)  # closing price
    price_date = Column(Date, nullable=False)


# ── Investment Plan ──────────────────────────────────────


class InvestmentPlan(UserScopedBase):
    """A capital allocation plan with target corpus and deployment tracking."""

    __tablename__ = "investment_plans"
    __table_args__ = (
        Index("ix_investment_plans_user_id", "user_id"),
    )

    name = Column(String(200), nullable=False)
    total_corpus = Column(Numeric(18, 2), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    status = Column(String(20), nullable=False, default="active")  # active, completed, archived
    notes = Column(Text, nullable=True)

    allocations = relationship("PlanAllocation", back_populates="plan", cascade="all, delete-orphan")
    revision_events = relationship("PlanRevisionEvent", back_populates="plan", cascade="all, delete-orphan")


# ── Plan Allocation ──────────────────────────────────────


class PlanAllocation(UserScopedBase):
    """A target allocation within an investment plan for a specific asset."""

    __tablename__ = "plan_allocations"
    __table_args__ = (
        Index("ix_plan_allocations_plan", "plan_id"),
    )

    plan_id = Column(UUID(as_uuid=True), ForeignKey("investment_plans.id", ondelete="CASCADE"), nullable=False)
    asset_identifier = Column(String(50), nullable=False)  # ISIN or ticker
    asset_name = Column(String(500), nullable=False)
    asset_type = Column(String(30), nullable=False)  # stock, mutual_fund, etf, gold, bond, crypto
    target_amount = Column(Numeric(18, 2), nullable=False)
    target_price = Column(Numeric(18, 4), nullable=True)  # optional buy-below trigger
    priority = Column(Integer, nullable=False, default=0)

    plan = relationship("InvestmentPlan", back_populates="allocations")
    deployment_events = relationship("DeploymentEvent", back_populates="allocation", cascade="all, delete-orphan")


# ── Deployment Event (Ledger) ────────────────────────────


class DeploymentEvent(UserScopedBase):
    """Immutable record of capital deployment against an allocation."""

    __tablename__ = "deployment_events"
    __table_args__ = (
        Index("ix_deployment_events_allocation", "allocation_id"),
    )

    allocation_id = Column(UUID(as_uuid=True), ForeignKey("plan_allocations.id", ondelete="CASCADE"), nullable=False)
    event_date = Column(Date, nullable=False)
    amount = Column(Numeric(18, 2), nullable=False)
    units = Column(Numeric(18, 4), nullable=True)
    price_per_unit = Column(Numeric(18, 4), nullable=True)
    transaction_id = Column(UUID(as_uuid=True), nullable=True)  # optional link to portfolio transaction
    notes = Column(Text, nullable=True)

    allocation = relationship("PlanAllocation", back_populates="deployment_events")


# ── Plan Revision Event (Ledger) ─────────────────────────


class PlanRevisionEvent(UserScopedBase):
    """Immutable record of a plan modification."""

    __tablename__ = "plan_revision_events"
    __table_args__ = (
        Index("ix_plan_revision_events_plan", "plan_id"),
    )

    plan_id = Column(UUID(as_uuid=True), ForeignKey("investment_plans.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(30), nullable=False)  # corpus_change, allocation_change, plan_note
    previous_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    event_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)

    plan = relationship("InvestmentPlan", back_populates="revision_events")
