"""KB Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── KB Items ─────────────────────────────────────────────


class KBItemCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    url: str | None = None
    item_type: str = Field("url", pattern=r"^(url|media|image|document|text)$")
    content: dict | None = None
    preview_text: str | None = None
    thumbnail_url: str | None = None
    source: str | None = None
    author: str | None = None


class SaveURLRequest(BaseModel):
    url: str = Field(..., min_length=1)
    title: str | None = None
    description: str | None = None
    image: str | None = None
    author: str | None = None
    site_name: str | None = None
    item_type: str | None = None


class PreviewURLRequest(BaseModel):
    url: str = Field(..., min_length=1)


class PreviewURLResponse(BaseModel):
    title: str = ""
    description: str = ""
    image: str = ""
    author: str = ""
    site_name: str = ""
    item_type: str = "url"
    word_count: int | None = None
    reading_time_min: int | None = None


class KBItemUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    url: str | None = None
    item_type: str | None = Field(None, pattern=r"^(url|media|image|document|text)$")
    content: dict | None = None
    preview_text: str | None = None
    rating: int | None = Field(None, ge=1, le=5)
    is_favourite: bool | None = None
    source: str | None = None
    author: str | None = None


class TagInfo(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class HighlightResponse(BaseModel):
    id: UUID
    kb_item_id: UUID
    text: str
    note: str | None
    color: str
    position_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class KBItemSummaryResponse(BaseModel):
    """KB item without content — used in list views."""
    id: UUID
    title: str
    url: str | None
    source: str | None
    author: str | None
    item_type: str
    preview_text: str | None
    thumbnail_url: str | None
    site_name: str | None
    rating: int | None
    is_favourite: bool
    reading_time_min: int | None
    word_count: int | None
    published_at: datetime | None
    feed_item_id: UUID | None
    tags: list[TagInfo] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class KBItemResponse(BaseModel):
    """Full KB item with content, highlights, tags."""
    id: UUID
    title: str
    url: str | None
    source: str | None
    author: str | None
    item_type: str
    content: dict | None
    preview_text: str | None
    thumbnail_url: str | None
    site_name: str | None
    rating: int | None
    is_favourite: bool
    reading_time_min: int | None
    word_count: int | None
    published_at: datetime | None
    feed_item_id: UUID | None
    tags: list[TagInfo] = []
    highlights: list[HighlightResponse] = []
    collection_ids: list[UUID] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Highlights ───────────────────────────────────────────


class HighlightCreate(BaseModel):
    text: str = Field(..., min_length=1)
    note: str | None = None
    color: str = Field("yellow", pattern=r"^(yellow|green|blue|pink)$")
    position_data: dict | None = None


class HighlightUpdate(BaseModel):
    note: str | None = None
    color: str | None = Field(None, pattern=r"^(yellow|green|blue|pink)$")


# ── Collections ──────────────────────────────────────────


class CollectionCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    cover_color: str | None = Field(None, max_length=20)
    icon: str | None = Field(None, max_length=50)
    is_pinned: bool = False


class CollectionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    cover_color: str | None = Field(None, max_length=20)
    icon: str | None = Field(None, max_length=50)
    is_pinned: bool | None = None


class CollectionItemAdd(BaseModel):
    kb_item_id: UUID


class CollectionResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    cover_color: str | None
    icon: str | None
    position: int
    is_pinned: bool = False
    item_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class CollectionDetailResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    cover_color: str | None
    icon: str | None
    position: int
    is_pinned: bool = False
    items: list[KBItemSummaryResponse] = []
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Tags ─────────────────────────────────────────────────


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TagWithCount(BaseModel):
    id: UUID
    name: str
    kb_item_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Stats ────────────────────────────────────────────────


class KBStatsResponse(BaseModel):
    total: int = 0
    by_type: dict[str, int] = {}
    favourites: int = 0


# ── Feeds ────────────────────────────────────────────────


class FeedFolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class FeedFolderUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)


class FeedFolderResponse(BaseModel):
    id: UUID
    name: str
    position: int
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedSourceCreate(BaseModel):
    url: str = Field(..., min_length=1)
    folder_id: UUID | None = None


class FeedSourceUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    folder_id: UUID | None = None
    poll_interval_min: int | None = Field(None, ge=5, le=1440)


class FeedDiscoverRequest(BaseModel):
    url: str = Field(..., min_length=1)


class FeedDiscoverResponse(BaseModel):
    title: str
    url: str
    site_url: str | None
    feed_type: str
    icon_url: str | None
    item_count: int = 0


class FeedSourceResponse(BaseModel):
    id: UUID
    title: str
    url: str
    site_url: str | None
    feed_type: str
    icon_url: str | None
    folder_id: UUID | None
    poll_interval_min: int
    last_polled_at: datetime | None
    is_active: bool
    unread_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedItemUpdate(BaseModel):
    is_read: bool | None = None
    is_starred: bool | None = None


class FeedItemResponse(BaseModel):
    id: UUID
    feed_source_id: UUID
    guid: str
    title: str
    url: str | None
    author: str | None
    summary: str | None
    thumbnail_url: str | None
    published_at: datetime | None
    is_read: bool
    is_starred: bool
    kb_item_id: UUID | None
    source_title: str | None = None
    source_icon_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MarkAllReadRequest(BaseModel):
    source_id: UUID | None = None
    folder_id: UUID | None = None


class FeedStatsResponse(BaseModel):
    total_unread: int = 0
    by_source: dict[str, int] = {}
    by_folder: dict[str, int] = {}
