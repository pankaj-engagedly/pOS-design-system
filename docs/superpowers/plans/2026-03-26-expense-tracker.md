# Expense Tracker Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an import-first expense tracker service (port 8011) with accounts, categories, CSV/Excel import, auto-categorization, transfer detection, and a dashboard.

**Architecture:** New FastAPI microservice following the established pOS pattern (UserScopedBase models, gateway proxy, Web Component frontend). Backend handles statement parsing, keyword-based categorization, and inter-account transfer detection. Frontend is a sidebar-driven two-panel layout with dashboard, transaction list, and management views.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, openpyxl (Excel), Pydantic. Frontend: vanilla JS Web Components, shadow DOM, reactive state store.

---

### Task 1: Backend Service Skeleton

**Files:**
- Create: `backend/services/expense_tracker/app/__init__.py`
- Create: `backend/services/expense_tracker/app/config.py`
- Create: `backend/services/expense_tracker/app/db.py`
- Create: `backend/services/expense_tracker/app/main.py`
- Create: `backend/services/expense_tracker/requirements.txt`

- [ ] **Step 1: Create service directory and `__init__.py`**

```bash
mkdir -p backend/services/expense_tracker/app
touch backend/services/expense_tracker/app/__init__.py
```

- [ ] **Step 2: Create `config.py`**

```python
"""Expense Tracker service configuration."""

from pos_contracts.config import BaseServiceConfig


class ExpenseTrackerConfig(BaseServiceConfig):
    SERVICE_NAME: str = "pos-expense-tracker"
```

- [ ] **Step 3: Create `db.py`**

```python
"""Database lifecycle for the Expense Tracker service."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_engine = None
_session_factory = None


def init_db(database_url: str, echo: bool = False) -> None:
    global _engine, _session_factory
    _engine = create_async_engine(database_url, echo=echo)
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_session() -> AsyncSession:
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    async with _session_factory() as session:
        yield session


async def close_db() -> None:
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
```

- [ ] **Step 4: Create `main.py`**

```python
"""Expense Tracker service — accounts, transactions, statement import, categorization."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware

from pos_contracts.logging import setup_logging
from pos_contracts.schemas import HealthResponse
from pos_events import event_bus

from .config import ExpenseTrackerConfig
from .db import close_db, init_db


class UserIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_id = request.headers.get("x-user-id")
        if user_id:
            request.state.user_id = user_id
        return await call_next(request)


config = ExpenseTrackerConfig()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(config.SERVICE_NAME, config.LOG_LEVEL)
    init_db(config.DATABASE_URL, echo=config.DEBUG)
    app.state.config = config
    await event_bus.init(config.RABBITMQ_URL)
    logger.info("Expense Tracker service ready")
    yield
    await event_bus.close()
    await close_db()
    logger.info("Expense Tracker service stopped")


app = FastAPI(
    title="pOS Expense Tracker Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(UserIdMiddleware)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service=config.SERVICE_NAME)
```

- [ ] **Step 5: Create `requirements.txt`**

```
openpyxl>=3.1.0
```

- [ ] **Step 6: Verify service starts**

```bash
cd backend/services/expense_tracker
LOG_LEVEL=DEBUG ../../.venv/bin/uvicorn app.main:app --port 8011
```

Expected: Service starts, `/health` returns `{"status": "ok", "service": "pos-expense-tracker"}`.

- [ ] **Step 7: Commit**

```bash
git add backend/services/expense_tracker/
git commit -m "feat(expense-tracker): add service skeleton on port 8011"
```

---

### Task 2: Models

**Files:**
- Create: `backend/services/expense_tracker/app/models.py`

- [ ] **Step 1: Create `models.py` with all five tables**

```python
"""Expense Tracker models — accounts, categories, rules, transactions, imports."""

from sqlalchemy import (
    Boolean,
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


class Account(UserScopedBase):
    """A bank account, credit card, wallet, or cash account."""

    __tablename__ = "expense_accounts"
    __table_args__ = (
        Index("ix_expense_accounts_user_id", "user_id"),
    )

    name = Column(String(200), nullable=False)
    bank = Column(String(100), nullable=False)
    type = Column(String(30), nullable=False)  # savings, current, credit_card, wallet, cash
    owner_label = Column(String(100), nullable=False, server_default="")
    account_number_masked = Column(String(20), nullable=True)

    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    imports = relationship("StatementImport", back_populates="account", cascade="all, delete-orphan")


class Category(UserScopedBase):
    """Expense/income category with optional parent for hierarchy."""

    __tablename__ = "expense_categories"
    __table_args__ = (
        Index("ix_expense_categories_user_id", "user_id"),
    )

    name = Column(String(100), nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id", ondelete="CASCADE"), nullable=True)
    icon = Column(String(20), nullable=True)
    is_system = Column(Boolean, nullable=False, server_default="false")
    sort_order = Column(Integer, nullable=False, server_default="0")
    group_type = Column(String(20), nullable=False, server_default="expense")  # income, expense, transfer, investment

    parent = relationship("Category", remote_side="Category.id", backref="children")


class CategoryRule(UserScopedBase):
    """Keyword-to-category mapping for auto-categorization."""

    __tablename__ = "expense_category_rules"
    __table_args__ = (
        Index("ix_expense_category_rules_user_id", "user_id"),
        UniqueConstraint("user_id", "keyword", name="uq_expense_rules_user_keyword"),
    )

    keyword = Column(String(200), nullable=False)
    category_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id", ondelete="CASCADE"), nullable=False)
    priority = Column(Integer, nullable=False, server_default="0")
    source = Column(String(20), nullable=False, server_default="system")  # system, user_correction

    category = relationship("Category")


class Transaction(UserScopedBase):
    """A single financial transaction from an import or manual entry."""

    __tablename__ = "expense_transactions"
    __table_args__ = (
        UniqueConstraint("account_id", "hash", name="uq_expense_transactions_account_hash"),
        Index("ix_expense_transactions_user_id", "user_id"),
        Index("ix_expense_transactions_account", "account_id"),
        Index("ix_expense_transactions_date", "user_id", "date"),
        Index("ix_expense_transactions_category", "category_id"),
    )

    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    merchant = Column(String(300), nullable=True)
    amount = Column(Numeric(18, 2), nullable=False)
    txn_type = Column(String(10), nullable=False)  # debit, credit
    category_id = Column(UUID(as_uuid=True), ForeignKey("expense_categories.id", ondelete="SET NULL"), nullable=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("expense_accounts.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text, nullable=True)
    reference = Column(String(200), nullable=True)
    is_transfer = Column(Boolean, nullable=False, server_default="false")
    transfer_pair_id = Column(UUID(as_uuid=True), ForeignKey("expense_transactions.id", ondelete="SET NULL"), nullable=True)
    hash = Column(String(64), nullable=False)
    import_id = Column(UUID(as_uuid=True), ForeignKey("expense_statement_imports.id", ondelete="SET NULL"), nullable=True)

    account = relationship("Account", back_populates="transactions")
    category = relationship("Category")
    statement_import = relationship("StatementImport", back_populates="transactions")


class StatementImport(UserScopedBase):
    """Record of a statement file import."""

    __tablename__ = "expense_statement_imports"
    __table_args__ = (
        Index("ix_expense_imports_account", "account_id"),
    )

    account_id = Column(UUID(as_uuid=True), ForeignKey("expense_accounts.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(500), nullable=False)
    file_type = Column(String(10), nullable=False)  # pdf, csv, xlsx
    bank = Column(String(100), nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    total_transactions = Column(Integer, nullable=False, server_default="0")
    new_transactions = Column(Integer, nullable=False, server_default="0")
    status = Column(String(20), nullable=False, server_default="processing")  # processing, completed, failed
    error_message = Column(Text, nullable=True)

    account = relationship("Account", back_populates="imports")
    transactions = relationship("Transaction", back_populates="statement_import")
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/expense_tracker/app/models.py
git commit -m "feat(expense-tracker): add SQLAlchemy models for accounts, categories, transactions, imports"
```

---

### Task 3: Alembic Migrations Setup + Initial Migration

**Files:**
- Create: `backend/services/expense_tracker/alembic.ini`
- Create: `backend/services/expense_tracker/migrations/env.py`
- Create: `backend/services/expense_tracker/migrations/script.py.mako`
- Create: `backend/services/expense_tracker/migrations/versions/001_create_expense_tracker_tables.py`

- [ ] **Step 1: Create `alembic.ini`**

```ini
[alembic]
script_location = migrations
sqlalchemy.url = postgresql+asyncpg://pos:pos@localhost:5432/pos
version_table = alembic_version_expense_tracker

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Create `migrations/env.py`**

```python
"""Alembic migration environment for the Expense Tracker service."""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.models import Account, Category, CategoryRule, Transaction, StatementImport  # noqa: F401
from pos_contracts.models import UserScopedBase

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = UserScopedBase.metadata

OWNED_TABLES = {
    "expense_accounts",
    "expense_categories",
    "expense_category_rules",
    "expense_transactions",
    "expense_statement_imports",
}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        return name in OWNED_TABLES
    if type_ == "index" and hasattr(object, "table"):
        return object.table.name in OWNED_TABLES
    return True


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        version_table="alembic_version_expense_tracker",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table="alembic_version_expense_tracker",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: Create `migrations/script.py.mako`**

