"""Add missing updated_at column to vault_field_templates.

Revision ID: 003
Revises: 002
Create Date: 2026-03-19
"""

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op


def upgrade():
    op.add_column(
        "vault_field_templates",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade():
    op.drop_column("vault_field_templates", "updated_at")
