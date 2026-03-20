"""Vault service database models."""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


class VaultCategory(UserScopedBase):
    """A named category grouping vault items (e.g. Banks, Demats, Hosting)."""

    __tablename__ = "vault_categories"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_vault_categories_user_name"),
    )

    name = Column(String(100), nullable=False)
    icon = Column(String(10), nullable=True)
    position = Column(Integer, nullable=False, default=0, server_default="0")

    templates = relationship(
        "VaultFieldTemplate",
        back_populates="category",
        cascade="all, delete-orphan",
        order_by="VaultFieldTemplate.position",
    )
    items = relationship(
        "VaultItem",
        back_populates="category",
        cascade="all, delete-orphan",
    )


class VaultFieldTemplate(UserScopedBase):
    """A field definition belonging to a category (defines column structure)."""

    __tablename__ = "vault_field_templates"

    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vault_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_name = Column(String(100), nullable=False)
    field_type = Column(String(20), nullable=False, default="text", server_default="text")
    section = Column(String(50), nullable=False, default="General", server_default="General")
    position = Column(Integer, nullable=False, default=0, server_default="0")

    category = relationship("VaultCategory", back_populates="templates")
    # Values that reference this template; SET NULL on delete
    values = relationship("VaultFieldValue", back_populates="template")


class VaultItem(UserScopedBase):
    """A named entry within a category (e.g. HDFC, SBI within Banks)."""

    __tablename__ = "vault_items"

    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vault_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(200), nullable=False)
    icon = Column(String(10), nullable=True)
    is_favorite = Column(Boolean, nullable=False, default=False, server_default="false")

    category = relationship("VaultCategory", back_populates="items")
    field_values = relationship(
        "VaultFieldValue",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="VaultFieldValue.position",
    )


class VaultFieldValue(UserScopedBase):
    """A field value for a vault item.

    If template_id is set: name/type/section come from the linked template.
    If template_id is NULL: this is a standalone extra field, name/type/section stored here.
    """

    __tablename__ = "vault_field_values"

    item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vault_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vault_field_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Only for standalone fields (template_id = NULL)
    field_name = Column(String(100), nullable=True)
    field_type = Column(String(20), nullable=True, server_default="text")
    section = Column(String(50), nullable=True)

    field_value = Column(Text, nullable=True)  # encrypted if type = secret
    position = Column(Integer, nullable=False, default=0, server_default="0")

    item = relationship("VaultItem", back_populates="field_values")
    template = relationship("VaultFieldTemplate", back_populates="values")