```mako
${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, Sequence[str], None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """Upgrade schema."""
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """Downgrade schema."""
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Create `migrations/versions/` directory**

```bash
mkdir -p backend/services/expense_tracker/migrations/versions
```

- [ ] **Step 5: Create `migrations/versions/001_create_expense_tracker_tables.py`**

```python
"""Create expense tracker tables — accounts, categories, rules, transactions, imports.

Revision ID: 001
Create Date: 2026-03-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Accounts
    op.create_table(
        "expense_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("bank", sa.String(100), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("owner_label", sa.String(100), nullable=False, server_default=""),
        sa.Column("account_number_masked", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_expense_accounts_user_id", "expense_accounts", ["user_id"])

    # Categories
    op.create_table(
        "expense_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("expense_categories.id", ondelete="CASCADE"), nullable=True),
        sa.Column("icon", sa.String(20), nullable=True),
        sa.Column("is_system", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("group_type", sa.String(20), nullable=False, server_default="expense"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_expense_categories_user_id", "expense_categories", ["user_id"])

    # Category Rules
    op.create_table(
        "expense_category_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("keyword", sa.String(200), nullable=False),
        sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("expense_categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("source", sa.String(20), nullable=False, server_default="system"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_expense_category_rules_user_id", "expense_category_rules", ["user_id"])
    op.create_unique_constraint("uq_expense_rules_user_keyword", "expense_category_rules", ["user_id", "keyword"])

    # Statement Imports (must be created before transactions due to FK)
    op.create_table(
        "expense_statement_imports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("expense_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_type", sa.String(10), nullable=False),
        sa.Column("bank", sa.String(100), nullable=False),
        sa.Column("period_start", sa.Date, nullable=True),
        sa.Column("period_end", sa.Date, nullable=True),
        sa.Column("total_transactions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("new_transactions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="processing"),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_expense_imports_account", "expense_statement_imports", ["account_id"])

    # Transactions
    op.create_table(
        "expense_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("merchant", sa.String(300), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("txn_type", sa.String(10), nullable=False),
        sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("expense_categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("expense_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("reference", sa.String(200), nullable=True),
        sa.Column("is_transfer", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("transfer_pair_id", UUID(as_uuid=True), sa.ForeignKey("expense_transactions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("hash", sa.String(64), nullable=False),
        sa.Column("import_id", UUID(as_uuid=True), sa.ForeignKey("expense_statement_imports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_expense_transactions_user_id", "expense_transactions", ["user_id"])
    op.create_index("ix_expense_transactions_account", "expense_transactions", ["account_id"])
    op.create_index("ix_expense_transactions_date", "expense_transactions", ["user_id", "date"])
    op.create_index("ix_expense_transactions_category", "expense_transactions", ["category_id"])
    op.create_unique_constraint("uq_expense_transactions_account_hash", "expense_transactions", ["account_id", "hash"])


def downgrade() -> None:
    op.drop_table("expense_transactions")
    op.drop_table("expense_statement_imports")
    op.drop_table("expense_category_rules")
    op.drop_table("expense_categories")
    op.drop_table("expense_accounts")
```

- [ ] **Step 6: Run the migration**

```bash
cd backend/services/expense_tracker
../../.venv/bin/alembic upgrade head
```

Expected: Migration applies successfully, tables created in PostgreSQL.

- [ ] **Step 7: Commit**

```bash
git add backend/services/expense_tracker/alembic.ini backend/services/expense_tracker/migrations/
git commit -m "feat(expense-tracker): add Alembic setup and initial migration"
```

---

### Task 4: Schemas

**Files:**
- Create: `backend/services/expense_tracker/app/schemas.py`

- [ ] **Step 1: Create `schemas.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/expense_tracker/app/schemas.py
git commit -m "feat(expense-tracker): add Pydantic schemas for all endpoints"
```

---

### Task 5: Category Seeding Service

**Files:**
- Create: `backend/services/expense_tracker/app/service_categories.py`

- [ ] **Step 1: Create `service_categories.py`** with CRUD + seeding

```python
"""Category CRUD and seed data for expense tracker."""

from uuid import UUID

from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pos_contracts.exceptions import NotFoundError

from .models import Category, CategoryRule


# ── Seed taxonomy ────────────────────────────────────────

SEED_CATEGORIES = [
    # (group_type, name, icon, children)
    ("income", "Income", None, [
        "Salary", "Freelance/Business", "Interest", "Dividends",
        "Rental Income", "Refunds", "Cashback",
    ]),
    ("expense", "Food & Dining", None, [
        "Groceries", "Restaurants", "Food Delivery", "Coffee/Snacks",
    ]),
    ("expense", "Housing", None, [
        "Rent", "Society Maintenance", "Home Repairs", "Furnishing", "Property Tax",
    ]),
    ("expense", "Utilities", None, [
        "Electricity", "Water", "Gas", "Internet/Broadband", "Mobile", "DTH/Cable",
    ]),
    ("expense", "Transport", None, [
        "Fuel/Petrol", "Cab/Auto", "Metro/Bus/Train", "Parking/Toll",
        "Vehicle Maintenance", "Vehicle Insurance",
    ]),
    ("expense", "Shopping", None, [
        "Clothing", "Electronics", "Online Shopping", "Household Supplies",
    ]),
    ("expense", "Health", None, [
        "Doctor/Medical", "Pharmacy", "Lab Tests", "Gym/Fitness", "Health Insurance",
    ]),
    ("expense", "Education", None, [
        "School/College Fees", "Books", "Online Courses", "Coaching",
    ]),
    ("expense", "Entertainment", None, [
        "Movies/Events", "OTT Subscriptions", "Games/Hobbies", "Music",
    ]),
    ("expense", "Travel", None, [
        "Flights", "Hotels", "Train/Bus", "Travel Insurance",
    ]),
    ("expense", "Personal Care", None, [
        "Salon/Grooming", "Spa/Wellness",
    ]),
    ("expense", "Family", None, [
        "Domestic Help", "Kids", "Gifts", "Family Support",
    ]),
    ("expense", "Financial", None, [
        "EMI Payments", "Loan Interest", "Bank Charges", "Life Insurance",
    ]),
    ("expense", "Government/Tax", None, [
        "Income Tax", "GST/Professional Tax", "Stamp Duty", "Fines",
    ]),
    ("expense", "Donations", None, [
        "Charity", "Religious", "Political",
    ]),
    ("expense", "Cash", None, [
        "ATM Withdrawal", "Cash Payment",
    ]),
    ("transfer", "Transfers", None, [
        "Self Transfer", "CC Bill Payment", "Wallet Top-up",
    ]),
    ("investment", "Investment", None, [
        "MF/Stocks/FD/PPF/NPS", "Investment Income",
    ]),
]

SEED_RULES = [
    # (keyword, category_path)  — category_path is "Parent > Child" or just "Child"
    ("swiggy", "Food Delivery"), ("zomato", "Food Delivery"), ("dominos", "Food Delivery"),
    ("mcd", "Food Delivery"), ("kfc", "Food Delivery"), ("uber eats", "Food Delivery"),
    ("bigbasket", "Groceries"), ("blinkit", "Groceries"), ("zepto", "Groceries"),
    ("dmart", "Groceries"), ("more retail", "Groceries"), ("nature basket", "Groceries"),
    ("amazon", "Online Shopping"), ("flipkart", "Online Shopping"), ("myntra", "Online Shopping"),
    ("ajio", "Online Shopping"), ("meesho", "Online Shopping"), ("nykaa", "Online Shopping"),
    ("uber", "Cab/Auto"), ("ola", "Cab/Auto"), ("rapido", "Cab/Auto"),
    ("irctc", "Train/Bus"), ("redbus", "Train/Bus"), ("makemytrip", "Travel"),
    ("airtel", "Mobile"), ("jio", "Mobile"), ("vodafone", "Mobile"), ("bsnl", "Mobile"),
    ("bescom", "Electricity"), ("tata power", "Electricity"),
    ("netflix", "OTT Subscriptions"), ("hotstar", "OTT Subscriptions"),
    ("spotify", "OTT Subscriptions"), ("prime video", "OTT Subscriptions"),
    ("youtube premium", "OTT Subscriptions"),
    ("bookmyshow", "Movies/Events"),
    ("shell", "Fuel/Petrol"), ("hp petrol", "Fuel/Petrol"), ("indian oil", "Fuel/Petrol"),
    ("bpcl", "Fuel/Petrol"),
    ("apollo", "Doctor/Medical"), ("1mg", "Pharmacy"), ("pharmeasy", "Pharmacy"),
    ("medplus", "Pharmacy"),
    ("zerodha", "MF/Stocks/FD/PPF/NPS"), ("groww", "MF/Stocks/FD/PPF/NPS"),
    ("kuvera", "MF/Stocks/FD/PPF/NPS"), ("coin", "MF/Stocks/FD/PPF/NPS"),
    ("paytm", "Wallet Top-up"), ("phonepe", "Wallet Top-up"),
    ("society maintenance", "Society Maintenance"), ("maintenance charges", "Society Maintenance"),
    ("rent", "Rent"),
    ("atm", "ATM Withdrawal"), ("cash withdrawal", "ATM Withdrawal"),
]


async def seed_categories(session: AsyncSession, user_id: UUID) -> int:
    """Seed default categories and rules for a new user. Idempotent — skips if categories exist."""
    existing = await session.execute(
        select(func.count(Category.id)).where(Category.user_id == user_id)
    )
    if existing.scalar() > 0:
        return 0

    # Build category name → id lookup as we create
    name_to_id: dict[str, UUID] = {}
    sort = 0

    for group_type, parent_name, icon, children in SEED_CATEGORIES:
        parent = Category(
            user_id=user_id,
            name=parent_name,
            icon=icon,
            is_system=True,
            sort_order=sort,
            group_type=group_type,
        )
        session.add(parent)
        await session.flush()
        name_to_id[parent_name] = parent.id
        sort += 1

        for child_name in children:
            child = Category(
                user_id=user_id,
                name=child_name,
                parent_id=parent.id,
                is_system=True,
                sort_order=sort,
                group_type=group_type,
            )
            session.add(child)
            await session.flush()
            name_to_id[child_name] = child.id
            sort += 1

    # Seed rules
    for keyword, category_name in SEED_RULES:
        cat_id = name_to_id.get(category_name)
        if cat_id:
            rule = CategoryRule(
                user_id=user_id,
                keyword=keyword,
                category_id=cat_id,
                source="system",
            )
            session.add(rule)

    await session.commit()
    logger.info(f"Seeded {sort} categories and {len(SEED_RULES)} rules for user {user_id}")
    return sort


# ── CRUD ─────────────────────────────────────────────────


async def get_category_tree(session: AsyncSession, user_id: UUID) -> list[Category]:
    """Return all categories for a user (flat list — frontend builds the tree)."""
    result = await session.execute(
        select(Category)
        .where(Category.user_id == user_id)
        .order_by(Category.sort_order)
    )
    return list(result.scalars().all())


async def create_category(
    session: AsyncSession, user_id: UUID, *, name: str, parent_id: UUID | None = None,
    icon: str | None = None, group_type: str = "expense", sort_order: int = 0,
) -> Category:
    cat = Category(
        user_id=user_id, name=name, parent_id=parent_id,
        icon=icon, is_system=False, sort_order=sort_order, group_type=group_type,
    )
    session.add(cat)
    await session.commit()
    await session.refresh(cat)
    return cat


async def update_category(
    session: AsyncSession, user_id: UUID, category_id: UUID, **kwargs,
) -> Category:
    result = await session.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise NotFoundError("Category not found")
    for k, v in kwargs.items():
        if v is not None:
            setattr(cat, k, v)
    await session.commit()
    await session.refresh(cat)
    return cat


async def delete_category(session: AsyncSession, user_id: UUID, category_id: UUID) -> None:
    result = await session.execute(
        select(Category).where(Category.id == category_id, Category.user_id == user_id)
    )
    cat = result.scalar_one_or_none()
    if not cat:
        raise NotFoundError("Category not found")
    await session.delete(cat)
    await session.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/services/expense_tracker/app/service_categories.py
git commit -m "feat(expense-tracker): add category CRUD and Indian taxonomy seed data"
```

---

### Task 6: Account & Transaction Services

**Files:**
- Create: `backend/services/expense_tracker/app/service_accounts.py`
- Create: `backend/services/expense_tracker/app/service_transactions.py`

- [ ] **Step 1: Create `service_accounts.py`**

```python
"""Account CRUD for expense tracker."""

from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from pos_contracts.exceptions import NotFoundError

from .models import Account


async def list_accounts(session: AsyncSession, user_id: UUID) -> list[Account]:
    result = await session.execute(
        select(Account)
        .where(Account.user_id == user_id)
        .order_by(Account.owner_label, Account.name)
    )
    return list(result.scalars().all())


async def get_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> Account:
    result = await session.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Account not found")
    return account


async def create_account(
    session: AsyncSession, user_id: UUID, *,
    name: str, bank: str, type: str,
    owner_label: str = "", account_number_masked: str | None = None,
) -> Account:
    account = Account(
        user_id=user_id, name=name, bank=bank, type=type,
        owner_label=owner_label, account_number_masked=account_number_masked,
    )
    session.add(account)
    await session.commit()
    await session.refresh(account)
    logger.info(f"Created account '{name}' for user {user_id}")
    return account


async def update_account(
    session: AsyncSession, user_id: UUID, account_id: UUID, **kwargs,
) -> Account:
    account = await get_account(session, user_id, account_id)
    for k, v in kwargs.items():
        if v is not None:
            setattr(account, k, v)
    await session.commit()
    await session.refresh(account)
    return account


async def delete_account(session: AsyncSession, user_id: UUID, account_id: UUID) -> None:
    account = await get_account(session, user_id, account_id)
    await session.delete(account)
    await session.commit()
    logger.info(f"Deleted account {account_id} for user {user_id}")
```

- [ ] **Step 2: Create `service_transactions.py`**

```python
"""Transaction queries, category update with rule learning, manual entry."""

import hashlib
from datetime import date
from decimal import Decimal
from uuid import UUID

from loguru import logger
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from pos_contracts.exceptions import NotFoundError

from .models import Account, Category, CategoryRule, Transaction


def compute_hash(txn_date: date, amount: Decimal, description: str) -> str:
    """SHA256 hash for dedup — unique per account."""
    raw = f"{txn_date.isoformat()}|{amount}|{description}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def list_transactions(
    session: AsyncSession, user_id: UUID, *,
    account_id: UUID | None = None,
    category_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    is_transfer: bool | None = None,
    uncategorized_only: bool = False,
    owner_label: str | None = None,
    search: str | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[Transaction]:
    q = (
        select(Transaction)
        .join(Account, Transaction.account_id == Account.id)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
    )

    if account_id:
        q = q.where(Transaction.account_id == account_id)
    if category_id:
        q = q.where(Transaction.category_id == category_id)
    if date_from:
        q = q.where(Transaction.date >= date_from)
    if date_to:
        q = q.where(Transaction.date <= date_to)
    if is_transfer is not None:
        q = q.where(Transaction.is_transfer == is_transfer)
    if uncategorized_only:
        q = q.where(Transaction.category_id.is_(None))
    if owner_label:
        q = q.where(Account.owner_label == owner_label)
    if search:
        pattern = f"%{search.lower()}%"
        q = q.where(
            func.lower(Transaction.description).like(pattern)
            | func.lower(Transaction.merchant).like(pattern)
        )

    q = q.limit(limit).offset(offset)
    result = await session.execute(q)
    return list(result.unique().scalars().all())


async def get_transaction(session: AsyncSession, user_id: UUID, txn_id: UUID) -> Transaction:
    result = await session.execute(
        select(Transaction)
        .options(joinedload(Transaction.category), joinedload(Transaction.account))
        .where(Transaction.id == txn_id, Transaction.user_id == user_id)
    )
    txn = result.unique().scalar_one_or_none()
    if not txn:
        raise NotFoundError("Transaction not found")
    return txn


async def update_transaction(
    session: AsyncSession, user_id: UUID, txn_id: UUID, **kwargs,
) -> Transaction:
    """Update transaction fields. If category changes, learn a rule from it."""
    txn = await get_transaction(session, user_id, txn_id)

    new_category_id = kwargs.get("category_id")
    if new_category_id and new_category_id != txn.category_id:
        # Learn user rule from this correction
        merchant_key = (txn.merchant or txn.description).strip().lower()
        if merchant_key:
            await _learn_rule(session, user_id, merchant_key, new_category_id)

    for k, v in kwargs.items():
        if v is not None:
            setattr(txn, k, v)

    await session.commit()
    # Re-fetch with relationships
    return await get_transaction(session, user_id, txn_id)


async def create_transaction(
    session: AsyncSession, user_id: UUID, *,
    date: date, description: str, amount: Decimal, txn_type: str,
    account_id: UUID, merchant: str | None = None,
    category_id: UUID | None = None, notes: str | None = None,
    reference: str | None = None,
) -> Transaction:
    """Manual transaction entry."""
    h = compute_hash(date, amount, description)
    txn = Transaction(
        user_id=user_id, date=date, description=description,
        merchant=merchant, amount=amount, txn_type=txn_type,
        category_id=category_id, account_id=account_id,
        notes=notes, reference=reference, hash=h,
    )
    session.add(txn)
    await session.commit()
    return await get_transaction(session, user_id, txn.id)


async def delete_transaction(session: AsyncSession, user_id: UUID, txn_id: UUID) -> None:
    txn = await get_transaction(session, user_id, txn_id)
    await session.delete(txn)
    await session.commit()


async def _learn_rule(
    session: AsyncSession, user_id: UUID, keyword: str, category_id: UUID,
) -> None:
    """Save or update a user_correction rule from a category change."""
    existing = await session.execute(
        select(CategoryRule).where(
            CategoryRule.user_id == user_id,
            CategoryRule.keyword == keyword,
        )
    )
    rule = existing.scalar_one_or_none()
    if rule:
        rule.category_id = category_id
        rule.source = "user_correction"
        rule.priority = max(rule.priority, 100)  # user rules outrank system
    else:
        rule = CategoryRule(
            user_id=user_id, keyword=keyword,
            category_id=category_id, source="user_correction", priority=100,
        )
        session.add(rule)
    await session.flush()
    logger.debug(f"Learned rule: '{keyword}' → category {category_id}")
```

- [ ] **Step 3: Commit**

```bash
git add backend/services/expense_tracker/app/service_accounts.py backend/services/expense_tracker/app/service_transactions.py
git commit -m "feat(expense-tracker): add account CRUD and transaction service with rule learning"
```

---

### Task 7: Import Service + Categorization + Transfer Detection

**Files:**
- Create: `backend/services/expense_tracker/app/service_import.py`
- Create: `backend/services/expense_tracker/app/service_transfer_detection.py`
- Create: `backend/services/expense_tracker/app/parsers/__init__.py`
- Create: `backend/services/expense_tracker/app/parsers/base.py`
- Create: `backend/services/expense_tracker/app/parsers/hdfc_csv.py`
- Create: `backend/services/expense_tracker/app/parsers/kotak_csv.py`

- [ ] **Step 1: Create `parsers/base.py`** — base parser interface

```python
"""Base parser interface for bank statement parsers."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass
class ParsedTransaction:
    """Standardized transaction from any bank parser."""
    date: date
    description: str
    amount: Decimal  # always positive
    txn_type: str  # "debit" or "credit"
    reference: str | None = None
    balance: Decimal | None = None


