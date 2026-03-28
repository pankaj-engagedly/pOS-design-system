"""Migrate notes tags to shared tags/taggables tables, drop old tables.

Revision ID: 002
Create Date: 2026-03-15
Depends on: shared migration 001_create_shared_tags must have run first.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # On a fresh DB (Docker/production), shared migrations already created `tags` and `taggables`.
    # `note_tags` was created by 001 via IF NOT EXISTS but will be empty.
    # Only migrate data if note_tags has rows (existing DB), otherwise just clean up.
    conn = op.get_bind()
    has_note_tags = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'note_tags')"
    )).scalar()

    if has_note_tags:
        has_rows = conn.execute(sa.text("SELECT EXISTS (SELECT 1 FROM note_tags)")).scalar()
        if has_rows:
            # Existing DB: migrate note_tags data to shared taggables
            op.execute("""
                INSERT INTO tags (id, user_id, name, created_at, updated_at)
                SELECT id, user_id, name, created_at, updated_at
                FROM (
                    SELECT DISTINCT ON (user_id, name) id, user_id, name, created_at, updated_at
                    FROM tags
                    WHERE id IN (SELECT DISTINCT tag_id FROM note_tags)
                ) AS distinct_tags
                ON CONFLICT (user_id, name) DO NOTHING
            """)
            op.execute("""
                INSERT INTO taggables (id, user_id, tag_id, entity_type, entity_id, created_at, updated_at)
                SELECT
                    gen_random_uuid(),
                    old_tag.user_id,
                    shared_tag.id,
                    'note',
                    nt.note_id,
                    NOW(),
                    NOW()
                FROM note_tags nt
                JOIN tags old_tag ON old_tag.id = nt.tag_id
                JOIN tags shared_tag ON shared_tag.user_id = old_tag.user_id AND shared_tag.name = old_tag.name
                LEFT JOIN notes n ON n.id = nt.note_id
                WHERE n.id IS NOT NULL
                ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING
            """)
        # Drop note_tags (per-notes join table, no longer needed)
        op.drop_table("note_tags")
    # Do NOT drop tags — it's now the shared tags table


def downgrade() -> None:
    # Recreate old tags table
    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )
    # Recreate old note_tags join table
    op.create_table(
        "note_tags",
        sa.Column(
            "note_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("notes.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tags.id", ondelete="CASCADE"),
            primary_key=True,
        ),
    )
    # Data migration back is not implemented — downgrade is destructive
