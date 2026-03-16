"""Notes models — Folder, Note.

Tags are now shared across services via pos_contracts.models.Tag and Taggable.
Use pos_contracts.tag_service for all tag operations.
"""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


class Folder(UserScopedBase):
    """A named folder for organizing notes."""

    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_folders_user_name"),
    )

    name = Column(String(255), nullable=False)
    position = Column(Integer, nullable=False, default=0)

    notes = relationship("Note", back_populates="folder", foreign_keys="Note.folder_id")


class Note(UserScopedBase):
    """A single note with rich text content."""

    __tablename__ = "notes"

    folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title = Column(String(500), nullable=False, default="")
    content = Column(JSONB, nullable=True)  # Tiptap document JSON
    preview_text = Column(String(200), nullable=True)
    color = Column(String(20), nullable=True)
    is_pinned = Column(Boolean, nullable=False, default=False)
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    position = Column(Integer, nullable=False, default=0)

    folder = relationship("Folder", back_populates="notes", foreign_keys=[folder_id])
