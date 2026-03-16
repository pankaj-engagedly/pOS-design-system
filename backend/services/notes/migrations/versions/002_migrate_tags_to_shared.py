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
    # Copy existing tags rows to shared tags table (get-or-create by user_id + name)
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

    # Copy note_tags links to taggables as entity_type='note'
    # Uses the new tag id from shared tags (matched by user_id + name)
    op.execute("""
        INSERT INTO taggables (id, user_id, tag_id, entity_type, entity_id, created_at, updated_at)
        SELECT
            gen_random_uuid(),
            t.user_id,
            shared_tag.id,
            'note',
            nt.note_id,
            NOW(),
            NOW()
        FROM note_tags nt
        JOIN tags old_tag ON old_tag.id = nt.tag_id
        JOIN tags shared_tag ON shared_tag.user_id = old_tag.user_id AND shared_tag.name = old_tag.name
        LEFT JOIN notes n ON n.id = nt.note_id
        WHERE n.id IS NOT NULL  -- skip orphaned note_tags
        ON CONFLICT (tag_id, entity_type, entity_id) DO NOTHING
    """)

    # Drop old per-notes tag tables
    op.drop_table("note_tags")
    op.drop_table("tags")


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
