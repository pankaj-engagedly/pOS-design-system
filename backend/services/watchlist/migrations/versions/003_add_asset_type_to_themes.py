"""Add asset_type column to watchlist_themes for per-class scoping.

Revision ID: 003
Revises: 002
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("watchlist_themes", sa.Column("asset_type", sa.String(20), nullable=True))
    op.create_index("ix_watchlist_themes_user_asset_type", "watchlist_themes", ["user_id", "asset_type"])

    # Drop the old unique constraint and create a new one that includes asset_type
    op.drop_constraint("uq_watchlist_themes_user_name_parent", "watchlist_themes", type_="unique")
    op.create_unique_constraint(
        "uq_watchlist_themes_user_name_parent_asset",
        "watchlist_themes",
        ["user_id", "name", "parent_id", "asset_type"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_watchlist_themes_user_name_parent_asset", "watchlist_themes", type_="unique")
    op.create_unique_constraint(
        "uq_watchlist_themes_user_name_parent",
        "watchlist_themes",
        ["user_id", "name", "parent_id"],
    )
    op.drop_index("ix_watchlist_themes_user_asset_type", "watchlist_themes")
    op.drop_column("watchlist_themes", "asset_type")
