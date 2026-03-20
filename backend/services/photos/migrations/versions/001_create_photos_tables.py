"""Create photos, albums, album_photos, photo_comments, people, photo_people.

Revision ID: 001
Create Date: 2026-03-20
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── photos ─────────────────────────────────────────────
    op.create_table(
        "photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("storage_path", sa.String(1000), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.BigInteger, nullable=False),
        sa.Column("width", sa.Integer, nullable=True),
        sa.Column("height", sa.Integer, nullable=True),
        sa.Column("file_hash", sa.String(64), nullable=False),
        sa.Column("perceptual_hash", sa.String(16), nullable=True),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("latitude", sa.Float, nullable=True),
        sa.Column("longitude", sa.Float, nullable=True),
        sa.Column("location_name", sa.String(500), nullable=True),
        sa.Column("exif_data", postgresql.JSONB, nullable=True),
        sa.Column("is_favourite", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("caption", sa.Text, nullable=True),
        sa.Column("rating", sa.Integer, nullable=True),
        sa.Column("source_type", sa.String(30), nullable=False, server_default="upload"),
        sa.Column("source_id", sa.String(500), nullable=True),
        sa.Column("source_account", sa.String(255), nullable=True),
        sa.Column("processing_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_photos_user_taken", "photos", ["user_id", "taken_at"])
    op.create_index("ix_photos_user_favourite", "photos", ["user_id", "is_favourite"])
    op.create_index("ix_photos_file_hash", "photos", ["user_id", "file_hash"])
    op.create_index("ix_photos_user_source", "photos", ["user_id", "source_type"])

    # ── albums ─────────────────────────────────────────────
    op.create_table(
        "albums",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("cover_photo_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("album_type", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("smart_rule", postgresql.JSONB, nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_pinned", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_albums_user_name"),
    )

    # ── album_photos ───────────────────────────────────────
    op.create_table(
        "album_photos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "album_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("albums.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "photo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("photos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("album_id", "photo_id", name="uq_album_photos"),
    )
    op.create_index("ix_album_photos_album", "album_photos", ["album_id"])
    op.create_index("ix_album_photos_photo", "album_photos", ["photo_id"])

    # ── photo_comments ─────────────────────────────────────
    op.create_table(
        "photo_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "photo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("photos.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # ── people ─────────────────────────────────────────────
    op.create_table(
        "people",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("cover_photo_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_people_user_name"),
    )

    # ── photo_people ───────────────────────────────────────
    op.create_table(
        "photo_people",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "photo_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("photos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "person_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("people.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("photo_id", "person_id", name="uq_photo_people"),
    )
    op.create_index("ix_photo_people_person", "photo_people", ["person_id"])


def downgrade() -> None:
    op.drop_table("photo_people")
    op.drop_table("people")
    op.drop_table("photo_comments")
    op.drop_index("ix_album_photos_photo", table_name="album_photos")
    op.drop_index("ix_album_photos_album", table_name="album_photos")
    op.drop_table("album_photos")
    op.drop_table("albums")
    op.drop_index("ix_photos_user_source", table_name="photos")
    op.drop_index("ix_photos_file_hash", table_name="photos")
    op.drop_index("ix_photos_user_favourite", table_name="photos")
    op.drop_index("ix_photos_user_taken", table_name="photos")
    op.drop_table("photos")
