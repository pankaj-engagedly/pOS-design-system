"""Create expense tracker tables — accounts, categories, rules, imports, transactions.

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
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
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
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
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
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_expense_category_rules_user_id", "expense_category_rules", ["user_id"])
    op.create_unique_constraint(
        "uq_expense_rules_user_keyword", "expense_category_rules", ["user_id", "keyword"]
    )

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
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
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
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_expense_transactions_account_hash", "expense_transactions", ["account_id", "hash"]
    )
    op.create_index("ix_expense_transactions_user_id", "expense_transactions", ["user_id"])
    op.create_index("ix_expense_transactions_account", "expense_transactions", ["account_id"])
    op.create_index("ix_expense_transactions_date", "expense_transactions", ["user_id", "date"])
    op.create_index("ix_expense_transactions_category", "expense_transactions", ["category_id"])


def downgrade() -> None:
    op.drop_table("expense_transactions")
    op.drop_table("expense_statement_imports")
    op.drop_table("expense_category_rules")
    op.drop_table("expense_categories")
    op.drop_table("expense_accounts")
