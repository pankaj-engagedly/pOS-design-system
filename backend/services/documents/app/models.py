"""Documents models — DocFolder, Document, DocShare, DocRecentAccess.

Tags are handled via shared pos_contracts Tag/Taggable models.
Use pos_contracts.tag_service for all tag operations.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


class DocFolder(UserScopedBase):
    """A named folder for organizing documents. Self-referential for nesting."""

    __tablename__ = "doc_folders"
    __table_args__ = (
        UniqueConstraint("user_id", "parent_id", "name", name="uq_doc_folders_user_parent_name"),
    )

    name = Column(String(255), nullable=False)
    parent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("doc_folders.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)

    parent = relationship("DocFolder", remote_side="DocFolder.id", foreign_keys=[parent_id])


class Document(UserScopedBase):
    """A document record referencing a file stored in the attachments service."""

    __tablename__ = "documents"

    name = Column(String(500), nullable=False)
    description = Column(String(1000), nullable=True)
    # attachment_id is NOT a FK — it's a cross-service reference to attachments service
    attachment_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    file_size = Column(Integer, nullable=True)  # bytes
    content_type = Column(String(255), nullable=True)
    folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("doc_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    folder = relationship("DocFolder", foreign_keys=[folder_id])


class DocShare(UserScopedBase):
    """Share a document or folder with another pOS user (read-only)."""

    __tablename__ = "doc_shares"
    __table_args__ = (
        CheckConstraint(
            "(document_id IS NOT NULL AND folder_id IS NULL) OR "
            "(document_id IS NULL AND folder_id IS NOT NULL)",
            name="ck_doc_shares_one_target",
        ),
    )

    owner_user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    shared_with_user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=True,
    )
    folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("doc_folders.id", ondelete="CASCADE"),
        nullable=True,
    )
    permission = Column(String(20), nullable=False, default="read")


class DocRecentAccess(UserScopedBase):
    """Tracks recent document access per user. Capped at 50 per user."""

    __tablename__ = "doc_recent_access"

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    accessed_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class DocFavourite(UserScopedBase):
    """Tracks which documents a user has starred/favourited."""

    __tablename__ = "doc_favourites"
    __table_args__ = (
        UniqueConstraint("user_id", "document_id", name="uq_doc_favourites_user_document"),
    )

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )


class DocComment(UserScopedBase):
    """A comment on a document, written by the document owner or a shared user."""

    __tablename__ = "doc_comments"
    __table_args__ = (
        Index("ix_doc_comments_document_created", "document_id", "created_at"),
    )

    document_id = Column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content = Column(Text, nullable=False)

    document = relationship("Document", backref="comments")
