"""Add full-text search vector to kb_items.

Revision ID: 003
Revises: 002
Create Date: 2026-03-18
"""

from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add generated tsvector column with weighted search
    op.execute("""
        ALTER TABLE kb_items
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(preview_text, '')), 'B') ||
            setweight(to_tsvector('english', coalesce(source, '')), 'C') ||
            setweight(to_tsvector('english', coalesce(author, '')), 'C')
        ) STORED
    """)

    op.create_index(
        "ix_kb_items_search_vector",
        "kb_items",
        ["search_vector"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_index("ix_kb_items_search_vector", table_name="kb_items")
    op.execute("ALTER TABLE kb_items DROP COLUMN search_vector")
