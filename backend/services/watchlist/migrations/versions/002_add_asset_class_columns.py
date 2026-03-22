"""Add cache columns for new asset classes: crypto, bonds.

Revision ID: 002
Revises: 001
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("market_data_cache", sa.Column("volume_24h", sa.Float(), nullable=True))
    op.add_column("market_data_cache", sa.Column("circulating_supply", sa.Float(), nullable=True))
    op.add_column("market_data_cache", sa.Column("bond_yield", sa.Float(), nullable=True))
    op.add_column("market_data_cache", sa.Column("holdings_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("market_data_cache", "holdings_count")
    op.drop_column("market_data_cache", "bond_yield")
    op.drop_column("market_data_cache", "circulating_supply")
    op.drop_column("market_data_cache", "volume_24h")
