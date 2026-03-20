"""Drop status from kb_items, add is_pinned to kb_collections.

Status is replaced by flexible collections (playlists/queues).
Pinned collections appear as smart views in the sidebar.

Revision ID: 004
Revises: 003
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop status index first
    op.drop_index("ix_kb_items_user_status", table_name="kb_items")

    # Drop status column
    op.drop_column("kb_items", "status")

    # Add is_pinned to collections
    op.add_column(
        "kb_collections",
        sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("kb_collections", "is_pinned")

    op.add_column(
        "kb_items",
        sa.Column("status", sa.String(20), nullable=False, server_default="to_read"),
    )
    op.create_index("ix_kb_items_user_status", "kb_items", ["user_id", "status"])
