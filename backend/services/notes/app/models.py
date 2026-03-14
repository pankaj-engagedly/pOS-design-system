"""Notes models — Folder, Note, Tag, NoteTag."""

import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from pos_common.database import UserScopedBase

# Association table — no extra columns, just the join
note_tags = Table(
    "note_tags",
    UserScopedBase.metadata,
    Column(
        "note_id",
        UUID(as_uuid=True),
        ForeignKey("notes.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "tag_id",
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


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
    tags = relationship("Tag", secondary=note_tags, back_populates="notes")


class Tag(UserScopedBase):
    """A user-defined tag for cross-cutting note organization."""

    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_tags_user_name"),
    )

    name = Column(String(100), nullable=False)

    notes = relationship("Note", secondary=note_tags, back_populates="tags")
