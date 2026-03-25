"""Extract shared securities table from user-scoped watchlist items.

Market data (cache, snapshots, financials) moves from per-user-item to per-security.
"""

revision = "008"
down_revision = "007"

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


def upgrade():
    # 1. Create securities table
    op.create_table(
        "securities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("symbol", sa.String(30), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("asset_type", sa.String(20), nullable=False),
        sa.Column("exchange", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("symbol", "asset_type", name="uq_securities_symbol_type"),
        sa.Index("ix_securities_asset_type", "asset_type"),
    )

    # 2. Populate securities from distinct watchlist_items
    op.execute("""
        INSERT INTO securities (id, symbol, name, asset_type, exchange, created_at, updated_at)
        SELECT DISTINCT ON (symbol, asset_type)
            gen_random_uuid(), symbol, name, asset_type, exchange, created_at, updated_at
        FROM watchlist_items
        ORDER BY symbol, asset_type, created_at
    """)

    # 3. Add security_id to watchlist_items and populate
    op.add_column("watchlist_items", sa.Column("security_id", UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE watchlist_items wi
        SET security_id = s.id
        FROM securities s
        WHERE s.symbol = wi.symbol AND s.asset_type = wi.asset_type
    """)
    op.alter_column("watchlist_items", "security_id", nullable=False)
    op.create_foreign_key("fk_watchlist_items_security", "watchlist_items", "securities", ["security_id"], ["id"], ondelete="CASCADE")

    # 4. Add security_id to market_data_cache, populate, then drop old FK
    op.add_column("market_data_cache", sa.Column("security_id", UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE market_data_cache mdc
        SET security_id = wi.security_id
        FROM watchlist_items wi
        WHERE wi.id = mdc.watchlist_item_id
    """)
    # Deduplicate: keep one cache row per security (the most recently updated)
    op.execute("""
        DELETE FROM market_data_cache
        WHERE id NOT IN (
            SELECT DISTINCT ON (security_id) id
            FROM market_data_cache
            WHERE security_id IS NOT NULL
            ORDER BY security_id, updated_at DESC NULLS LAST
        )
    """)
    op.alter_column("market_data_cache", "security_id", nullable=False)
    op.create_foreign_key("fk_market_data_cache_security", "market_data_cache", "securities", ["security_id"], ["id"], ondelete="CASCADE")

    # Drop old constraint and column
    op.drop_constraint("uq_market_data_cache_item", "market_data_cache", type_="unique")
    op.drop_column("market_data_cache", "watchlist_item_id")
    op.drop_column("market_data_cache", "user_id")
    op.create_unique_constraint("uq_market_data_cache_security", "market_data_cache", ["security_id"])

    # 5. Same for metric_snapshots
    op.add_column("metric_snapshots", sa.Column("security_id", UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE metric_snapshots ms
        SET security_id = wi.security_id
        FROM watchlist_items wi
        WHERE wi.id = ms.watchlist_item_id
    """)
    # Deduplicate per security+date
    op.execute("""
        DELETE FROM metric_snapshots
        WHERE id NOT IN (
            SELECT DISTINCT ON (security_id, recorded_date) id
            FROM metric_snapshots
            WHERE security_id IS NOT NULL
            ORDER BY security_id, recorded_date, updated_at DESC NULLS LAST
        )
    """)
    op.alter_column("metric_snapshots", "security_id", nullable=False)
    op.create_foreign_key("fk_metric_snapshots_security", "metric_snapshots", "securities", ["security_id"], ["id"], ondelete="CASCADE")
    op.drop_constraint("uq_metric_snapshots_item_date", "metric_snapshots", type_="unique")
    op.drop_column("metric_snapshots", "watchlist_item_id")
    op.drop_column("metric_snapshots", "user_id")
    op.create_unique_constraint("uq_metric_snapshots_security_date", "metric_snapshots", ["security_id", "recorded_date"])

    # 6. Same for financial_statements
    op.add_column("financial_statements", sa.Column("security_id", UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE financial_statements fs
        SET security_id = wi.security_id
        FROM watchlist_items wi
        WHERE wi.id = fs.watchlist_item_id
    """)
    # Deduplicate per security+type+period+freq
    op.execute("""
        DELETE FROM financial_statements
        WHERE id NOT IN (
            SELECT DISTINCT ON (security_id, statement_type, fiscal_period, frequency) id
            FROM financial_statements
            WHERE security_id IS NOT NULL
            ORDER BY security_id, statement_type, fiscal_period, frequency, fetched_at DESC
        )
    """)
    op.alter_column("financial_statements", "security_id", nullable=False)
    op.create_foreign_key("fk_financial_statements_security", "financial_statements", "securities", ["security_id"], ["id"], ondelete="CASCADE")
    op.drop_constraint("uq_financial_stmt_item_type_period_freq", "financial_statements", type_="unique")
    op.drop_column("financial_statements", "watchlist_item_id")
    op.drop_column("financial_statements", "user_id")
    op.create_unique_constraint("uq_financial_stmt_security_type_period_freq", "financial_statements", ["security_id", "statement_type", "fiscal_period", "frequency"])

    # 7. Drop old unique constraint on watchlist_items and create new one
    op.drop_constraint("uq_watchlist_items_user_symbol", "watchlist_items", type_="unique")
    op.create_unique_constraint("uq_watchlist_items_user_security", "watchlist_items", ["user_id", "security_id"])

    # 8. Update alembic version
    op.execute("UPDATE alembic_version_watchlist SET version_num = '008'")


def downgrade():
    pass  # Destructive migration — no downgrade
