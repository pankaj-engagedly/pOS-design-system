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
    type = Column(String(30), nullable=False)
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
    group_type = Column(String(20), nullable=False, server_default="expense")

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
    source = Column(String(20), nullable=False, server_default="system")

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
    txn_type = Column(String(10), nullable=False)
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
    file_type = Column(String(10), nullable=False)
    bank = Column(String(100), nullable=False)
    period_start = Column(Date, nullable=True)
    period_end = Column(Date, nullable=True)
    total_transactions = Column(Integer, nullable=False, server_default="0")
    new_transactions = Column(Integer, nullable=False, server_default="0")
    status = Column(String(20), nullable=False, server_default="processing")
    error_message = Column(Text, nullable=True)

    account = relationship("Account", back_populates="imports")
    transactions = relationship("Transaction", back_populates="statement_import")
