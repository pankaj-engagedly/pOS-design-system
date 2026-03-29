"""Add TOTP MFA fields to users table.

Revision ID: 002
Create Date: 2026-03-29
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("totp_enabled", sa.Boolean, nullable=False, server_default="false"))
    op.add_column("users", sa.Column("backup_codes", sa.Text, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "backup_codes")
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
