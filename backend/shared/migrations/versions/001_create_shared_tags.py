"""Create shared tags and taggables tables.

Revision ID: 001
Create Date: 2026-03-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS so this migration is idempotent — the tags
    # table may already exist if the notes service created it before Phase 2.
    op.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_tags_user_name UNIQUE (user_id, name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_tags_user_id ON tags (user_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS taggables (
            id UUID NOT NULL,
            user_id UUID NOT NULL,
            tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            entity_type VARCHAR(50) NOT NULL,
            entity_id UUID NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
            PRIMARY KEY (id),
            CONSTRAINT uq_taggables_tag_entity UNIQUE (tag_id, entity_type, entity_id)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_taggables_user_id ON taggables (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_taggables_tag_id ON taggables (tag_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_taggables_entity_id ON taggables (entity_id)")


def downgrade() -> None:
    op.drop_table("taggables")
    op.drop_table("tags")
