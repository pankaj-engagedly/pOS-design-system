"""Base declarative models for pOS services.

These define the column structure contracts that all services share.
Database lifecycle (engine init, session factory) lives in each service's
own db.py — services own their connection pooling and can scale independently.
"""

import uuid
from datetime import datetime, timezone

import uuid_utils
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase


def _uuid7() -> uuid.UUID:
    """Generate a UUIDv7 as a standard uuid.UUID for SQLAlchemy compatibility.

    uuid_utils.uuid7() returns uuid_utils.UUID (a different type).
    SQLAlchemy's UUID(as_uuid=True) column expects uuid.UUID.
    We convert via the string representation — same bytes, correct type.
    """
    return uuid.UUID(str(uuid_utils.uuid7()))


class Base(DeclarativeBase):
    """Plain declarative base for models that don't need user scoping.

    Used by the auth service (User, RefreshToken) — these ARE the identity
    tables, so they manage their own primary keys and fields.
    """
    pass


class UserScopedBase(DeclarativeBase):
    """Declarative base for all user-owned domain models.

    Every model extending this automatically gets:
    - id: UUIDv7 primary key
    - user_id: UUID (set by gateway via X-User-Id header, indexed)
    - created_at / updated_at: timestamps with timezone

    Why UUIDv7 instead of UUIDv4?
    UUIDv4 is fully random — inserts scatter across B-tree index pages,
    causing page splits, cache misses, and write amplification at scale.
    UUIDv7 (RFC 9562) embeds a 48-bit millisecond timestamp prefix, making
    IDs monotonically increasing. New rows always append to the end of the
    index (same as bigint auto-increment) while keeping all UUID benefits:
    globally unique, non-guessable, no coordination between services needed.
    """

    __abstract__ = True

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        # _uuid7() — time-ordered UUIDv7, B-tree friendly (see class docstring)
        default=_uuid7,
    )
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
