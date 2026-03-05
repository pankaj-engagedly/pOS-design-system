"""Database module — async SQLAlchemy session factory and user-scoped base model."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Engine and session factory — initialized by init_db()
_engine = None
_session_factory = None


class Base(DeclarativeBase):
    """Plain declarative base for models that don't need user scoping."""
    pass


class UserScopedBase(DeclarativeBase):
    """Declarative base for user-scoped models.

    All models extending this automatically get:
    - id: UUID primary key
    - user_id: UUID foreign key (indexed, non-nullable)
    - created_at: timestamp with timezone
    - updated_at: timestamp with timezone (auto-updates)
    """

    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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


def init_db(database_url: str, echo: bool = False):
    """Initialize the async engine and session factory."""
    global _engine, _session_factory

    _engine = create_async_engine(database_url, echo=echo)
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_async_session() -> AsyncSession:
    """Get an async database session. Use as async context manager."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")

    async with _session_factory() as session:
        yield session


async def close_db():
    """Close the database engine."""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
