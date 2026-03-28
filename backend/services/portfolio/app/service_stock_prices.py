"""Stock price service — fetch EOD prices via yfinance, cache in stock_price_cache."""

from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from uuid import UUID as UUID_type

from loguru import logger
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .models import StockPriceCache

SYSTEM_USER_ID = UUID_type("00000000-0000-0000-0000-000000000000")


async def fetch_stock_prices(
    session: AsyncSession,
    symbols: set[str],
    exchange: str = "NSE",
) -> dict:
    """Fetch latest closing prices for given symbols and cache them.

    Uses yfinance with .NS suffix for NSE, .BO for BSE.
    Returns dict with counts: total, updated, errors.
    """
    import yfinance as yf

    if not symbols:
        return {"total": 0, "updated": 0, "errors": 0}

    suffix = ".NS" if exchange == "NSE" else ".BO"
    yf_symbols = [f"{s}{suffix}" for s in symbols]

    logger.info(f"Fetching stock prices for {len(symbols)} symbols from {exchange}")

    updated = 0
    errors = 0

    # Batch fetch using yfinance download (more efficient than individual calls)
    try:
        tickers = yf.Tickers(" ".join(yf_symbols))

        for symbol in symbols:
            yf_symbol = f"{symbol}{suffix}"
            try:
                ticker = tickers.tickers.get(yf_symbol)
                if not ticker:
                    errors += 1
                    continue

                info = ticker.fast_info
                last_price = getattr(info, "last_price", None)
                if last_price is None:
                    # Fallback: try history
                    hist = ticker.history(period="5d")
                    if not hist.empty:
                        last_price = float(hist["Close"].iloc[-1])
                        price_date = hist.index[-1].date()
                    else:
                        logger.warning(f"No price data for {symbol}")
                        errors += 1
                        continue
                else:
                    price_date = date.today()

                price = Decimal(str(round(last_price, 4)))

                # Upsert
                existing = await session.execute(
                    select(StockPriceCache).where(
                        StockPriceCache.symbol == symbol,
                        StockPriceCache.exchange == exchange,
                        StockPriceCache.price_date == price_date,
                    )
                )
                row = existing.scalar_one_or_none()
                if row:
                    row.price = price
                else:
                    session.add(StockPriceCache(
                        user_id=SYSTEM_USER_ID,
                        symbol=symbol,
                        exchange=exchange,
                        price=price,
                        price_date=price_date,
                    ))
                updated += 1

            except Exception as e:
                logger.warning(f"Error fetching price for {symbol}: {e}")
                errors += 1
                continue

    except Exception as e:
        logger.error(f"Batch price fetch failed: {e}")
        # Fall back to individual fetches
        for symbol in symbols:
            try:
                ticker = yf.Ticker(f"{symbol}{suffix}")
                hist = ticker.history(period="5d")
                if hist.empty:
                    errors += 1
                    continue

                last_price = float(hist["Close"].iloc[-1])
                price_date = hist.index[-1].date()
                price = Decimal(str(round(last_price, 4)))

                existing = await session.execute(
                    select(StockPriceCache).where(
                        StockPriceCache.symbol == symbol,
                        StockPriceCache.exchange == exchange,
                        StockPriceCache.price_date == price_date,
                    )
                )
                row = existing.scalar_one_or_none()
                if row:
                    row.price = price
                else:
                    session.add(StockPriceCache(
                        user_id=SYSTEM_USER_ID,
                        symbol=symbol,
                        exchange=exchange,
                        price=price,
                        price_date=price_date,
                    ))
                updated += 1
            except Exception as e:
                logger.warning(f"Individual fetch failed for {symbol}: {e}")
                errors += 1

    await session.commit()
    logger.info(f"Stock price update: {len(symbols)} total, {updated} updated, {errors} errors")

    return {"total": len(symbols), "updated": updated, "errors": errors}


async def fetch_prices_for_portfolio_stocks(session: AsyncSession, user_id) -> dict:
    """Fetch prices only for stocks held in user's portfolios."""
    result = await session.execute(
        text("""
            SELECT DISTINCT amfi_code FROM transactions
            WHERE user_id = :uid AND asset_class = 'stock' AND amfi_code IS NOT NULL
        """),
        {"uid": str(user_id)},
    )
    symbols = {row[0] for row in result.all()}
    if not symbols:
        return {"total": 0, "updated": 0, "errors": 0}

    logger.info(f"Fetching prices for {len(symbols)} held stocks")
    return await fetch_stock_prices(session, symbols)


async def get_latest_stock_price(
    session: AsyncSession, symbol: str, exchange: str = "NSE"
) -> Decimal | None:
    """Get the most recent cached price for a stock symbol."""
    result = await session.execute(
        select(StockPriceCache.price)
        .where(
            StockPriceCache.symbol == symbol,
            StockPriceCache.exchange == exchange,
        )
        .order_by(StockPriceCache.price_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
