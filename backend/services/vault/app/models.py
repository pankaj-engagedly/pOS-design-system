"""Vault service database models."""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


class VaultItem(UserScopedBase):
    """A named collection of credentials for one account/service."""

    __tablename__ = "vault_items"

    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    icon = Column(String(10), nullable=True)
    is_favorite = Column(Boolean, nullable=False, default=False, server_default="false")

    fields = relationship(
        "VaultField",
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="VaultField.position",
    )


class VaultField(UserScopedBase):
    """A single key-value field belonging to a vault item."""

    __tablename__ = "vault_fields"

    vault_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vault_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    field_name = Column(String(100), nullable=False)
    field_value = Column(Text, nullable=False)
    field_type = Column(String(20), nullable=False, default="text", server_default="text")
    position = Column(Integer, nullable=False, default=0, server_default="0")

    item = relationship("VaultItem", back_populates="fields")
