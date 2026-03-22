"""Photos models — photos, albums, comments, people.

Tags are handled via shared pos_contracts Tag/Taggable models.
Use pos_contracts.tag_service for all tag operations.
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from pos_contracts.models import UserScopedBase


# ── Photos ───────────────────────────────────────────────

class Photo(UserScopedBase):
    """A photo or video in the library."""

    __tablename__ = "photos"
    __table_args__ = (
        Index("ix_photos_user_taken", "user_id", "taken_at"),
        Index("ix_photos_user_favourite", "user_id", "is_favourite"),
        Index("ix_photos_file_hash", "user_id", "file_hash"),
        Index("ix_photos_user_source", "user_id", "source_type"),
    )

    filename = Column(String(500), nullable=False)
    storage_path = Column(String(1000), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_hash = Column(String(64), nullable=False)
    perceptual_hash = Column(String(16), nullable=True)
    taken_at = Column(DateTime(timezone=True), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_name = Column(String(500), nullable=True)
    exif_data = Column(JSONB, nullable=True)
    is_favourite = Column(Boolean, nullable=False, default=False)
    caption = Column(Text, nullable=True)
    rating = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # video duration in seconds
    source_type = Column(String(30), nullable=False, default="upload")
    source_id = Column(String(500), nullable=True)
    source_account = Column(String(255), nullable=True)
    source_removed = Column(Boolean, nullable=False, default=False)
    processing_status = Column(String(20), nullable=False, default="pending")

    comments = relationship("PhotoComment", back_populates="photo", cascade="all, delete-orphan")
    album_links = relationship("AlbumPhoto", back_populates="photo", cascade="all, delete-orphan")
    people_links = relationship("PhotoPerson", back_populates="photo", cascade="all, delete-orphan")


# ── Albums ───────────────────────────────────────────────

class Album(UserScopedBase):
    """A photo album — manual or smart."""

    __tablename__ = "albums"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_albums_user_name"),
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    cover_photo_id = Column(UUID(as_uuid=True), nullable=True)
    album_type = Column(String(20), nullable=False, default="manual")
    smart_rule = Column(JSONB, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    is_pinned = Column(Boolean, nullable=False, default=False)

    photo_links = relationship("AlbumPhoto", back_populates="album", cascade="all, delete-orphan")


class AlbumPhoto(UserScopedBase):
    """Junction table: many-to-many between albums and photos."""

    __tablename__ = "album_photos"
    __table_args__ = (
        UniqueConstraint("album_id", "photo_id", name="uq_album_photos"),
        Index("ix_album_photos_album", "album_id"),
        Index("ix_album_photos_photo", "photo_id"),
    )

    album_id = Column(
        UUID(as_uuid=True),
        ForeignKey("albums.id", ondelete="CASCADE"),
        nullable=False,
    )
    photo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
    )
    position = Column(Integer, nullable=False, default=0)

    album = relationship("Album", back_populates="photo_links")
    photo = relationship("Photo", back_populates="album_links")


# ── Comments ─────────────────────────────────────────────

class PhotoComment(UserScopedBase):
    """Comment on a photo."""

    __tablename__ = "photo_comments"
    __table_args__ = (
        Index("ix_photo_comments_photo", "photo_id"),
    )

    photo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
    )
    text = Column(Text, nullable=False)

    photo = relationship("Photo", back_populates="comments")


# ── People (manual tagging) ─────────────────────────────

class Person(UserScopedBase):
    """A person who can be tagged in photos."""

    __tablename__ = "people"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_people_user_name"),
    )

    name = Column(String(255), nullable=False)
    cover_photo_id = Column(UUID(as_uuid=True), nullable=True)

    photo_links = relationship("PhotoPerson", back_populates="person", cascade="all, delete-orphan")


class PhotoPerson(UserScopedBase):
    """Junction table: many-to-many between photos and people."""

    __tablename__ = "photo_people"
    __table_args__ = (
        UniqueConstraint("photo_id", "person_id", name="uq_photo_people"),
        Index("ix_photo_people_person", "person_id"),
    )

    photo_id = Column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
    )
    person_id = Column(
        UUID(as_uuid=True),
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
    )

    photo = relationship("Photo", back_populates="people_links")
    person = relationship("Person", back_populates="photo_links")


# ── Photo Sources ─────────────────────────────────────

class PhotoSource(UserScopedBase):
    """A configured sync source — folder path or Apple Photos library."""

    __tablename__ = "photo_sources"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", "source_path", name="uq_photo_sources_user_provider_path"),
    )

    provider = Column(String(30), nullable=False)  # "folder" | "apple_photos"
    source_path = Column(String(1000), nullable=False)
    label = Column(String(255), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    sync_status = Column(String(20), nullable=False, default="idle")  # idle | syncing | error
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    photo_count = Column(Integer, nullable=False, default=0)
    config = Column(JSONB, nullable=True)  # provider-specific settings (future)
