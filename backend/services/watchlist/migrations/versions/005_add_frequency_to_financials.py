"""Add frequency column to financial_statements for annual vs quarterly.

Revision ID: 005
Revises: 004
Create Date: 2026-03-21
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("financial_statements", sa.Column("frequency", sa.String(10), nullable=True, server_default="annual"))

    # Update existing rows
    op.execute("UPDATE financial_statements SET frequency = 'annual' WHERE frequency IS NULL")

    # Drop old constraint and create new one including frequency
    op.drop_constraint("uq_financial_stmt_item_type_period", "financial_statements", type_="unique")
    op.create_unique_constraint(
        "uq_financial_stmt_item_type_period_freq",
        "financial_statements",
        ["watchlist_item_id", "statement_type", "fiscal_period", "frequency"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_financial_stmt_item_type_period_freq", "financial_statements", type_="unique")
    op.create_unique_constraint(
        "uq_financial_stmt_item_type_period",
        "financial_statements",
        ["watchlist_item_id", "statement_type", "fiscal_period"],
    )
    op.drop_column("financial_statements", "frequency")