class BaseParser:
    """Interface for bank-specific parsers."""

    bank_name: str = ""

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        """Parse a statement file and return standardized transactions."""
        raise NotImplementedError

    def detect(self, file_bytes: bytes, filename: str) -> bool:
        """Return True if this parser can handle the given file."""
        raise NotImplementedError
```

- [ ] **Step 2: Create `parsers/__init__.py`**

```python
"""Bank statement parsers registry."""

from .hdfc_csv import HDFCCSVParser
from .kotak_csv import KotakCSVParser

PARSERS = [
    HDFCCSVParser(),
    KotakCSVParser(),
]


def get_parser_for_bank(bank: str):
    """Return the parser matching a bank name."""
    bank_lower = bank.lower()
    for parser in PARSERS:
        if parser.bank_name.lower() in bank_lower or bank_lower in parser.bank_name.lower():
            return parser
    return None
```

- [ ] **Step 3: Create `parsers/hdfc_csv.py`**

```python
"""HDFC Bank CSV/Excel statement parser.

HDFC format (CSV):
  Date, Narration, Value Dat, Debit Amount, Credit Amount, Chq/Ref Number, Closing Balance

HDFC format (XLS/XLSX) — same columns as CSV, first few rows may be header metadata.
"""

import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .base import BaseParser, ParsedTransaction

try:
    import openpyxl
except ImportError:
    openpyxl = None


