"""Create kb_items, kb_highlights, kb_collections, kb_collection_items.

Revision ID: 001
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── kb_items ──────────────────────────────────────────
    op.create_table(
        "kb_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("url", sa.Text, nullable=True),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("item_type", sa.String(20), nullable=False, server_default="article"),
        sa.Column("status", sa.String(20), nullable=False, server_default="to_read"),
        sa.Column("content", postgresql.JSONB, nullable=True),
        sa.Column("preview_text", sa.Text, nullable=True),
        sa.Column("thumbnail_url", sa.Text, nullable=True),
        sa.Column("site_name", sa.String(255), nullable=True),
        sa.Column("rating", sa.Integer, nullable=True),
        sa.Column("is_favourite", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("reading_time_min", sa.Integer, nullable=True),
        sa.Column("word_count", sa.Integer, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("feed_item_id", postgresql.UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_kb_items_user_status", "kb_items", ["user_id", "status"])
    op.create_index("ix_kb_items_user_type", "kb_items", ["user_id", "item_type"])
    op.create_index("ix_kb_items_user_favourite", "kb_items", ["user_id", "is_favourite"])

    # ── kb_highlights ─────────────────────────────────────
    op.create_table(
        "kb_highlights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "kb_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("kb_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("color", sa.String(20), nullable=False, server_default="yellow"),
        sa.Column("position_data", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── kb_collections ────────────────────────────────────
    op.create_table(
        "kb_collections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("cover_color", sa.String(20), nullable=True),
        sa.Column("icon", sa.String(50), nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_kb_collections_user_name"),
    )

    # ── kb_collection_items ───────────────────────────────
    op.create_table(
        "kb_collection_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "collection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("kb_collections.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "kb_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("kb_items.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("collection_id", "kb_item_id", name="uq_kb_collection_items"),
    )


def downgrade() -> None:
    op.drop_table("kb_collection_items")
    op.drop_table("kb_collections")
    op.drop_table("kb_highlights")
    op.drop_index("ix_kb_items_user_favourite", table_name="kb_items")
    op.drop_index("ix_kb_items_user_type", table_name="kb_items")
    op.drop_index("ix_kb_items_user_status", table_name="kb_items")
    op.drop_table("kb_items")
