"""KB models — items, highlights, collections, feeds.

Tags are handled via shared pos_contracts Tag/Taggable models.
Use pos_contracts.tag_service for all tag operations.
"""

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import backref, relationship

from pos_contracts.models import UserScopedBase


# ── KB Core ──────────────────────────────────────────────


class KBItem(UserScopedBase):
    """Core knowledge base item — article, video, podcast, excerpt, or document."""

    __tablename__ = "kb_items"
    __table_args__ = (
        Index("ix_kb_items_user_type", "user_id", "item_type"),
        Index("ix_kb_items_user_favourite", "user_id", "is_favourite"),
    )

    title = Column(String(500), nullable=False)
    url = Column(Text, nullable=True)
    source = Column(String(255), nullable=True)
    author = Column(String(255), nullable=True)
    item_type = Column(String(20), nullable=False, default="article")  # article|video|podcast|excerpt|document
    content = Column(JSONB, nullable=True)  # Tiptap JSON for notes/excerpts
    preview_text = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    site_name = Column(String(255), nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5
    is_favourite = Column(Boolean, nullable=False, default=False)
    reading_time_min = Column(Integer, nullable=True)
    word_count = Column(Integer, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    feed_item_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )


class KBHighlight(UserScopedBase):
    """Annotations/highlights on KB items."""

    __tablename__ = "kb_highlights"

    kb_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("kb_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    text = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    color = Column(String(20), nullable=False, default="yellow")  # yellow|green|blue|pink
    position_data = Column(JSONB, nullable=True)  # paragraph index + char offsets

    kb_item = relationship("KBItem", backref="highlights")


class KBCollection(UserScopedBase):
    """Curated sets of KB items."""

    __tablename__ = "kb_collections"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_kb_collections_user_name"),
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    cover_color = Column(String(20), nullable=True)
    icon = Column(String(50), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    is_pinned = Column(Boolean, nullable=False, default=False)


class KBCollectionItem(UserScopedBase):
    """Join table linking items to collections."""

    __tablename__ = "kb_collection_items"
    __table_args__ = (
        UniqueConstraint("collection_id", "kb_item_id", name="uq_kb_collection_items"),
    )

    collection_id = Column(
        UUID(as_uuid=True),
        ForeignKey("kb_collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kb_item_id = Column(
        UUID(as_uuid=True),
        ForeignKey("kb_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position = Column(Integer, nullable=False, default=0)

    collection = relationship("KBCollection", backref=backref("items", cascade="all, delete-orphan", passive_deletes=True))
    kb_item = relationship("KBItem")


# ── Feeds ────────────────────────────────────────────────


class FeedFolder(UserScopedBase):
    """Organize feed subscriptions into groups."""

    __tablename__ = "feed_folders"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_feed_folders_user_name"),
    )

    name = Column(String(255), nullable=False)
    position = Column(Integer, nullable=False, default=0)


class FeedSource(UserScopedBase):
    """A subscribed feed (RSS/Atom/YouTube/podcast)."""

    __tablename__ = "feed_sources"
    __table_args__ = (
        UniqueConstraint("user_id", "url", name="uq_feed_sources_user_url"),
    )

    title = Column(String(500), nullable=False)
    url = Column(Text, nullable=False)
    site_url = Column(Text, nullable=True)
    feed_type = Column(String(20), nullable=False, default="rss")  # rss|atom|youtube|podcast
    icon_url = Column(Text, nullable=True)
    folder_id = Column(
        UUID(as_uuid=True),
        ForeignKey("feed_folders.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    poll_interval_min = Column(Integer, nullable=False, default=60)
    last_polled_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    error_count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    folder = relationship("FeedFolder", foreign_keys=[folder_id])


class FeedItem(UserScopedBase):
    """Individual item from a feed source."""

    __tablename__ = "feed_items"
    __table_args__ = (
        UniqueConstraint("feed_source_id", "guid", name="uq_feed_items_source_guid"),
        Index("ix_feed_items_user_read", "user_id", "is_read"),
        Index("ix_feed_items_source_published", "user_id", "feed_source_id", "published_at"),
    )

    feed_source_id = Column(
        UUID(as_uuid=True),
        ForeignKey("feed_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    guid = Column(String(1000), nullable=False)
    title = Column(String(500), nullable=False)
    url = Column(Text, nullable=True)
    author = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    content_html = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    is_starred = Column(Boolean, nullable=False, default=False)
    kb_item_id = Column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    feed_source = relationship("FeedSource", backref="items")