class HDFCCSVParser(BaseParser):
    bank_name = "HDFC"

    def detect(self, file_bytes: bytes, filename: str) -> bool:
        lower = filename.lower()
        if "hdfc" in lower:
            return True
        # Check CSV header
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return "narration" in text[:500].lower() and "closing balance" in text[:500].lower()
        except Exception:
            return False

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        lower = filename.lower()
        if lower.endswith((".xlsx", ".xls")):
            return self._parse_excel(file_bytes)
        return self._parse_csv(file_bytes)

    def _parse_csv(self, file_bytes: bytes) -> list[ParsedTransaction]:
        text = file_bytes.decode("utf-8", errors="ignore")
        transactions = []

        reader = csv.reader(io.StringIO(text))
        header_found = False

        for row in reader:
            if not row or len(row) < 5:
                continue

            # Find header row
            if not header_found:
                if any("narration" in cell.lower() for cell in row):
                    header_found = True
                continue

            # Skip empty rows after header
            if not row[0].strip():
                continue

            txn = self._parse_row(row)
            if txn:
                transactions.append(txn)

        return transactions

    def _parse_excel(self, file_bytes: bytes) -> list[ParsedTransaction]:
        if not openpyxl:
            raise ImportError("openpyxl required for Excel parsing")

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        transactions = []
        header_found = False

        for row in ws.iter_rows(values_only=True):
            if not row or all(c is None for c in row):
                continue

            cells = [str(c) if c is not None else "" for c in row]

            if not header_found:
                if any("narration" in c.lower() for c in cells):
                    header_found = True
                continue

            if not cells[0].strip():
                continue

            txn = self._parse_row(cells)
            if txn:
                transactions.append(txn)

        wb.close()
        return transactions

    def _parse_row(self, row: list[str]) -> ParsedTransaction | None:
        """Parse a single HDFC row: Date, Narration, Value Dat, Debit, Credit, Ref, Balance."""
        try:
            date_str = row[0].strip()
            description = row[1].strip()
            debit_str = row[3].strip().replace(",", "") if len(row) > 3 else ""
            credit_str = row[4].strip().replace(",", "") if len(row) > 4 else ""
            ref = row[5].strip() if len(row) > 5 else None
            balance_str = row[6].strip().replace(",", "") if len(row) > 6 else None

            # Parse date — HDFC uses DD/MM/YY or DD/MM/YYYY
            for fmt in ("%d/%m/%y", "%d/%m/%Y", "%d-%m-%Y", "%d-%m-%y"):
                try:
                    txn_date = datetime.strptime(date_str, fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return None

            # Determine amount and type
            debit = self._parse_amount(debit_str)
            credit = self._parse_amount(credit_str)

            if debit and debit > 0:
                amount = debit
                txn_type = "debit"
            elif credit and credit > 0:
                amount = credit
                txn_type = "credit"
            else:
                return None  # skip zero or unparseable

            balance = self._parse_amount(balance_str) if balance_str else None

            return ParsedTransaction(
                date=txn_date,
                description=description,
                amount=amount,
                txn_type=txn_type,
                reference=ref if ref else None,
                balance=balance,
            )
        except (IndexError, ValueError):
            return None

    def _parse_amount(self, s: str) -> Decimal | None:
        if not s or s in ("", "None", "nan"):
            return None
        try:
            return abs(Decimal(s.replace(",", "").strip()))
        except (InvalidOperation, ValueError):
            return None
```

- [ ] **Step 4: Create `parsers/kotak_csv.py`**

```python
"""Kotak Mahindra Bank Excel statement parser.

Kotak format (XLSX):
  Sl. No., Transaction Date, Value Date, Description, Chq / Ref No., Debit, Credit, Balance

Date format: DD-MM-YYYY or DD/MM/YYYY
"""

import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .base import BaseParser, ParsedTransaction

try:
    import openpyxl
except ImportError:
    openpyxl = None


class KotakCSVParser(BaseParser):
    bank_name = "Kotak"

    def detect(self, file_bytes: bytes, filename: str) -> bool:
        return "kotak" in filename.lower()

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        if not openpyxl:
            raise ImportError("openpyxl required for Excel parsing")

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        transactions = []
        header_found = False
        col_map = {}

        for row in ws.iter_rows(values_only=True):
            if not row or all(c is None for c in row):
                continue

            cells = [str(c) if c is not None else "" for c in row]

            # Find header row
            if not header_found:
                lower_cells = [c.lower().strip() for c in cells]
                if any("transaction date" in c or "tran date" in c for c in lower_cells):
                    # Map column positions
                    for i, c in enumerate(lower_cells):
                        if "transaction date" in c or "tran date" in c:
                            col_map["date"] = i
                        elif "description" in c or "narration" in c or "particulars" in c:
                            col_map["desc"] = i
                        elif c.strip() == "debit" or "debit" in c:
                            col_map["debit"] = i
                        elif c.strip() == "credit" or "credit" in c:
                            col_map["credit"] = i
                        elif "chq" in c or "ref" in c:
                            col_map["ref"] = i
                        elif "balance" in c:
                            col_map["balance"] = i
                    header_found = True
                    continue

            if not header_found or not cells[col_map.get("date", 0)].strip():
                continue

            txn = self._parse_row(cells, col_map)
            if txn:
                transactions.append(txn)

        wb.close()
        return transactions

    def _parse_row(self, cells: list[str], col_map: dict) -> ParsedTransaction | None:
        try:
            date_str = cells[col_map.get("date", 0)].strip()
            description = cells[col_map.get("desc", 1)].strip()
            debit_str = cells[col_map.get("debit", 3)].strip()
            credit_str = cells[col_map.get("credit", 4)].strip()
            ref = cells[col_map.get("ref", 2)].strip() if "ref" in col_map else None
            balance_str = cells[col_map.get("balance", 5)].strip() if "balance" in col_map else None

            # Parse date
            for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y", "%Y-%m-%d"):
                try:
                    txn_date = datetime.strptime(date_str.split(" ")[0], fmt).date()
                    break
                except ValueError:
                    continue
            else:
                return None

            debit = self._parse_amount(debit_str)
            credit = self._parse_amount(credit_str)

            if debit and debit > 0:
                amount = debit
                txn_type = "debit"
            elif credit and credit > 0:
                amount = credit
                txn_type = "credit"
            else:
                return None

            balance = self._parse_amount(balance_str) if balance_str else None

            return ParsedTransaction(
                date=txn_date,
                description=description,
                amount=amount,
                txn_type=txn_type,
                reference=ref if ref else None,
                balance=balance,
            )
        except (IndexError, ValueError):
            return None

    def _parse_amount(self, s: str) -> Decimal | None:
        if not s or s in ("", "None", "nan", "0"):
            return None
        try:
            val = abs(Decimal(s.replace(",", "").strip()))
            return val if val > 0 else None
        except (InvalidOperation, ValueError):
            return None
```

- [ ] **Step 5: Create `service_transfer_detection.py`**

```python
"""Transfer detection — matches inter-account transfers and CC bill payments."""

from datetime import timedelta
from uuid import UUID

from loguru import logger
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Account, Transaction


async def detect_transfers(
    session: AsyncSession, user_id: UUID, new_txn_ids: list[UUID],
) -> int:
    """Scan new transactions for matching transfers across user's accounts.

    Match criteria:
    - Same amount, opposite txn_type (debit in one, credit in other)
    - Different accounts (both belonging to same user)
    - Within 3-day window
    - Neither already marked as transfer

    Returns count of pairs detected.
    """
    if not new_txn_ids:
        return 0

    # Load new transactions
    result = await session.execute(
        select(Transaction).where(Transaction.id.in_(new_txn_ids))
    )
    new_txns = list(result.scalars().all())

    pairs_found = 0
    for txn in new_txns:
        if txn.is_transfer:
            continue  # already paired

        opposite_type = "credit" if txn.txn_type == "debit" else "debit"
        date_lo = txn.date - timedelta(days=3)
        date_hi = txn.date + timedelta(days=3)

        # Find matching transaction in a different account
        match_result = await session.execute(
            select(Transaction).where(
                Transaction.user_id == user_id,
                Transaction.account_id != txn.account_id,
                Transaction.amount == txn.amount,
                Transaction.txn_type == opposite_type,
                Transaction.date >= date_lo,
                Transaction.date <= date_hi,
                Transaction.is_transfer == False,
                Transaction.transfer_pair_id.is_(None),
            ).limit(1)
        )
        match = match_result.scalar_one_or_none()

        if match:
            txn.is_transfer = True
            txn.transfer_pair_id = match.id
            match.is_transfer = True
            match.transfer_pair_id = txn.id
            pairs_found += 1

    if pairs_found > 0:
        await session.commit()
        logger.info(f"Detected {pairs_found} transfer pairs for user {user_id}")

    return pairs_found
```

- [ ] **Step 6: Create `service_import.py`** — orchestrates parse → dedup → categorize → detect

```python
"""Statement import orchestration — parse, dedup, categorize, detect transfers."""

from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Account, CategoryRule, StatementImport, Transaction
from .parsers import get_parser_for_bank
from .parsers.base import ParsedTransaction
from .schemas import ImportSummary
from .service_categories import seed_categories
from .service_transactions import compute_hash
from .service_transfer_detection import detect_transfers


async def import_statement(
    session: AsyncSession,
    user_id: UUID,
    account_id: UUID,
    file_bytes: bytes,
    filename: str,
) -> ImportSummary:
    """Import a bank statement file for an account."""
    # Get account
    result = await session.execute(
        select(Account).where(Account.id == account_id, Account.user_id == user_id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise ValueError("Account not found")

    # Ensure categories exist for this user
    await seed_categories(session, user_id)

    # Get parser
    parser = get_parser_for_bank(account.bank)
    if not parser:
        raise ValueError(f"No parser available for bank: {account.bank}")

    # Determine file type
    lower = filename.lower()
    if lower.endswith(".csv"):
        file_type = "csv"
    elif lower.endswith((".xlsx", ".xls")):
        file_type = "xlsx"
    else:
        file_type = "csv"  # default

    # Create import record
    stmt_import = StatementImport(
        user_id=user_id,
        account_id=account_id,
        filename=filename,
        file_type=file_type,
        bank=account.bank,
        status="processing",
    )
    session.add(stmt_import)
    await session.flush()

    try:
        # Parse
        parsed = parser.parse(file_bytes, filename)
        total_parsed = len(parsed)

        if not parsed:
            stmt_import.status = "completed"
            stmt_import.total_transactions = 0
            stmt_import.new_transactions = 0
            await session.commit()
            return ImportSummary(
                import_id=stmt_import.id, filename=filename,
                total_parsed=0, new_transactions=0, duplicates_skipped=0,
                auto_categorized=0, uncategorized=0, transfers_detected=0,
            )

        # Set period
        dates = sorted(t.date for t in parsed)
        stmt_import.period_start = dates[0]
        stmt_import.period_end = dates[-1]

        # Load category rules for auto-categorization
        rules = await _load_rules(session, user_id)

        # Dedup and insert
        new_txn_ids = []
        duplicates = 0
        auto_categorized = 0

        for p in parsed:
            h = compute_hash(p.date, p.amount, p.description)

            # Check for duplicate
            existing = await session.execute(
                select(Transaction.id).where(
                    Transaction.account_id == account_id,
                    Transaction.hash == h,
                )
            )
            if existing.scalar_one_or_none():
                duplicates += 1
                continue

            # Auto-categorize
            category_id = _match_category(p.description, rules)
            if category_id:
                auto_categorized += 1

            txn = Transaction(
                user_id=user_id,
                date=p.date,
                description=p.description,
                merchant=_extract_merchant(p.description),
                amount=p.amount,
                txn_type=p.txn_type,
                category_id=category_id,
                account_id=account_id,
                reference=p.reference,
                hash=h,
                import_id=stmt_import.id,
            )
            session.add(txn)
            await session.flush()
            new_txn_ids.append(txn.id)

        # Detect transfers
        transfers = await detect_transfers(session, user_id, new_txn_ids)

        # Update import record
        stmt_import.total_transactions = total_parsed
        stmt_import.new_transactions = len(new_txn_ids)
        stmt_import.status = "completed"
        await session.commit()

        uncategorized = len(new_txn_ids) - auto_categorized
        logger.info(
            f"Import complete: {total_parsed} parsed, {len(new_txn_ids)} new, "
            f"{duplicates} dupes, {auto_categorized} categorized, {transfers} transfers"
        )

        return ImportSummary(
            import_id=stmt_import.id,
            filename=filename,
            total_parsed=total_parsed,
            new_transactions=len(new_txn_ids),
            duplicates_skipped=duplicates,
            auto_categorized=auto_categorized,
            uncategorized=uncategorized,
            transfers_detected=transfers,
        )

    except Exception as e:
        stmt_import.status = "failed"
        stmt_import.error_message = str(e)
        await session.commit()
        logger.error(f"Import failed for {filename}: {e}")
        raise


async def _load_rules(session: AsyncSession, user_id: UUID) -> list[tuple[str, UUID]]:
    """Load category rules sorted by priority (user_correction first)."""
    result = await session.execute(
        select(CategoryRule)
        .where(CategoryRule.user_id == user_id)
        .order_by(CategoryRule.priority.desc())
    )
    return [(r.keyword.lower(), r.category_id) for r in result.scalars().all()]


def _match_category(description: str, rules: list[tuple[str, UUID]]) -> UUID | None:
    """Match description against keyword rules. First match wins (sorted by priority)."""
    desc_lower = description.lower()
    for keyword, category_id in rules:
        if keyword in desc_lower:
            return category_id
    return None


def _extract_merchant(description: str) -> str | None:
    """Best-effort merchant extraction from transaction description."""
    # Common patterns: "UPI-SWIGGY-..." → "SWIGGY", "POS XXXXX AMAZON" → "AMAZON"
    desc = description.upper().strip()

    # UPI transactions: UPI-<merchant>-<details>
    if desc.startswith("UPI-") or desc.startswith("UPI/"):
        parts = desc.split("-")
        if len(parts) >= 2:
            return parts[1].strip().title()

    # POS transactions
    if "POS" in desc:
        # Remove POS prefix and card numbers
        cleaned = desc.replace("POS ", "").strip()
        # Take first meaningful word
        words = [w for w in cleaned.split() if len(w) > 3 and not w.isdigit()]
        if words:
            return words[0].title()

    # NEFT/IMPS/RTGS
    for prefix in ("NEFT-", "IMPS-", "RTGS-"):
        if desc.startswith(prefix):
            remainder = desc[len(prefix):]
            parts = remainder.split("-")
            if len(parts) >= 2:
                return parts[0].strip().title()

    return None
```

- [ ] **Step 7: Commit**

```bash
git add backend/services/expense_tracker/app/parsers/ backend/services/expense_tracker/app/service_import.py backend/services/expense_tracker/app/service_transfer_detection.py
git commit -m "feat(expense-tracker): add import service, HDFC/Kotak parsers, categorization, transfer detection"
```

---

### Task 8: Routes + Wire Main.py

**Files:**
- Create: `backend/services/expense_tracker/app/routes_accounts.py`
- Create: `backend/services/expense_tracker/app/routes_transactions.py`
- Create: `backend/services/expense_tracker/app/routes_import.py`
- Create: `backend/services/expense_tracker/app/routes_categories.py`
- Create: `backend/services/expense_tracker/app/routes_rules.py`
- Create: `backend/services/expense_tracker/app/routes_dashboard.py`
- Modify: `backend/services/expense_tracker/app/main.py`

- [ ] **Step 1: Create `routes_accounts.py`**

```python
"""Account CRUD routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_accounts as svc
from .schemas import AccountCreate, AccountResponse, AccountUpdate

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/accounts", response_model=list[AccountResponse])
async def list_accounts(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    accounts = await svc.list_accounts(session, user_id)
    return [AccountResponse.model_validate(a) for a in accounts]


@router.post("/accounts", response_model=AccountResponse, status_code=201)
async def create_account(
    body: AccountCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    account = await svc.create_account(session, user_id, **body.model_dump())
    return AccountResponse.model_validate(account)


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: UUID,
    body: AccountUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    account = await svc.update_account(session, user_id, account_id, **body.model_dump(exclude_unset=True))
    return AccountResponse.model_validate(account)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(
    account_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_account(session, user_id, account_id)
```

- [ ] **Step 2: Create `routes_transactions.py`**

```python
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
```

- [ ] **Step 3: Create `routes_import.py`**

```python
"""Statement import route."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from .models import StatementImport
from .schemas import ImportResponse, ImportSummary
from .service_import import import_statement

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.post("/accounts/{account_id}/import", response_model=ImportSummary)
async def import_file(
    account_id: UUID,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    file_bytes = await file.read()
    return await import_statement(session, user_id, account_id, file_bytes, file.filename)


@router.get("/imports", response_model=list[ImportResponse])
async def list_imports(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    account_id: UUID | None = None,
):
    q = (
        select(StatementImport)
        .where(StatementImport.user_id == user_id)
        .order_by(StatementImport.created_at.desc())
    )
    if account_id:
        q = q.where(StatementImport.account_id == account_id)
    result = await session.execute(q)
    return [ImportResponse.model_validate(i) for i in result.scalars().all()]
```

- [ ] **Step 4: Create `routes_categories.py`**

```python
"""Category CRUD routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from . import service_categories as svc
from .schemas import CategoryCreate, CategoryResponse, CategoryUpdate

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/categories", response_model=list[CategoryResponse])
async def list_categories(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    # Seed on first access
    await svc.seed_categories(session, user_id)
    categories = await svc.get_category_tree(session, user_id)
    return [CategoryResponse.model_validate(c) for c in categories]


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(
    body: CategoryCreate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    cat = await svc.create_category(session, user_id, **body.model_dump())
    return CategoryResponse.model_validate(cat)


@router.patch("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(
    category_id: UUID,
    body: CategoryUpdate,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    cat = await svc.update_category(session, user_id, category_id, **body.model_dump(exclude_unset=True))
    return CategoryResponse.model_validate(cat)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(
    category_id: UUID,
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
):
    await svc.delete_category(session, user_id, category_id)
```

- [ ] **Step 5: Create `routes_rules.py`**

```python
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
    result = await session.execute(
        select(CategoryRule)
        .options(joinedload(CategoryRule.category))
        .where(CategoryRule.user_id == user_id)
        .order_by(CategoryRule.priority.desc(), CategoryRule.keyword)
    )
    rules = result.unique().scalars().all()
    return [
        RuleResponse(
            id=r.id, keyword=r.keyword, category_id=r.category_id,
            category_name=r.category.name if r.category else None,
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
```

- [ ] **Step 6: Create `routes_dashboard.py`**

```python
"""Dashboard aggregation routes."""

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import and_, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session as get_async_session
from .models import Account, Category, Transaction
from .schemas import CategoryBreakdown, DashboardSummary, MonthlyTrend, OwnerSplit

router = APIRouter()


def get_user_id(request: Request) -> UUID:
    return UUID(request.state.user_id)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    month: str | None = None,  # "2026-03"
):
    today = date.today()
    if month:
        year, mo = int(month[:4]), int(month[5:])
    else:
        year, mo = today.year, today.month

    # Current month totals (excluding transfers)
    spend = await _sum_for_month(session, user_id, year, mo, "debit")
    income = await _sum_for_month(session, user_id, year, mo, "credit")

    # Previous month
    if mo == 1:
        prev_year, prev_mo = year - 1, 12
    else:
        prev_year, prev_mo = year, mo - 1

    spend_prev = await _sum_for_month(session, user_id, prev_year, prev_mo, "debit")

    mom_pct = None
    if spend_prev and spend_prev > 0:
        mom_pct = float((spend - spend_prev) / spend_prev * 100)

    return DashboardSummary(
        total_spend=spend,
        total_income=income,
        net_savings=income - spend,
        spend_prev_month=spend_prev,
        mom_change_pct=mom_pct,
    )


@router.get("/dashboard/category-breakdown", response_model=list[CategoryBreakdown])
async def category_breakdown(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    month: str | None = None,
):
    today = date.today()
    if month:
        year, mo = int(month[:4]), int(month[5:])
    else:
        year, mo = today.year, today.month

    result = await session.execute(
        select(
            Transaction.category_id,
            func.coalesce(Category.name, "Uncategorized").label("cat_name"),
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.txn_type == "debit",
            Transaction.is_transfer == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == mo,
        )
        .group_by(Transaction.category_id, Category.name)
        .order_by(func.sum(Transaction.amount).desc())
    )

    rows = result.all()
    grand_total = sum(r.total for r in rows) if rows else Decimal("0")

    return [
        CategoryBreakdown(
            category_id=r.category_id,
            category_name=r.cat_name,
            total=r.total,
            percentage=float(r.total / grand_total * 100) if grand_total > 0 else 0,
            transaction_count=r.cnt,
        )
        for r in rows
    ]


@router.get("/dashboard/monthly-trend", response_model=list[MonthlyTrend])
async def monthly_trend(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    months: int = Query(12, le=24),
):
    today = date.today()
    start = date(today.year, today.month, 1) - timedelta(days=30 * months)

    result = await session.execute(
        select(
            func.to_char(Transaction.date, "YYYY-MM").label("month"),
            Transaction.txn_type,
            func.sum(Transaction.amount).label("total"),
        )
        .where(
            Transaction.user_id == user_id,
            Transaction.is_transfer == False,
            Transaction.date >= start,
        )
        .group_by(func.to_char(Transaction.date, "YYYY-MM"), Transaction.txn_type)
        .order_by(func.to_char(Transaction.date, "YYYY-MM"))
    )

    # Pivot into {month: {debit: x, credit: y}}
    monthly = {}
    for row in result.all():
        if row.month not in monthly:
            monthly[row.month] = {"debit": Decimal("0"), "credit": Decimal("0")}
        monthly[row.month][row.txn_type] = row.total

    return [
        MonthlyTrend(month=m, spend=d["debit"], income=d["credit"])
        for m, d in sorted(monthly.items())
    ]


@router.get("/dashboard/owner-split", response_model=list[OwnerSplit])
async def owner_split(
    user_id: UUID = Depends(get_user_id),
    session: AsyncSession = Depends(get_async_session),
    month: str | None = None,
):
    today = date.today()
    if month:
        year, mo = int(month[:4]), int(month[5:])
    else:
        year, mo = today.year, today.month

    result = await session.execute(
        select(
            Account.owner_label,
            Transaction.txn_type,
            func.sum(Transaction.amount).label("total"),
        )
        .join(Account, Transaction.account_id == Account.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.is_transfer == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == mo,
        )
        .group_by(Account.owner_label, Transaction.txn_type)
    )

    owners = {}
    for row in result.all():
        label = row.owner_label or "Unknown"
        if label not in owners:
            owners[label] = {"spend": Decimal("0"), "income": Decimal("0")}
        if row.txn_type == "debit":
            owners[label]["spend"] = row.total
        else:
            owners[label]["income"] = row.total

    return [
        OwnerSplit(owner_label=label, total_spend=d["spend"], total_income=d["income"])
        for label, d in sorted(owners.items())
    ]


async def _sum_for_month(
    session: AsyncSession, user_id: UUID, year: int, month: int, txn_type: str,
) -> Decimal:
    """Sum transaction amounts for a given month, excluding transfers."""
    # Also exclude investment categories from expense totals
    result = await session.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .outerjoin(Category, Transaction.category_id == Category.id)
        .where(
            Transaction.user_id == user_id,
            Transaction.txn_type == txn_type,
            Transaction.is_transfer == False,
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
            # Exclude investment and transfer category groups from spend/income
            ~Category.group_type.in_(["transfer", "investment"]) | (Transaction.category_id.is_(None)),
        )
    )
    return result.scalar() or Decimal("0")
```

- [ ] **Step 7: Update `main.py` to wire all routers**

Add router imports and `include_router` calls to `backend/services/expense_tracker/app/main.py`. After the existing `app.add_middleware(UserIdMiddleware)` line, add:

```python
from .routes_accounts import router as accounts_router
from .routes_transactions import router as transactions_router
from .routes_import import router as import_router
from .routes_categories import router as categories_router
from .routes_rules import router as rules_router
from .routes_dashboard import router as dashboard_router
```

And after `app.add_middleware(UserIdMiddleware)`:

```python
app.include_router(accounts_router, prefix="/api/expenses")
app.include_router(transactions_router, prefix="/api/expenses")
app.include_router(import_router, prefix="/api/expenses")
app.include_router(categories_router, prefix="/api/expenses")
app.include_router(rules_router, prefix="/api/expenses")
app.include_router(dashboard_router, prefix="/api/expenses")
```

- [ ] **Step 8: Verify service starts with all routes**

```bash
cd backend/services/expense_tracker
LOG_LEVEL=DEBUG ../../.venv/bin/uvicorn app.main:app --port 8011
# In another terminal:
curl http://localhost:8011/health
curl http://localhost:8011/docs  # check OpenAPI docs load
```

- [ ] **Step 9: Commit**

```bash
git add backend/services/expense_tracker/app/routes_*.py
git commit -m "feat(expense-tracker): add all API routes and wire routers in main.py"
```

---

### Task 9: Infrastructure Integration

**Files:**
- Modify: `backend/gateway/app/main.py`
- Modify: `backend/gateway/app/routes.py`
- Modify: `infra/scripts/dev-start.sh`
- Modify: `Makefile`

- [ ] **Step 1: Add gateway config**

In `backend/gateway/app/main.py`, add to `GatewayConfig`:

```python
EXPENSE_TRACKER_SERVICE_URL: str = "http://localhost:8011"
```

In the lifespan function, add:

```python
routes_module.EXPENSE_TRACKER_SERVICE_URL = config.EXPENSE_TRACKER_SERVICE_URL
```

- [ ] **Step 2: Add gateway proxy route**

In `backend/gateway/app/routes.py`, add after the portfolio proxy section:

```python
EXPENSE_TRACKER_SERVICE_URL = "http://localhost:8011"
```

To the URL constants at the top, and add the route:

```python
# --- Expense Tracker service proxy ---

@router.api_route("/api/expenses/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_expenses(request: Request, path: str):
    return await proxy_request(request, EXPENSE_TRACKER_SERVICE_URL, f"/api/expenses/{path}")
```

Also add to the `api_root()` response:

```python
"/api/expenses": "Expense Tracker service",
```

- [ ] **Step 3: Update `infra/scripts/dev-start.sh`**

Add log level variable after `PORTFOLIO_LOG` (line ~168):

```bash
EXPENSE_TRACKER_LOG="${expense_tracker:-INFO}"
```

Update the info line (~171) to include expense_tracker in the list.

Add service startup after portfolio and before gateway (~201):

```bash
cd "$ROOT_DIR/backend/services/expense_tracker"
LOG_LEVEL="$EXPENSE_TRACKER_LOG" "$VENV/uvicorn" app.main:app --reload --port 8011 > "$LOG_DIR/expense_tracker.log" 2>&1 &
```

Add wait_for_port after portfolio (~226):

```bash
wait_for_port 8011 "expense_tracker" || all_ok=false
```

Add summary line (~264):

```bash
echo -e "  ${DIM}Expenses API   http://localhost:8011${NC}"
```

- [ ] **Step 4: Update `Makefile`**

Add after `portfolio  ?= $(LOG_LEVEL)` (line 25):

```makefile
expense_tracker ?= $(LOG_LEVEL)
```

Update the `dev` target (line 29) to pass expense_tracker:

```makefile
dev:
	@auth=$(auth) todos=$(todos) notes=$(notes) documents=$(documents) vault=$(vault) kb=$(kb) photos=$(photos) watchlist=$(watchlist) portfolio=$(portfolio) expense_tracker=$(expense_tracker) gateway=$(gateway) bash infra/scripts/dev-start.sh
```

- [ ] **Step 5: Verify with `make dev`**

```bash
make dev expense_tracker=DEBUG
```

Expected: All services start including expense_tracker on :8011. Health check passes.

- [ ] **Step 6: Commit**

```bash
git add backend/gateway/app/main.py backend/gateway/app/routes.py infra/scripts/dev-start.sh Makefile
git commit -m "feat(expense-tracker): integrate with gateway, dev-start, and Makefile"
```

---

### Task 10: Frontend — Store + API Service

**Files:**
- Create: `frontend/modules/expense-tracker/store.js`
- Create: `frontend/modules/expense-tracker/services/expense-api.js`

- [ ] **Step 1: Create module directory**

```bash
mkdir -p frontend/modules/expense-tracker/{pages,components,services}
```

- [ ] **Step 2: Create `store.js`**

```javascript
// Expense Tracker module state store

import { createStore } from '../../shared/services/state-store.js';

const expenseStore = createStore({
  // Navigation
  selectedView: 'dashboard',       // 'dashboard' | 'all' | 'uncategorized' | 'account' | 'categories' | 'rules'
  selectedAccountId: null,

  // Data
  accounts: [],
  transactions: [],
  categories: [],
  rules: [],
  dashboardSummary: null,
  categoryBreakdown: [],
  monthlyTrend: [],
  ownerSplit: [],

  // Filters
  selectedMonth: null,              // "2026-03" or null for current

  // UI
  loading: false,
  error: null,
});

export default expenseStore;
```

- [ ] **Step 3: Create `services/expense-api.js`**

```javascript
// Expense Tracker API service — wraps /api/expenses/* endpoints

import { apiFetch } from '../../../shared/services/api-client.js';

// ── Accounts ───────────────────────────────────────────

export function getAccounts() {
  return apiFetch('/api/expenses/accounts');
}

export function createAccount(data) {
  return apiFetch('/api/expenses/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAccount(id, data) {
  return apiFetch(`/api/expenses/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAccount(id) {
  return apiFetch(`/api/expenses/accounts/${id}`, { method: 'DELETE' });
}

// ── Transactions ───────────────────────────────────────

export function getTransactions(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') query.set(k, v);
  }
  const qs = query.toString();
  return apiFetch(`/api/expenses/transactions${qs ? '?' + qs : ''}`);
}

export function updateTransaction(id, data) {
  return apiFetch(`/api/expenses/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function createTransaction(data) {
  return apiFetch('/api/expenses/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteTransaction(id) {
  return apiFetch(`/api/expenses/transactions/${id}`, { method: 'DELETE' });
}

// ── Import ─────────────────────────────────────────────

export async function importStatement(accountId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const { getAccessToken } = await import('../../../shared/services/auth-store.js');
  const token = getAccessToken();

  const response = await fetch(`/api/expenses/accounts/${accountId}/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Import failed: ${response.status}`);
  }

  return response.json();
}

export function getImports(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') query.set(k, v);
  }
  const qs = query.toString();
  return apiFetch(`/api/expenses/imports${qs ? '?' + qs : ''}`);
}

// ── Categories ─────────────────────────────────────────

export function getCategories() {
  return apiFetch('/api/expenses/categories');
}

export function createCategory(data) {
  return apiFetch('/api/expenses/categories', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateCategory(id, data) {
  return apiFetch(`/api/expenses/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteCategory(id) {
  return apiFetch(`/api/expenses/categories/${id}`, { method: 'DELETE' });
}

// ── Category Rules ─────────────────────────────────────

export function getRules() {
  return apiFetch('/api/expenses/rules');
}

export function createRule(data) {
  return apiFetch('/api/expenses/rules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRule(id, data) {
  return apiFetch(`/api/expenses/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteRule(id) {
  return apiFetch(`/api/expenses/rules/${id}`, { method: 'DELETE' });
}

// ── Dashboard ──────────────────────────────────────────

export function getDashboardSummary(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/expenses/dashboard/summary${qs}`);
}

export function getCategoryBreakdown(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/expenses/dashboard/category-breakdown${qs}`);
}

export function getMonthlyTrend(months = 12) {
  return apiFetch(`/api/expenses/dashboard/monthly-trend?months=${months}`);
}

export function getOwnerSplit(month) {
  const qs = month ? `?month=${month}` : '';
  return apiFetch(`/api/expenses/dashboard/owner-split${qs}`);
}

// ── Tags ───────────────────────────────────────────────

export function getTags() {
  return apiFetch('/api/expenses/tags');
}

export function getTransactionTags(txnId) {
  return apiFetch(`/api/expenses/transactions/${txnId}/tags`);
}

export function addTransactionTag(txnId, name) {
  return apiFetch(`/api/expenses/transactions/${txnId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function removeTransactionTag(txnId, tagId) {
  return apiFetch(`/api/expenses/transactions/${txnId}/tags/${tagId}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/modules/expense-tracker/
git commit -m "feat(expense-tracker): add frontend store and API service"
```

---

### Task 11: Frontend — Sidebar Component

**Files:**
- Create: `frontend/modules/expense-tracker/components/pos-expense-sidebar.js`

- [ ] **Step 1: Create `pos-expense-sidebar.js`**

```javascript
// pos-expense-sidebar — Smart views + accounts grouped by owner

import { SIDEBAR_NAV_SHEET } from '../../../shared/components/pos-sidebar.js';
import { icon } from '../../../shared/utils/icons.js';
import '../../../shared/components/pos-sidebar.js';

const sidebarSheet = new CSSStyleSheet();
sidebarSheet.replaceSync(`
  .owner-label {
    display: flex;
    align-items: center;
    font-size: var(--pos-font-size-xs);
    font-weight: var(--pos-font-weight-medium);
    color: var(--pos-color-text-secondary);
    padding: var(--pos-space-sm) var(--pos-space-sm) 2px 14px;
  }
  .owner-label .hover-action {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: var(--pos-radius-sm);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .owner-label:hover .hover-action { opacity: 1; }
  .owner-label .hover-action:hover {
    background: var(--pos-color-border-default);
    color: var(--pos-color-action-primary);
  }

  .section-label {
    display: flex;
    align-items: center;
  }
  .section-label .hover-action {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: var(--pos-radius-sm);
    color: var(--pos-color-text-secondary);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.1s;
  }
  .section-label:hover .hover-action { opacity: 1; }
  .section-label .hover-action:hover {
    background: var(--pos-color-border-default);
    color: var(--pos-color-action-primary);
  }

  .account-type {
    font-size: 10px;
    color: var(--pos-color-text-tertiary);
    background: var(--pos-color-background-primary);
    border-radius: 3px;
    padding: 0 4px;
    margin-left: 4px;
  }
`);

const ACCOUNT_TYPE_ICONS = {
  savings: 'landmark',
  current: 'landmark',
  credit_card: 'credit-card',
  wallet: 'wallet',
  cash: 'banknote',
};

class PosExpenseSidebar extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [SIDEBAR_NAV_SHEET, sidebarSheet];
    this._accounts = [];
    this._selectedView = 'dashboard';
    this._selectedAccountId = null;
    this._uncategorizedCount = 0;
  }

  set accounts(val) { this._accounts = val || []; this._render(); }
  set selectedView(val) { if (this._selectedView !== val) { this._selectedView = val; this._render(); } }
  set selectedAccountId(val) { if (this._selectedAccountId !== val) { this._selectedAccountId = val; this._render(); } }
  set uncategorizedCount(val) { this._uncategorizedCount = val || 0; this._render(); }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    // Group accounts by owner_label
    const owners = {};
    for (const a of this._accounts) {
      const key = a.owner_label || 'Personal';
      if (!owners[key]) owners[key] = [];
      owners[key].push(a);
    }

    this.shadow.innerHTML = `
      <pos-sidebar title="Expenses">

        <div class="nav-item ${this._selectedView === 'dashboard' ? 'active' : ''}" data-view="dashboard">
          ${icon('bar-chart-2', 15)}
          <span class="nav-label">Dashboard</span>
        </div>
        <div class="nav-item ${this._selectedView === 'all' && !this._selectedAccountId ? 'active' : ''}" data-view="all">
          ${icon('list', 15)}
          <span class="nav-label">All Transactions</span>
        </div>
        <div class="nav-item ${this._selectedView === 'uncategorized' ? 'active' : ''}" data-view="uncategorized">
          ${icon('help-circle', 15)}
          <span class="nav-label">Uncategorized</span>
          ${this._uncategorizedCount > 0 ? `<span class="nav-count">${this._uncategorizedCount}</span>` : ''}
        </div>

        ${Object.keys(owners).length > 0 ? `
          <div class="divider"></div>
          <div class="section-label">
            Accounts
            <span class="hover-action" data-action="create-account" title="New Account">${icon('plus', 13)}</span>
          </div>
        ` : `
          <div class="divider"></div>
          <div class="section-label">Accounts</div>
          <div class="nav-item" data-action="create-account" style="color: var(--pos-color-text-tertiary);">
            ${icon('plus', 14)}
            <span class="nav-label">Add your first account</span>
          </div>
        `}

        ${Object.entries(owners).map(([ownerName, accounts]) => `
          <div class="owner-label">
            ${this._esc(ownerName)}
          </div>
          ${accounts.map(a => `
            <div class="nav-item ${this._selectedAccountId === a.id ? 'active' : ''}"
                 data-view="account" data-id="${a.id}" style="padding-left: 28px;">
              ${icon(ACCOUNT_TYPE_ICONS[a.type] || 'landmark', 14)}
              <span class="nav-label">${this._esc(a.name)}</span>
              <div class="nav-actions">
                <button class="nav-action-btn" data-action="edit-account" data-id="${a.id}" title="Edit">
                  ${icon('edit', 11)}
                </button>
                <button class="nav-action-btn delete" data-action="delete-account" data-id="${a.id}" title="Delete">
                  ${icon('trash', 11)}
                </button>
              </div>
            </div>
          `).join('')}
        `).join('')}

        <div class="divider"></div>
        <div class="nav-item ${this._selectedView === 'categories' ? 'active' : ''}" data-view="categories">
          ${icon('tag', 15)}
          <span class="nav-label">Manage Categories</span>
        </div>
        <div class="nav-item ${this._selectedView === 'rules' ? 'active' : ''}" data-view="rules">
          ${icon('zap', 15)}
          <span class="nav-label">Manage Rules</span>
        </div>

      </pos-sidebar>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        e.stopPropagation();
        const action = actionEl.dataset.action;
        this.dispatchEvent(new CustomEvent(action, {
          bubbles: true, composed: true,
          detail: actionEl.dataset.id ? { accountId: actionEl.dataset.id } : {},
        }));
        return;
      }

      const item = e.target.closest('[data-view]');
      if (!item) return;
      const view = item.dataset.view;
      const id = item.dataset.id || null;

      this.dispatchEvent(new CustomEvent('view-select', {
        bubbles: true, composed: true,
        detail: { view, accountId: id },
      }));
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-sidebar', PosExpenseSidebar);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/modules/expense-tracker/components/pos-expense-sidebar.js
git commit -m "feat(expense-tracker): add sidebar component with smart views and accounts"
```

---

### Task 12: Frontend — Main App Page (Shell)

**Files:**
- Create: `frontend/modules/expense-tracker/pages/pos-expense-tracker-app.js`
- Modify: `frontend/shared/services/router.js`

- [ ] **Step 1: Create `pos-expense-tracker-app.js`** — main two-panel shell that switches content views

```javascript
// pos-expense-tracker-app — 2-panel expense tracker: sidebar + content

import '../../../shared/components/pos-module-layout.js';
import '../../../shared/components/pos-page-header.js';
import '../components/pos-expense-sidebar.js';
import '../components/pos-expense-dashboard.js';
import '../components/pos-expense-transactions.js';
import '../components/pos-expense-account-dialog.js';
import '../components/pos-expense-import-dialog.js';
import { icon } from '../../../shared/utils/icons.js';
import store from '../store.js';
import {
  getAccounts, getTransactions, deleteAccount,
  getDashboardSummary, getCategoryBreakdown, getMonthlyTrend, getOwnerSplit,
} from '../services/expense-api.js';

const TAG = 'pos-expense-tracker-app';

class PosExpenseTrackerApp extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this._unsub = null;
  }

  connectedCallback() {
    this._render();
    this._unsub = store.subscribe(() => this._update());
    this._bindEvents();
    this._loadData();
  }

  disconnectedCallback() {
    this._unsub?.();
  }

  async _loadData() {
    store.setState({ loading: true });
    try {
      const accounts = await getAccounts();
      store.setState({ accounts, loading: false });
      // Load dashboard by default
      this._loadDashboard();
    } catch (err) {
      store.setState({ loading: false, error: err.message });
    }
  }

  async _loadDashboard() {
    const { selectedMonth } = store.getState();
    try {
      const [summary, breakdown, trend, split] = await Promise.all([
        getDashboardSummary(selectedMonth),
        getCategoryBreakdown(selectedMonth),
        getMonthlyTrend(),
        getOwnerSplit(selectedMonth),
      ]);
      store.setState({
        dashboardSummary: summary,
        categoryBreakdown: breakdown,
        monthlyTrend: trend,
        ownerSplit: split,
      });
    } catch (err) {
      console.error('Dashboard load failed:', err);
    }
  }

  async _loadTransactions(params = {}) {
    try {
      const transactions = await getTransactions(params);
      store.setState({ transactions });
    } catch (err) {
      store.setState({ transactions: [] });
    }
  }

  _update() {
    const state = store.getState();
    const sidebar = this.shadow.querySelector('pos-expense-sidebar');
    if (sidebar) {
      sidebar.accounts = state.accounts;
      sidebar.selectedView = state.selectedView;
      sidebar.selectedAccountId = state.selectedAccountId;

      // Count uncategorized
      const uncatCount = (state.transactions || []).filter(t => !t.category_id && !t.is_transfer).length;
      sidebar.uncategorizedCount = uncatCount;
    }

    // Update content components
    const dashboard = this.shadow.querySelector('pos-expense-dashboard');
    if (dashboard) {
      dashboard.summary = state.dashboardSummary;
      dashboard.categoryBreakdown = state.categoryBreakdown;
      dashboard.monthlyTrend = state.monthlyTrend;
      dashboard.ownerSplit = state.ownerSplit;
      dashboard.hidden = state.selectedView !== 'dashboard';
    }

    const txnList = this.shadow.querySelector('pos-expense-transactions');
    if (txnList) {
      txnList.transactions = state.transactions;
      txnList.categories = state.categories;
      txnList.accounts = state.accounts;
      txnList.hidden = state.selectedView === 'dashboard' || state.selectedView === 'categories' || state.selectedView === 'rules';
    }
  }

  _bindEvents() {
    this.shadow.addEventListener('view-select', (e) => {
      const { view, accountId } = e.detail;
      store.setState({
        selectedView: view,
        selectedAccountId: accountId || null,
      });

      if (view === 'dashboard') {
        this._loadDashboard();
      } else if (view === 'account') {
        this._loadTransactions({ account_id: accountId });
      } else if (view === 'uncategorized') {
        this._loadTransactions({ uncategorized_only: true });
      } else if (view === 'all') {
        this._loadTransactions();
      }
    });

    this.shadow.addEventListener('create-account', () => {
      const dialog = this.shadow.querySelector('pos-expense-account-dialog');
      if (dialog) dialog.open();
    });

    this.shadow.addEventListener('edit-account', (e) => {
      const { accountId } = e.detail;
      const account = store.getState().accounts.find(a => a.id === accountId);
      const dialog = this.shadow.querySelector('pos-expense-account-dialog');
      if (dialog && account) dialog.open(account);
    });

    this.shadow.addEventListener('delete-account', async (e) => {
      const { accountId } = e.detail;
      const account = store.getState().accounts.find(a => a.id === accountId);
      if (!account) return;

      const confirmed = confirm(`Delete account "${account.name}"? All transactions will be lost.`);
      if (!confirmed) return;

      await deleteAccount(accountId);
      this._loadData();
    });

    this.shadow.addEventListener('account-saved', () => {
      this._loadData();
    });

    this.shadow.addEventListener('import-complete', () => {
      const state = store.getState();
      if (state.selectedAccountId) {
        this._loadTransactions({ account_id: state.selectedAccountId });
      } else {
        this._loadTransactions();
      }
      this._loadDashboard();
    });

    this.shadow.addEventListener('open-import', (e) => {
      const dialog = this.shadow.querySelector('pos-expense-import-dialog');
      if (dialog) dialog.open(e.detail?.accountId);
    });

    this.shadow.addEventListener('transaction-updated', () => {
      this._loadDashboard();
    });
  }

  _render() {
    this.shadow.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        [hidden] { display: none !important; }
      </style>

      <pos-module-layout>
        <pos-expense-sidebar slot="panel"></pos-expense-sidebar>
        <div class="main">
          <pos-expense-dashboard></pos-expense-dashboard>
          <pos-expense-transactions hidden></pos-expense-transactions>
        </div>
      </pos-module-layout>

      <pos-expense-account-dialog></pos-expense-account-dialog>
      <pos-expense-import-dialog></pos-expense-import-dialog>
    `;
  }
}

customElements.define('pos-expense-tracker-app', PosExpenseTrackerApp);
```

- [ ] **Step 2: Add route in `router.js`**

In `frontend/shared/services/router.js`, add after the portfolio route (line 77):

```javascript
registerRoute('/expenses', { module: 'expense-tracker', label: 'Expenses', icon: 'wallet', group: 'finance' });
```

- [ ] **Step 3: Commit**

```bash
git add frontend/modules/expense-tracker/pages/ frontend/shared/services/router.js
git commit -m "feat(expense-tracker): add main app shell and register route"
```

---

### Task 13: Frontend — Dashboard Component

**Files:**
- Create: `frontend/modules/expense-tracker/components/pos-expense-dashboard.js`

- [ ] **Step 1: Create `pos-expense-dashboard.js`** — summary cards + category breakdown + trend + owner split

This is a display-only component receiving data via properties. It renders summary cards, a category bar breakdown, and owner split. Charts are simple CSS-based (no external library needed for Phase 1).

```javascript
// pos-expense-dashboard — Overview dashboard with summary cards and breakdowns

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: block; padding: var(--pos-space-lg); overflow-y: auto; }
  :host([hidden]) { display: none; }

  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--pos-space-md); margin-bottom: var(--pos-space-lg); }
  .card {
    background: var(--pos-color-background-secondary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    padding: var(--pos-space-md);
  }
  .card-label { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--pos-space-xs); }
  .card-value { font-size: var(--pos-font-size-xl); font-weight: var(--pos-font-weight-bold); color: var(--pos-color-text-primary); }
  .card-value.positive { color: var(--pos-color-status-success); }
  .card-value.negative { color: var(--pos-color-status-error); }
  .card-change { font-size: var(--pos-font-size-xs); color: var(--pos-color-text-secondary); margin-top: 2px; }

  .section-title { font-size: var(--pos-font-size-md); font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-primary); margin-bottom: var(--pos-space-sm); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: var(--pos-space-lg); margin-bottom: var(--pos-space-lg); }

  .breakdown-list { display: flex; flex-direction: column; gap: var(--pos-space-xs); }
  .breakdown-row { display: flex; align-items: center; gap: var(--pos-space-sm); font-size: var(--pos-font-size-sm); }
  .breakdown-name { flex: 1; color: var(--pos-color-text-primary); }
  .breakdown-amount { font-weight: var(--pos-font-weight-medium); color: var(--pos-color-text-primary); }
  .breakdown-pct { color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-xs); width: 40px; text-align: right; }
  .breakdown-bar { height: 6px; border-radius: 3px; background: var(--pos-color-border-default); flex: 0 0 100px; overflow: hidden; }
  .breakdown-bar-fill { height: 100%; border-radius: 3px; background: var(--pos-color-action-primary); }

  .owner-cards { display: flex; gap: var(--pos-space-md); }
  .owner-card {
    flex: 1;
    background: var(--pos-color-background-secondary);
    border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-md);
    padding: var(--pos-space-md);
  }
  .owner-name { font-weight: var(--pos-font-weight-semibold); margin-bottom: var(--pos-space-xs); }
  .owner-stat { font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); }
  .owner-stat span { font-weight: var(--pos-font-weight-medium); color: var(--pos-color-text-primary); }

  .empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
`);

class PosExpenseDashboard extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._summary = null;
    this._categoryBreakdown = [];
    this._monthlyTrend = [];
    this._ownerSplit = [];
  }

  set summary(val) { this._summary = val; this._render(); }
  set categoryBreakdown(val) { this._categoryBreakdown = val || []; this._render(); }
  set monthlyTrend(val) { this._monthlyTrend = val || []; this._render(); }
  set ownerSplit(val) { this._ownerSplit = val || []; this._render(); }

  connectedCallback() { this._render(); }

  _render() {
    const s = this._summary;
    if (!s) {
      this.shadow.innerHTML = '<div class="empty">Import a statement to see your dashboard</div>';
      return;
    }

    const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
    const momStr = s.mom_change_pct !== null ? `${s.mom_change_pct > 0 ? '+' : ''}${s.mom_change_pct.toFixed(1)}% vs last month` : '';

    this.shadow.innerHTML = `
      <div class="grid">
        <div class="card">
          <div class="card-label">Total Spend</div>
          <div class="card-value">${fmt(s.total_spend)}</div>
          ${momStr ? `<div class="card-change">${momStr}</div>` : ''}
        </div>
        <div class="card">
          <div class="card-label">Income</div>
          <div class="card-value positive">${fmt(s.total_income)}</div>
        </div>
        <div class="card">
          <div class="card-label">Net Savings</div>
          <div class="card-value ${Number(s.net_savings) >= 0 ? 'positive' : 'negative'}">${fmt(s.net_savings)}</div>
        </div>
        <div class="card">
          <div class="card-label">Last Month</div>
          <div class="card-value">${fmt(s.spend_prev_month)}</div>
        </div>
      </div>

      <div class="two-col">
        <div>
          <div class="section-title">Spending by Category</div>
          <div class="breakdown-list">
            ${this._categoryBreakdown.slice(0, 10).map(c => `
              <div class="breakdown-row">
                <span class="breakdown-name">${this._esc(c.category_name)}</span>
                <div class="breakdown-bar"><div class="breakdown-bar-fill" style="width: ${c.percentage}%"></div></div>
                <span class="breakdown-pct">${c.percentage.toFixed(0)}%</span>
                <span class="breakdown-amount">${fmt(c.total)}</span>
              </div>
            `).join('') || '<div style="color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-sm);">No data yet</div>'}
          </div>
        </div>

        <div>
          <div class="section-title">By Family Member</div>
          <div class="owner-cards">
            ${this._ownerSplit.map(o => `
              <div class="owner-card">
                <div class="owner-name">${this._esc(o.owner_label)}</div>
                <div class="owner-stat">Spend: <span>${fmt(o.total_spend)}</span></div>
                <div class="owner-stat">Income: <span>${fmt(o.total_income)}</span></div>
              </div>
            `).join('') || '<div style="color: var(--pos-color-text-secondary); font-size: var(--pos-font-size-sm);">No data yet</div>'}
          </div>
        </div>
      </div>
    `;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-dashboard', PosExpenseDashboard);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/modules/expense-tracker/components/pos-expense-dashboard.js
git commit -m "feat(expense-tracker): add dashboard component with summary cards and breakdowns"
```

---

### Task 14: Frontend — Transaction List Component

**Files:**
- Create: `frontend/modules/expense-tracker/components/pos-expense-transactions.js`

- [ ] **Step 1: Create `pos-expense-transactions.js`** — filterable transaction table with inline category edit

```javascript
// pos-expense-transactions — Transaction table with inline category edit, filters, import button

import { TABLE_STYLES } from '../../../../design-system/dist/pos-design-system.js';
import { icon } from '../../../shared/utils/icons.js';
import { updateTransaction } from '../services/expense-api.js';
import store from '../store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  :host([hidden]) { display: none; }

  .header { display: flex; align-items: center; gap: var(--pos-space-sm); padding: var(--pos-space-md) var(--pos-space-lg) var(--pos-space-sm); flex-shrink: 0; }
  .header h2 { margin: 0; font-size: var(--pos-font-size-lg); font-weight: var(--pos-font-weight-bold); flex: 1; }
  .header-btn {
    display: inline-flex; align-items: center; gap: var(--pos-space-xs);
    padding: 6px 12px; border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); cursor: pointer; border: none;
    background: var(--pos-color-action-primary); color: white;
  }
  .header-btn:hover { opacity: 0.9; }

  .filters { display: flex; gap: var(--pos-space-sm); padding: 0 var(--pos-space-lg) var(--pos-space-sm); flex-shrink: 0; }
  .filters input, .filters select {
    padding: 4px 8px; border: 1px solid var(--pos-color-border-default); border-radius: var(--pos-radius-sm);
    font-size: var(--pos-font-size-sm); background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
  }

  .scroll { flex: 1; overflow-y: auto; padding: 0 var(--pos-space-lg) var(--pos-space-lg); }

  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: var(--pos-font-size-xs); font-weight: var(--pos-font-weight-semibold); color: var(--pos-color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; padding: var(--pos-space-xs) var(--pos-space-sm); border-bottom: 1px solid var(--pos-color-border-default); position: sticky; top: 0; background: var(--pos-color-background-primary); }
  td { padding: var(--pos-space-xs) var(--pos-space-sm); font-size: var(--pos-font-size-sm); border-bottom: 1px solid var(--pos-color-border-subtle, var(--pos-color-border-default)); color: var(--pos-color-text-primary); }

  .amount-debit { color: var(--pos-color-status-error); font-weight: var(--pos-font-weight-medium); }
  .amount-credit { color: var(--pos-color-status-success); font-weight: var(--pos-font-weight-medium); }

  .transfer-badge {
    display: inline-block; font-size: 10px; padding: 1px 6px; border-radius: 3px;
    background: var(--pos-color-background-secondary); color: var(--pos-color-text-secondary);
  }

  .category-cell { cursor: pointer; }
  .category-cell:hover { text-decoration: underline; }
  .uncat { color: var(--pos-color-text-tertiary); font-style: italic; }

  .empty { text-align: center; padding: var(--pos-space-xl); color: var(--pos-color-text-secondary); }
`);

class PosExpenseTransactions extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._transactions = [];
    this._categories = [];
    this._accounts = [];
  }

  set transactions(val) { this._transactions = val || []; this._render(); }
  set categories(val) { this._categories = val || []; }
  set accounts(val) { this._accounts = val || []; }

  connectedCallback() {
    this._bindEvents();
    this._render();
  }

  _render() {
    const txns = this._transactions;
    const state = store.getState();
    const account = state.selectedAccountId
      ? state.accounts.find(a => a.id === state.selectedAccountId)
      : null;

    const title = account ? account.name : (
      state.selectedView === 'uncategorized' ? 'Uncategorized' : 'All Transactions'
    );

    const fmt = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

    this.shadow.innerHTML = `
      <div class="header">
        <h2>${this._esc(title)}</h2>
        ${account ? `<button class="header-btn" data-action="import">${icon('upload', 14)} Import</button>` : ''}
      </div>

      <div class="scroll">
        ${txns.length === 0 ? `
          <div class="empty">
            ${account ? 'No transactions yet. Import a statement to get started.' : 'No transactions found.'}
          </div>
        ` : `
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th style="text-align:right">Amount</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              ${txns.map(t => `
                <tr>
                  <td>${t.date}</td>
                  <td>
                    ${this._esc(t.merchant || t.description)}
                    ${t.is_transfer ? '<span class="transfer-badge">Transfer</span>' : ''}
                    ${t.merchant && t.merchant !== t.description ? `<br><span style="font-size:11px;color:var(--pos-color-text-tertiary)">${this._esc(t.description.substring(0, 60))}</span>` : ''}
                  </td>
                  <td class="category-cell" data-action="change-category" data-txn-id="${t.id}">
                    ${t.category_name ? this._esc(t.category_name) : '<span class="uncat">Uncategorized</span>'}
                  </td>
                  <td style="text-align:right" class="${t.txn_type === 'debit' ? 'amount-debit' : 'amount-credit'}">
                    ${t.txn_type === 'debit' ? '-' : '+'}${fmt(t.amount)}
                  </td>
                  <td style="font-size:12px;color:var(--pos-color-text-secondary)">${this._esc(t.account_name || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', async (e) => {
      const actionEl = e.target.closest('[data-action]');
      if (!actionEl) return;

      if (actionEl.dataset.action === 'import') {
        this.dispatchEvent(new CustomEvent('open-import', {
          bubbles: true, composed: true,
          detail: { accountId: store.getState().selectedAccountId },
        }));
      }

      if (actionEl.dataset.action === 'change-category') {
        // Simple prompt for now — will be replaced with dropdown in polish phase
        const txnId = actionEl.dataset.txnId;
        const categories = store.getState().categories || [];
        if (categories.length === 0) {
          // Load categories if not cached
          const { getCategories } = await import('../services/expense-api.js');
          const cats = await getCategories();
          store.setState({ categories: cats });
        }

        const cats = store.getState().categories;
        const leafCats = cats.filter(c => c.parent_id); // subcategories only
        const options = leafCats.map((c, i) => `${i + 1}. ${c.name}`).join('\n');
        const choice = prompt(`Select category:\n${options}\n\nEnter number:`);
        if (!choice) return;

        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < leafCats.length) {
          await updateTransaction(txnId, { category_id: leafCats[idx].id });
          // Refresh
          this.dispatchEvent(new CustomEvent('transaction-updated', { bubbles: true, composed: true }));

          const state = store.getState();
          const { getTransactions } = await import('../services/expense-api.js');
          const params = {};
          if (state.selectedAccountId) params.account_id = state.selectedAccountId;
          if (state.selectedView === 'uncategorized') params.uncategorized_only = true;
          const txns = await getTransactions(params);
          store.setState({ transactions: txns });
        }
      }
    });
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }
}

customElements.define('pos-expense-transactions', PosExpenseTransactions);
```

- [ ] **Step 2: Commit**

```bash
git add frontend/modules/expense-tracker/components/pos-expense-transactions.js
git commit -m "feat(expense-tracker): add transaction list with inline category edit"
```

---

### Task 15: Frontend — Account Dialog + Import Dialog

**Files:**
- Create: `frontend/modules/expense-tracker/components/pos-expense-account-dialog.js`
- Create: `frontend/modules/expense-tracker/components/pos-expense-import-dialog.js`

- [ ] **Step 1: Create `pos-expense-account-dialog.js`**

```javascript
// pos-expense-account-dialog — Create/edit account dialog

import { createAccount, updateAccount } from '../services/expense-api.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: none; position: fixed; inset: 0; z-index: 2000; }
  :host([open]) { display: flex; align-items: center; justify-content: center; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
  .dialog {
    position: relative; background: var(--pos-color-background-primary);
    border-radius: var(--pos-radius-lg); padding: var(--pos-space-lg);
    min-width: 400px; max-width: 480px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  h3 { margin: 0 0 var(--pos-space-md); }
  .form-group { margin-bottom: var(--pos-space-sm); }
  label { display: block; font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); margin-bottom: 4px; }
  input, select {
    width: 100%; padding: 8px; border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
    background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
    box-sizing: border-box;
  }
  .actions { display: flex; justify-content: flex-end; gap: var(--pos-space-sm); margin-top: var(--pos-space-md); }
  button {
    padding: 8px 16px; border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
    cursor: pointer; border: 1px solid var(--pos-color-border-default);
    background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
  }
  button.primary { background: var(--pos-color-action-primary); color: white; border: none; }
  .close-btn {
    position: absolute; top: 12px; right: 12px; background: none; border: none;
    cursor: pointer; color: var(--pos-color-text-secondary); font-size: 18px; padding: 4px;
  }
`);

const BANKS = ['HDFC', 'Kotak', 'Standard Chartered', 'Bank of Baroda', 'Canara Bank', 'SBI', 'ICICI', 'Axis', 'IDFC First', 'Yes Bank', 'Other'];

class PosExpenseAccountDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._account = null;
  }

  open(account = null) {
    this._account = account;
    this._render();
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
    this._account = null;
  }

  connectedCallback() {
    this._bindEvents();
  }

  _render() {
    const a = this._account;
    const isEdit = !!a;

    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <button class="close-btn" data-action="close">&times;</button>
        <h3>${isEdit ? 'Edit Account' : 'New Account'}</h3>
        <form>
          <div class="form-group">
            <label>Account Name</label>
            <input name="name" value="${a?.name || ''}" placeholder="e.g. HDFC Savings" required>
          </div>
          <div class="form-group">
            <label>Bank</label>
            <select name="bank">
              ${BANKS.map(b => `<option value="${b}" ${a?.bank === b ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Type</label>
            <select name="type">
              <option value="savings" ${a?.type === 'savings' ? 'selected' : ''}>Savings</option>
              <option value="current" ${a?.type === 'current' ? 'selected' : ''}>Current</option>
              <option value="credit_card" ${a?.type === 'credit_card' ? 'selected' : ''}>Credit Card</option>
              <option value="wallet" ${a?.type === 'wallet' ? 'selected' : ''}>Wallet</option>
              <option value="cash" ${a?.type === 'cash' ? 'selected' : ''}>Cash</option>
            </select>
          </div>
          <div class="form-group">
            <label>Owner</label>
            <input name="owner_label" value="${a?.owner_label || ''}" placeholder="e.g. Pankaj, Wife">
          </div>
          <div class="form-group">
            <label>Account Number (masked)</label>
            <input name="account_number_masked" value="${a?.account_number_masked || ''}" placeholder="e.g. XX1234">
          </div>
          <div class="actions">
            <button type="button" data-action="close">Cancel</button>
            <button type="submit" class="primary">${isEdit ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) {
        this.close();
      }
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this.shadow.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = {
        name: form.name.value.trim(),
        bank: form.bank.value,
        type: form.type.value,
        owner_label: form.owner_label.value.trim(),
        account_number_masked: form.account_number_masked.value.trim() || null,
      };

      try {
        if (this._account) {
          await updateAccount(this._account.id, data);
        } else {
          await createAccount(data);
        }
        this.close();
        this.dispatchEvent(new CustomEvent('account-saved', { bubbles: true, composed: true }));
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

customElements.define('pos-expense-account-dialog', PosExpenseAccountDialog);
```

- [ ] **Step 2: Create `pos-expense-import-dialog.js`**

```javascript
// pos-expense-import-dialog — Import statement file upload

import { importStatement } from '../services/expense-api.js';
import store from '../store.js';

const sheet = new CSSStyleSheet();
sheet.replaceSync(`
  :host { display: none; position: fixed; inset: 0; z-index: 2000; }
  :host([open]) { display: flex; align-items: center; justify-content: center; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.5); }
  .dialog {
    position: relative; background: var(--pos-color-background-primary);
    border-radius: var(--pos-radius-lg); padding: var(--pos-space-lg);
    min-width: 420px; max-width: 500px; box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  h3 { margin: 0 0 var(--pos-space-md); }
  .form-group { margin-bottom: var(--pos-space-sm); }
  label { display: block; font-size: var(--pos-font-size-sm); color: var(--pos-color-text-secondary); margin-bottom: 4px; }
  select, input[type="file"] {
    width: 100%; padding: 8px; border: 1px solid var(--pos-color-border-default);
    border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
    background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
    box-sizing: border-box;
  }
  .actions { display: flex; justify-content: flex-end; gap: var(--pos-space-sm); margin-top: var(--pos-space-md); }
  button {
    padding: 8px 16px; border-radius: var(--pos-radius-sm); font-size: var(--pos-font-size-sm);
    cursor: pointer; border: 1px solid var(--pos-color-border-default);
    background: var(--pos-color-background-primary); color: var(--pos-color-text-primary);
  }
  button.primary { background: var(--pos-color-action-primary); color: white; border: none; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .close-btn {
    position: absolute; top: 12px; right: 12px; background: none; border: none;
    cursor: pointer; color: var(--pos-color-text-secondary); font-size: 18px; padding: 4px;
  }
  .result { margin-top: var(--pos-space-md); padding: var(--pos-space-sm); border-radius: var(--pos-radius-sm); background: var(--pos-color-background-secondary); font-size: var(--pos-font-size-sm); }
  .result-line { display: flex; justify-content: space-between; padding: 2px 0; }
  .result-value { font-weight: var(--pos-font-weight-medium); }
  .error { color: var(--pos-color-status-error); margin-top: var(--pos-space-sm); font-size: var(--pos-font-size-sm); }
`);

class PosExpenseImportDialog extends HTMLElement {
  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.adoptedStyleSheets = [sheet];
    this._accountId = null;
    this._importing = false;
    this._result = null;
    this._error = null;
  }

  open(accountId = null) {
    this._accountId = accountId;
    this._result = null;
    this._error = null;
    this._importing = false;
    this._render();
    this.setAttribute('open', '');
  }

  close() {
    this.removeAttribute('open');
    if (this._result) {
      this.dispatchEvent(new CustomEvent('import-complete', { bubbles: true, composed: true }));
    }
  }

  connectedCallback() {
    this._bindEvents();
  }

  _render() {
    const accounts = store.getState().accounts || [];

    this.shadow.innerHTML = `
      <div class="backdrop"></div>
      <div class="dialog">
        <button class="close-btn" data-action="close">&times;</button>
        <h3>Import Statement</h3>
        <form>
          <div class="form-group">
            <label>Account</label>
            <select name="account_id" ${this._accountId ? 'disabled' : ''}>
              ${accounts.map(a => `
                <option value="${a.id}" ${a.id === this._accountId ? 'selected' : ''}>
                  ${a.name} (${a.bank})
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Statement File (CSV, XLS, XLSX)</label>
            <input type="file" name="file" accept=".csv,.xls,.xlsx" required>
          </div>
          <div class="actions">
            <button type="button" data-action="close">Cancel</button>
            <button type="submit" class="primary" ${this._importing ? 'disabled' : ''}>
              ${this._importing ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
        ${this._error ? `<div class="error">${this._error}</div>` : ''}
        ${this._result ? this._renderResult() : ''}
      </div>
    `;
  }

  _renderResult() {
    const r = this._result;
    return `
      <div class="result">
        <div class="result-line"><span>Total parsed</span><span class="result-value">${r.total_parsed}</span></div>
        <div class="result-line"><span>New transactions</span><span class="result-value">${r.new_transactions}</span></div>
        <div class="result-line"><span>Duplicates skipped</span><span class="result-value">${r.duplicates_skipped}</span></div>
        <div class="result-line"><span>Auto-categorized</span><span class="result-value">${r.auto_categorized}</span></div>
        <div class="result-line"><span>Uncategorized</span><span class="result-value">${r.uncategorized}</span></div>
        <div class="result-line"><span>Transfers detected</span><span class="result-value">${r.transfers_detected}</span></div>
      </div>
    `;
  }

  _bindEvents() {
    this.shadow.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="close"]')) this.close();
    });

    this.shadow.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });

    this.shadow.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const accountId = this._accountId || form.account_id.value;
      const file = form.file.files[0];
      if (!file || !accountId) return;

      this._importing = true;
      this._error = null;
      this._render();

      try {
        this._result = await importStatement(accountId, file);
        this._importing = false;
        this._render();
      } catch (err) {
        this._importing = false;
        this._error = err.message;
        this._render();
      }
    });
  }
}

customElements.define('pos-expense-import-dialog', PosExpenseImportDialog);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/modules/expense-tracker/components/pos-expense-account-dialog.js frontend/modules/expense-tracker/components/pos-expense-import-dialog.js
git commit -m "feat(expense-tracker): add account and import dialogs"
```

---

### Task 16: End-to-End Verification

- [ ] **Step 1: Start the stack**

```bash
make dev expense_tracker=DEBUG
```

- [ ] **Step 2: Verify backend health**

```bash
curl http://localhost:8011/health
# Expected: {"status":"ok","service":"pos-expense-tracker"}

curl http://localhost:8000/api/expenses/accounts -H "Authorization: Bearer <token>"
# Expected: [] (empty list)
```

- [ ] **Step 3: Test account creation via API**

```bash
curl -X POST http://localhost:8000/api/expenses/accounts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "HDFC Savings", "bank": "HDFC", "type": "savings", "owner_label": "Pankaj"}'
```

- [ ] **Step 4: Test category seeding**

```bash
curl http://localhost:8000/api/expenses/categories -H "Authorization: Bearer <token>"
# Expected: Full category tree with seeded Indian taxonomy
```

- [ ] **Step 5: Open the app in browser**

Navigate to http://localhost:3001/#/expenses. Verify:
- Sidebar renders with smart views (Dashboard, All Transactions, Uncategorized)
- "Add your first account" prompt shows
- Creating an account via dialog works
- Import dialog opens for the account
- Import a test CSV/Excel file from HDFC or Kotak
- Transactions appear in the list
- Dashboard shows summary data
- Category edit (prompt-based) works

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(expense-tracker): complete Phase 1 — accounts, import, categorization, dashboard"
```

---

### Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Service skeleton | main.py, config.py, db.py |
| 2 | Models | models.py (5 tables) |
| 3 | Alembic + migration | alembic.ini, env.py, 001 migration |
| 4 | Schemas | schemas.py (all Pydantic models) |
| 5 | Category service + seeding | service_categories.py |
| 6 | Account + transaction services | service_accounts.py, service_transactions.py |
| 7 | Import + parsers + transfer detection | service_import.py, parsers/, service_transfer_detection.py |
| 8 | Routes + wire main.py | 6 route files |
| 9 | Infrastructure integration | gateway, dev-start.sh, Makefile |
| 10 | Frontend store + API | store.js, expense-api.js |
| 11 | Sidebar component | pos-expense-sidebar.js |
| 12 | Main app shell + routing | pos-expense-tracker-app.js, router.js |
| 13 | Dashboard component | pos-expense-dashboard.js |
| 14 | Transaction list | pos-expense-transactions.js |
| 15 | Account + import dialogs | pos-expense-account-dialog.js, pos-expense-import-dialog.js |
| 16 | End-to-end verification | Manual testing |
