"""Create watchlist tables: pipeline_stages, watchlist_themes, watchlist_items, market_data_cache.

Revision ID: 001
Revises:
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Pipeline stages
    op.create_table(
        "pipeline_stages",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("is_terminal", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "slug", name="uq_pipeline_stages_user_slug"),
    )
    op.create_index("ix_pipeline_stages_user_position", "pipeline_stages", ["user_id", "position"])

    # Watchlist themes
    op.create_table(
        "watchlist_themes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["parent_id"], ["watchlist_themes.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("user_id", "name", "parent_id", name="uq_watchlist_themes_user_name_parent"),
    )
    op.create_index("ix_watchlist_themes_user_parent", "watchlist_themes", ["user_id", "parent_id"])

    # Watchlist items
    op.create_table(
        "watchlist_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("exchange", sa.String(20), nullable=True),
        sa.Column("stage_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("theme_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("added_reason", sa.Text(), nullable=True),
        sa.Column("is_favourite", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["stage_id"], ["pipeline_stages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["theme_id"], ["watchlist_themes.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("user_id", "symbol", name="uq_watchlist_items_user_symbol"),
    )
    op.create_index("ix_watchlist_items_user_asset_type", "watchlist_items", ["user_id", "asset_type"])
    op.create_index("ix_watchlist_items_user_stage", "watchlist_items", ["user_id", "stage_id"])

    # Market data cache
    op.create_table(
        "market_data_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("watchlist_item_id", postgresql.UUID(as_uuid=True), nullable=False),
        # Stock fields
        sa.Column("current_price", sa.Float(), nullable=True),
        sa.Column("previous_close", sa.Float(), nullable=True),
        sa.Column("day_change", sa.Float(), nullable=True),
        sa.Column("day_change_pct", sa.Float(), nullable=True),
        sa.Column("pe_ratio", sa.Float(), nullable=True),
        sa.Column("pb_ratio", sa.Float(), nullable=True),
        sa.Column("market_cap", sa.BigInteger(), nullable=True),
        sa.Column("roe", sa.Float(), nullable=True),
        sa.Column("roce", sa.Float(), nullable=True),
        sa.Column("eps", sa.Float(), nullable=True),
        sa.Column("book_value", sa.Float(), nullable=True),
        sa.Column("dividend_yield", sa.Float(), nullable=True),
        sa.Column("fifty_two_week_low", sa.Float(), nullable=True),
        sa.Column("fifty_two_week_high", sa.Float(), nullable=True),
        sa.Column("industry", sa.String(200), nullable=True),
        sa.Column("sector", sa.String(200), nullable=True),
        # MF fields
        sa.Column("nav", sa.Float(), nullable=True),
        sa.Column("expense_ratio", sa.Float(), nullable=True),
        sa.Column("aum", sa.Float(), nullable=True),
        sa.Column("return_1y", sa.Float(), nullable=True),
        sa.Column("return_3y", sa.Float(), nullable=True),
        sa.Column("return_5y", sa.Float(), nullable=True),
        sa.Column("category", sa.String(200), nullable=True),
        sa.Column("risk_rating", sa.String(50), nullable=True),
        # Shared
        sa.Column("sparkline_data", postgresql.JSONB(), nullable=True),
        sa.Column("price_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fundamentals_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["watchlist_item_id"], ["watchlist_items.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("watchlist_item_id", name="uq_market_data_cache_item"),
    )


def downgrade() -> None:
    op.drop_table("market_data_cache")
    op.drop_table("watchlist_items")
    op.drop_table("watchlist_themes")
    op.drop_table("pipeline_stages")
