"""Database lifecycle for the Portfolio service."""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_engine = None
_session_factory = None


def init_db(database_url: str, echo: bool = False) -> None:
    """Initialize the async engine and session factory."""
    global _engine, _session_factory
    _engine = create_async_engine(database_url, echo=echo)
    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_session() -> AsyncSession:
    """FastAPI dependency — yields a scoped async session for the request."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    async with _session_factory() as session:
        yield session


async def close_db() -> None:
    """Dispose the engine on service shutdown."""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
