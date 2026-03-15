"""Attachment model — file metadata with user scoping."""

from sqlalchemy import Column, Integer, String

from pos_contracts.models import UserScopedBase


class Attachment(UserScopedBase):
    """A stored file attachment."""

    __tablename__ = "attachments"

    filename = Column(String(500), nullable=False)
    content_type = Column(String(255), nullable=False)
    size = Column(Integer, nullable=False)
    storage_path = Column(String(1000), nullable=False)
