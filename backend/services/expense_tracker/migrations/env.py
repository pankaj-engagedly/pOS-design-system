"""Alembic migration environment for the Expense Tracker service."""

import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.models import Account, Category, CategoryRule, Transaction, StatementImport  # noqa: F401
from pos_contracts.models import UserScopedBase

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Allow DATABASE_URL env var to override alembic.ini (for Docker/production)
import os
if db_url := os.environ.get("DATABASE_URL"):
    config.set_main_option("sqlalchemy.url", db_url)

target_metadata = UserScopedBase.metadata

OWNED_TABLES = {
    "expense_accounts",
    "expense_categories",
    "expense_category_rules",
    "expense_transactions",
    "expense_statement_imports",
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
        version_table="alembic_version_expense_tracker",
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table="alembic_version_expense_tracker",
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
