"""Create feed_folders, feed_sources, feed_items.

Revision ID: 002
Revises: 001
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── feed_folders ──────────────────────────────────────
    op.create_table(
        "feed_folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_feed_folders_user_name"),
    )

    # ── feed_sources ──────────────────────────────────────
    op.create_table(
        "feed_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("site_url", sa.Text, nullable=True),
        sa.Column("feed_type", sa.String(20), nullable=False, server_default="rss"),
        sa.Column("icon_url", sa.Text, nullable=True),
        sa.Column(
            "folder_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feed_folders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("poll_interval_min", sa.Integer, nullable=False, server_default="60"),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("error_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "url", name="uq_feed_sources_user_url"),
    )

    # ── feed_items ────────────────────────────────────────
    op.create_table(
        "feed_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "feed_source_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("feed_sources.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("guid", sa.String(1000), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.Text, nullable=True),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("summary", sa.Text, nullable=True),
        sa.Column("content_html", sa.Text, nullable=True),
        sa.Column("thumbnail_url", sa.Text, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_starred", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("kb_item_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("feed_source_id", "guid", name="uq_feed_items_source_guid"),
    )
    op.create_index("ix_feed_items_user_read", "feed_items", ["user_id", "is_read"])
    op.create_index(
        "ix_feed_items_source_published",
        "feed_items",
        ["user_id", "feed_source_id", "published_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_feed_items_source_published", table_name="feed_items")
    op.drop_index("ix_feed_items_user_read", table_name="feed_items")
    op.drop_table("feed_items")
    op.drop_table("feed_sources")
    op.drop_table("feed_folders")
