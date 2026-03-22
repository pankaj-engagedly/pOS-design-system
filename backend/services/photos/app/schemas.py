"""Photos Pydantic schemas for request/response validation."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# ── Photos ───────────────────────────────────────────────


class PhotoUpdate(BaseModel):
    caption: str | None = None
    is_favourite: bool | None = None
    rating: int | None = Field(None, ge=1, le=5)
    location_name: str | None = None
    taken_at: datetime | None = None


class TagInfo(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class PersonInfo(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class AlbumInfo(BaseModel):
    id: UUID
    name: str

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: UUID
    photo_id: UUID
    text: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhotoSummary(BaseModel):
    """Photo with lightweight metadata — used in grid/list views."""
    id: UUID
    filename: str
    content_type: str
    file_size: int
    width: int | None
    height: int | None
    taken_at: datetime | None
    is_favourite: bool
    caption: str | None
    rating: int | None
    duration: float | None = None
    source_type: str
    source_removed: bool = False
    processing_status: str
    exif_data: dict | None = None
    tags: list[TagInfo] = []
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PhotoResponse(BaseModel):
    """Full photo detail with EXIF, tags, people, albums, comments."""
    id: UUID
    filename: str
    content_type: str
    file_size: int
    width: int | None
    height: int | None
    file_hash: str
    perceptual_hash: str | None
    taken_at: datetime | None
    latitude: float | None
    longitude: float | None
    location_name: str | None
    exif_data: dict | None
    is_favourite: bool
    caption: str | None
    rating: int | None
    duration: float | None = None
    source_type: str
    source_account: str | None
    source_removed: bool = False
    processing_status: str
    tags: list[TagInfo] = []
    people: list[PersonInfo] = []
    albums: list[AlbumInfo] = []
    comments: list[CommentResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TimelineGroup(BaseModel):
    date: str
    photos: list[PhotoSummary]


# ── Albums ───────────────────────────────────────────────


class AlbumCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class AlbumUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    cover_photo_id: UUID | None = None
    position: int | None = None
    is_pinned: bool | None = None


class AlbumPhotosAdd(BaseModel):
    photo_ids: list[UUID]


class AlbumResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    cover_photo_id: UUID | None
    album_type: str
    position: int
    is_pinned: bool
    photo_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AlbumDetailResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    cover_photo_id: UUID | None
    album_type: str
    position: int
    is_pinned: bool
    photos: list[PhotoSummary] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Comments ─────────────────────────────────────────────


class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1)


class CommentUpdate(BaseModel):
    text: str = Field(..., min_length=1)


# ── People ───────────────────────────────────────────────


class PersonCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class PersonUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    cover_photo_id: UUID | None = None


class PersonResponse(BaseModel):
    id: UUID
    name: str
    cover_photo_id: UUID | None
    photo_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PersonTagRequest(BaseModel):
    person_id: UUID


class PersonMergeRequest(BaseModel):
    merge_into_id: UUID


# ── Tags ─────────────────────────────────────────────────


class TagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TagWithCount(BaseModel):
    id: UUID
    name: str
    photo_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Stats ────────────────────────────────────────────────


class PhotoStatsResponse(BaseModel):
    total: int = 0
    favourites: int = 0
    by_source: dict[str, int] = {}
    date_range: dict | None = None
    storage_used: int = 0


# ── Photo Sources ───────────────────────────────────────


class PhotoSourceCreate(BaseModel):
    provider: str = Field(..., pattern=r"^(folder|apple_photos)$")
    source_path: str = Field(..., min_length=1, max_length=1000)
    label: str | None = Field(None, max_length=255)


class PhotoSourceUpdate(BaseModel):
    label: str | None = Field(None, max_length=255)
    is_active: bool | None = None


class PhotoSourceResponse(BaseModel):
    id: UUID
    provider: str
    source_path: str
    label: str | None
    is_active: bool
    sync_status: str
    last_sync_at: datetime | None
    last_error: str | None
    photo_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
