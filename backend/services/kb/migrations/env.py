"""Alembic migration environment for the KB service."""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

# Add service root to path so 'app' is importable
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.models import (  # noqa: F401 — registers model metadata
    KBItem, KBHighlight, KBCollection, KBCollectionItem,
    FeedFolder, FeedSource, FeedItem,
)
from pos_contracts.models import UserScopedBase

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = UserScopedBase.metadata

OWNED_TABLES = {
    "kb_items", "kb_highlights",
    "kb_collections", "kb_collection_items",
    "feed_folders", "feed_sources", "feed_items",
}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table":
        return name in OWNED_TABLES
    if type_ == "index" and hasattr(object, "table"):
        return object.table.name in OWNED_TABLES
    return True


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        version_table="alembic_version_kb",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table="alembic_version_kb",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online():
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
