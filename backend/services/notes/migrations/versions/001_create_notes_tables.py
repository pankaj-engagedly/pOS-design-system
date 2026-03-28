"""Create folders, notes, tags, note_tags tables.

Revision ID: 001
Create Date: 2026-03-14
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "folders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_folders_user_name"),
    )

    op.create_table(
        "notes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column(
            "folder_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("folders.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("title", sa.String(500), nullable=False, server_default=""),
        sa.Column("content", postgresql.JSONB, nullable=True),
        sa.Column("preview_text", sa.String(200), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("is_pinned", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("is_deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    # Full-text search vector column + GIN index
    op.execute("""
        ALTER TABLE notes
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(preview_text, '')), 'B')
        ) STORED
    """)
    op.create_index(
        "ix_notes_search_vector",
        "notes",
        ["search_vector"],
        postgresql_using="gin",
    )

    # Tags table — created by shared migrations on fresh DBs, but this migration
    # predates the shared tag system. Use raw SQL with IF NOT EXISTS for safety.
    op.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_tags_user_id ON tags (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS note_tags (
            note_id UUID REFERENCES notes(id) ON DELETE CASCADE,
            tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (note_id, tag_id)
        )
    """)


def downgrade() -> None:
    op.drop_table("note_tags")
    op.drop_table("tags")
    op.drop_index("ix_notes_search_vector", table_name="notes")
    op.drop_table("notes")
    op.drop_table("folders")
