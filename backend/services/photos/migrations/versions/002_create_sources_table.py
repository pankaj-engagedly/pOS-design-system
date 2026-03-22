"""Create photo_sources table + add duration, source_removed to photos.

Revision ID: 002
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── photo_sources ─────────────────────────────────────
    op.create_table(
        "photo_sources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("provider", sa.String(30), nullable=False),
        sa.Column("source_path", sa.String(1000), nullable=False),
        sa.Column("label", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="idle"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("photo_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("config", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "provider", "source_path", name="uq_photo_sources_user_provider_path"),
    )

    # ── new columns on photos ─────────────────────────────
    op.add_column("photos", sa.Column("duration", sa.Float, nullable=True))
    op.add_column("photos", sa.Column("source_removed", sa.Boolean, nullable=False, server_default="false"))


def downgrade() -> None:
    op.drop_column("photos", "source_removed")
    op.drop_column("photos", "duration")
    op.drop_table("photo_sources")
