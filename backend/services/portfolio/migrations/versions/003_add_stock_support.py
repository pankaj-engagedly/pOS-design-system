"""Add stock support: asset_class on transactions, import_type on cas_imports, stock_price_cache table.

Revision ID: 003
Revises: 002
Create Date: 2026-03-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Transaction: add asset_class and exchange columns ──
    op.add_column("transactions", sa.Column("asset_class", sa.String(20), nullable=True))
    op.add_column("transactions", sa.Column("exchange", sa.String(10), nullable=True))
    # Backfill existing rows as mutual_fund
    op.execute("UPDATE transactions SET asset_class = 'mutual_fund' WHERE asset_class IS NULL")
    op.alter_column("transactions", "asset_class", nullable=False, server_default="mutual_fund")
    op.create_index("ix_transactions_asset_class", "transactions", ["portfolio_id", "asset_class"])

    # ── CASImport: add import_type column ──
    op.add_column("cas_imports", sa.Column("import_type", sa.String(30), nullable=True))
    op.execute("UPDATE cas_imports SET import_type = 'cas_pdf' WHERE import_type IS NULL")
    op.alter_column("cas_imports", "import_type", nullable=False, server_default="cas_pdf")
    # Widen source_type to accommodate broker names
    op.alter_column("cas_imports", "source_type", type_=sa.String(50))

    # ── Stock Price Cache table ──
    op.create_table(
        "stock_price_cache",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("isin", sa.String(20), nullable=True),
        sa.Column("company_name", sa.String(500), nullable=True),
        sa.Column("exchange", sa.String(10), nullable=False, server_default="NSE"),
        sa.Column("price", sa.Numeric(18, 4), nullable=False),
        sa.Column("price_date", sa.Date, nullable=False),
        sa.UniqueConstraint("symbol", "exchange", "price_date", name="uq_stock_price_symbol_date"),
    )
    op.create_index("ix_stock_price_symbol", "stock_price_cache", ["symbol"])
    op.create_index("ix_stock_price_isin", "stock_price_cache", ["isin"])


def downgrade() -> None:
    op.drop_index("ix_stock_price_isin", "stock_price_cache")
    op.drop_index("ix_stock_price_symbol", "stock_price_cache")
    op.drop_table("stock_price_cache")

    op.drop_column("cas_imports", "import_type")
    op.alter_column("cas_imports", "source_type", type_=sa.String(20))

    op.drop_index("ix_transactions_asset_class", "transactions")
    op.drop_column("transactions", "exchange")
    op.drop_column("transactions", "asset_class")
