"""Create portfolio, CAS imports, transactions, and NAV cache tables.

Revision ID: 001
Create Date: 2026-03-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Portfolios
    op.create_table(
        "portfolios",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("holder_name", sa.String(200), nullable=False),
        sa.Column("pan_encrypted", sa.Text, nullable=True),
        sa.Column("email", sa.String(200), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # CAS Imports
    op.create_table(
        "cas_imports",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("transaction_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duplicates_skipped", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="completed"),
        sa.Column("raw_file_path", sa.Text, nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_cas_imports_portfolio", "cas_imports", ["portfolio_id"])

    # Transactions
    op.create_table(
        "transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("portfolio_id", UUID(as_uuid=True), sa.ForeignKey("portfolios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("import_id", UUID(as_uuid=True), sa.ForeignKey("cas_imports.id", ondelete="SET NULL"), nullable=True),
        sa.Column("folio_number", sa.String(50), nullable=False),
        sa.Column("amc_name", sa.String(300), nullable=False),
        sa.Column("scheme_name", sa.String(500), nullable=False),
        sa.Column("scheme_isin", sa.String(20), nullable=True),
        sa.Column("amfi_code", sa.String(20), nullable=True),
        sa.Column("transaction_date", sa.Date, nullable=False),
        sa.Column("transaction_type", sa.String(30), nullable=False),
        sa.Column("amount", sa.Numeric(18, 4), nullable=False),
        sa.Column("units", sa.Numeric(18, 4), nullable=False),
        sa.Column("nav", sa.Numeric(18, 4), nullable=True),
        sa.Column("balance_units", sa.Numeric(18, 4), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_unique_constraint(
        "uq_transactions_dedup", "transactions",
        ["portfolio_id", "folio_number", "scheme_isin", "transaction_date", "transaction_type", "amount", "units"],
    )
    op.create_index("ix_transactions_portfolio", "transactions", ["portfolio_id"])
    op.create_index("ix_transactions_scheme", "transactions", ["portfolio_id", "scheme_isin"])
    op.create_index("ix_transactions_date", "transactions", ["portfolio_id", "transaction_date"])

    # NAV Cache
    op.create_table(
        "nav_cache",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("amfi_code", sa.String(20), nullable=False),
        sa.Column("scheme_name", sa.String(500), nullable=True),
        sa.Column("nav", sa.Numeric(18, 4), nullable=False),
        sa.Column("nav_date", sa.Date, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_unique_constraint("uq_nav_cache_code_date", "nav_cache", ["amfi_code", "nav_date"])
    op.create_index("ix_nav_cache_amfi_code", "nav_cache", ["amfi_code"])


def downgrade() -> None:
    op.drop_table("nav_cache")
    op.drop_table("transactions")
    op.drop_table("cas_imports")
    op.drop_table("portfolios")
