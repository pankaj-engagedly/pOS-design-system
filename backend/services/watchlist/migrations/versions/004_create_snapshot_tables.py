"""Create metric_snapshots and financial_statements tables for historical tracking.

Revision ID: 004
Revises: 003
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Daily metric snapshots — one JSONB row per item per day
    op.create_table(
        "metric_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("watchlist_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recorded_date", sa.Date(), nullable=False),
        sa.Column("metrics", postgresql.JSONB(), nullable=False),  # all cached values as {key: value}
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["watchlist_item_id"], ["watchlist_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("watchlist_item_id", "recorded_date", name="uq_metric_snapshots_item_date"),
    )
    op.create_index("ix_metric_snapshots_item_date", "metric_snapshots", ["watchlist_item_id", "recorded_date"])

    # Accumulated financial statements — one row per statement per fiscal period
    op.create_table(
        "financial_statements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("watchlist_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("statement_type", sa.String(20), nullable=False),  # income, balance, cashflow
        sa.Column("fiscal_period", sa.Date(), nullable=False),  # fiscal period end date
        sa.Column("line_items", postgresql.JSONB(), nullable=False),  # {line_item_name: value, ...}
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["watchlist_item_id"], ["watchlist_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("watchlist_item_id", "statement_type", "fiscal_period", name="uq_financial_stmt_item_type_period"),
    )
    op.create_index("ix_financial_statements_item_type", "financial_statements", ["watchlist_item_id", "statement_type"])


def downgrade() -> None:
    op.drop_table("financial_statements")
    op.drop_table("metric_snapshots")
