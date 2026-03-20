"""Vault redesign: category-based structured data with field templates.

Drops old vault_fields and vault_items tables (test data only).
Creates new: vault_categories, vault_field_templates, vault_items, vault_field_values.

Revision ID: 002
Create Date: 2026-03-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Drop old tables ────────────────────────────────────────────────────────
    # Clean up tag associations for old vault_item entities first
    op.execute("DELETE FROM taggables WHERE entity_type = 'vault_item'")
    op.drop_table("vault_fields")
    op.drop_table("vault_items")

    # ── vault_categories ───────────────────────────────────────────────────────
    op.create_table(
        "vault_categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(10), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "name", name="uq_vault_categories_user_name"),
    )
    op.create_index("ix_vault_categories_user_id", "vault_categories", ["user_id"])

    # ── vault_field_templates ─────────────────────────────────────────────────
    op.create_table(
        "vault_field_templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("field_type", sa.String(20), nullable=False, server_default="text"),
        sa.Column("section", sa.String(50), nullable=False, server_default="General"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vault_field_templates_category_id", "vault_field_templates", ["category_id"])
    op.create_index("ix_vault_field_templates_user_id", "vault_field_templates", ["user_id"])

    # ── vault_items (new schema) ───────────────────────────────────────────────
    op.create_table(
        "vault_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "category_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_categories.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("icon", sa.String(10), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vault_items_user_id", "vault_items", ["user_id"])
    op.create_index("ix_vault_items_category_id", "vault_items", ["category_id"])

    # ── vault_field_values ────────────────────────────────────────────────────
    op.create_table(
        "vault_field_values",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "template_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_field_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        # Only populated for standalone fields (template_id = NULL)
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("field_type", sa.String(20), nullable=True, server_default="text"),
        sa.Column("section", sa.String(50), nullable=True),
        sa.Column("field_value", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vault_field_values_item_id", "vault_field_values", ["item_id"])
    op.create_index("ix_vault_field_values_user_id", "vault_field_values", ["user_id"])
    op.create_index("ix_vault_field_values_template_id", "vault_field_values", ["template_id"])


def downgrade() -> None:
    op.drop_table("vault_field_values")
    op.drop_table("vault_items")
    op.drop_table("vault_field_templates")
    op.drop_table("vault_categories")

    # Recreate old tables
    op.create_table(
        "vault_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(10), nullable=True),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vault_items_user_id", "vault_items", ["user_id"])

    op.create_table(
        "vault_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "vault_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("vault_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("field_name", sa.String(100), nullable=False),
        sa.Column("field_value", sa.Text(), nullable=False),
        sa.Column("field_type", sa.String(20), nullable=False, server_default="text"),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vault_fields_user_id", "vault_fields", ["user_id"])
    op.create_index("ix_vault_fields_vault_item_id", "vault_fields", ["vault_item_id"])
