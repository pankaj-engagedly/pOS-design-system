"""Add currency column to market_data_cache.

Revision ID: 006
Revises: 005
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("market_data_cache", sa.Column("currency", sa.String(10), nullable=True))
    op.add_column("market_data_cache", sa.Column("financial_currency", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("market_data_cache", "financial_currency")
    op.drop_column("market_data_cache", "currency")
