"""Create investment plans, allocations, deployment events, and revision events tables.

Revision ID: 002
Revises: 001
Create Date: 2026-03-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Investment Plans
    op.create_table(
        "investment_plans",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("total_corpus", sa.Numeric(18, 2), nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Plan Allocations
    op.create_table(
        "plan_allocations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("investment_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_identifier", sa.String(50), nullable=False),
        sa.Column("asset_name", sa.String(500), nullable=False),
        sa.Column("asset_type", sa.String(30), nullable=False),
        sa.Column("target_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("target_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("priority", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_plan_allocations_plan", "plan_allocations", ["plan_id"])

    # Deployment Events (immutable ledger)
    op.create_table(
        "deployment_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("allocation_id", UUID(as_uuid=True), sa.ForeignKey("plan_allocations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("units", sa.Numeric(18, 4), nullable=True),
        sa.Column("price_per_unit", sa.Numeric(18, 4), nullable=True),
        sa.Column("transaction_id", UUID(as_uuid=True), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_deployment_events_allocation", "deployment_events", ["allocation_id"])

    # Plan Revision Events (immutable ledger)
    op.create_table(
        "plan_revision_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False, index=True),
        sa.Column("plan_id", UUID(as_uuid=True), sa.ForeignKey("investment_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(30), nullable=False),
        sa.Column("previous_value", sa.Text, nullable=True),
        sa.Column("new_value", sa.Text, nullable=True),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index("ix_plan_revision_events_plan", "plan_revision_events", ["plan_id"])


def downgrade() -> None:
    op.drop_table("plan_revision_events")
    op.drop_table("deployment_events")
    op.drop_table("plan_allocations")
    op.drop_table("investment_plans")
