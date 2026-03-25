"""Add company info and key financial ratios to market_data_cache."""

revision = "007"
down_revision = "006"

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Company info
    op.add_column("market_data_cache", sa.Column("company_description", sa.Text, nullable=True))
    op.add_column("market_data_cache", sa.Column("website", sa.String(500), nullable=True))
    op.add_column("market_data_cache", sa.Column("full_time_employees", sa.Integer, nullable=True))
    op.add_column("market_data_cache", sa.Column("country", sa.String(100), nullable=True))
    op.add_column("market_data_cache", sa.Column("city", sa.String(100), nullable=True))

    # Key ratios
    op.add_column("market_data_cache", sa.Column("debt_to_equity", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("current_ratio", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("profit_margins", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("operating_margins", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("gross_margins", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("ebitda_margins", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("revenue_growth", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("earnings_growth", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("total_revenue", sa.BigInteger, nullable=True))
    op.add_column("market_data_cache", sa.Column("total_debt", sa.BigInteger, nullable=True))
    op.add_column("market_data_cache", sa.Column("total_cash", sa.BigInteger, nullable=True))
    op.add_column("market_data_cache", sa.Column("free_cashflow", sa.BigInteger, nullable=True))
    op.add_column("market_data_cache", sa.Column("ebitda", sa.BigInteger, nullable=True))
    op.add_column("market_data_cache", sa.Column("enterprise_value", sa.BigInteger, nullable=True))
    op.add_column("market_data_cache", sa.Column("forward_pe", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("peg_ratio", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("beta", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("return_on_assets", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("price_to_sales", sa.Float, nullable=True))

    # Analyst data
    op.add_column("market_data_cache", sa.Column("target_mean_price", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("target_high_price", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("target_low_price", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("recommendation_key", sa.String(30), nullable=True))
    op.add_column("market_data_cache", sa.Column("analyst_count", sa.Integer, nullable=True))

    # Ownership
    op.add_column("market_data_cache", sa.Column("held_pct_institutions", sa.Float, nullable=True))
    op.add_column("market_data_cache", sa.Column("held_pct_insiders", sa.Float, nullable=True))


def downgrade():
    cols = [
        "company_description", "website", "full_time_employees", "country", "city",
        "debt_to_equity", "current_ratio", "profit_margins", "operating_margins",
        "gross_margins", "ebitda_margins", "revenue_growth", "earnings_growth",
        "total_revenue", "total_debt", "total_cash", "free_cashflow", "ebitda",
        "enterprise_value", "forward_pe", "peg_ratio", "beta", "return_on_assets",
        "price_to_sales", "target_mean_price", "target_high_price", "target_low_price",
        "recommendation_key", "analyst_count", "held_pct_institutions", "held_pct_insiders",
    ]
    for col in cols:
        op.drop_column("market_data_cache", col)
