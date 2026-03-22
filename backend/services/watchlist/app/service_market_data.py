"""Market data integration — yfinance for stocks, mftool for Indian mutual funds."""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import MarketDataCache, WatchlistItem


def _safe_float(val) -> float | None:
    """Convert to float safely, return None on failure."""
    if val is None:
        return None
    try:
        f = float(val)
        # yfinance sometimes returns inf or nan
        import math
        if math.isinf(f) or math.isnan(f):
            return None
        return f
    except (TypeError, ValueError):
        return None


def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def fetch_stock_data(symbol: str) -> dict:
    """Fetch stock data from yfinance (synchronous — run in thread)."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    # Price data
    current_price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    previous_close = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
    day_change = None
    day_change_pct = None
    if current_price and previous_close and previous_close != 0:
        day_change = round(current_price - previous_close, 2)
        day_change_pct = round((day_change / previous_close) * 100, 2)

    # Sparkline: 30-day history
    sparkline = []
    try:
        hist = ticker.history(period="1mo")
        if not hist.empty:
            sparkline = [round(p, 2) for p in hist["Close"].tolist()[-30:]]
    except Exception:
        pass

    return {
        "currency": info.get("currency"),
        "financial_currency": info.get("financialCurrency") or info.get("currency"),
        "current_price": current_price,
        "previous_close": previous_close,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "pe_ratio": _safe_float(info.get("trailingPE")),
        "pb_ratio": _safe_float(info.get("priceToBook")),
        "market_cap": _safe_int(info.get("marketCap")),
        "roe": _safe_float(info.get("returnOnEquity")),
        "roce": None,
        "eps": _safe_float(info.get("trailingEps")),
        "book_value": _safe_float(info.get("bookValue")),
        "dividend_yield": _safe_float(info.get("dividendYield")),
        "fifty_two_week_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "fifty_two_week_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        "industry": info.get("industry"),
        "sector": info.get("sector"),
        "sparkline_data": sparkline,
    }


def fetch_mf_data(scheme_code: str) -> dict:
    """Fetch mutual fund data from mftool (synchronous — run in thread)."""
    from mftool import Mftool
    mf = Mftool()

    nav_data = mf.get_scheme_quote(scheme_code)
    if not nav_data:
        return {}

    nav = _safe_float(nav_data.get("scheme_nav"))

    # Historical for sparkline
    sparkline = []
    try:
        hist = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if hist is not None and not hist.empty:
            # mftool returns oldest first
            prices = hist["nav"].astype(float).tolist()[-30:]
            sparkline = [round(p, 2) for p in prices]
    except Exception:
        pass

    # Calculate day change from sparkline
    day_change = None
    day_change_pct = None
    if len(sparkline) >= 2:
        prev = sparkline[-2]
        curr = sparkline[-1]
        if prev and prev != 0:
            day_change = round(curr - prev, 2)
            day_change_pct = round((day_change / prev) * 100, 2)

    return {
        "currency": "INR",
        "financial_currency": "INR",
        "nav": nav,
        "current_price": nav,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "category": nav_data.get("scheme_category"),
        "sparkline_data": sparkline,
    }


def fetch_etf_data(symbol: str) -> dict:
    """Fetch ETF data from yfinance."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    current_price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice") or info.get("navPrice"))
    previous_close = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
    day_change = None
    day_change_pct = None
    if current_price and previous_close and previous_close != 0:
        day_change = round(current_price - previous_close, 2)
        day_change_pct = round((day_change / previous_close) * 100, 2)

    sparkline = []
    try:
        hist = ticker.history(period="1mo")
        if not hist.empty:
            sparkline = [round(p, 2) for p in hist["Close"].tolist()[-30:]]
    except Exception:
        pass

    return {
        "currency": info.get("currency"),
        "financial_currency": info.get("financialCurrency") or info.get("currency"),
        "current_price": current_price,
        "previous_close": previous_close,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "nav": _safe_float(info.get("navPrice")),
        "expense_ratio": _safe_float(info.get("annualReportExpenseRatio") or info.get("netExpenseRatio")),
        "aum": _safe_float(info.get("totalAssets")),
        "market_cap": _safe_int(info.get("marketCap")),
        "holdings_count": _safe_int(info.get("holdings")),
        "dividend_yield": _safe_float(info.get("yield") or info.get("dividendYield")),
        "fifty_two_week_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "fifty_two_week_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        "category": info.get("category"),
        "sparkline_data": sparkline,
    }


def fetch_precious_metal_data(symbol: str) -> dict:
    """Fetch precious metal / commodity data from yfinance."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    current_price = _safe_float(
        info.get("regularMarketPrice") or info.get("currentPrice")
        or info.get("previousClose")
    )
    previous_close = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
    day_change = None
    day_change_pct = None
    if current_price and previous_close and previous_close != 0:
        day_change = round(current_price - previous_close, 2)
        day_change_pct = round((day_change / previous_close) * 100, 2)

    sparkline = []
    try:
        hist = ticker.history(period="1mo")
        if not hist.empty:
            sparkline = [round(p, 2) for p in hist["Close"].tolist()[-30:]]
    except Exception:
        pass

    return {
        "currency": info.get("currency", "USD"),
        "financial_currency": info.get("currency", "USD"),
        "current_price": current_price,
        "previous_close": previous_close,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "fifty_two_week_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "fifty_two_week_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        "sparkline_data": sparkline,
    }


def fetch_bond_data(symbol: str) -> dict:
    """Fetch bond/treasury data from yfinance."""
    import yfinance as yf
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    current_price = _safe_float(
        info.get("regularMarketPrice") or info.get("currentPrice")
        or info.get("previousClose")
    )
    previous_close = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
    day_change = None
    day_change_pct = None
    if current_price and previous_close and previous_close != 0:
        day_change = round(current_price - previous_close, 2)
        day_change_pct = round((day_change / previous_close) * 100, 2)

    sparkline = []
    try:
        hist = ticker.history(period="1mo")
        if not hist.empty:
            sparkline = [round(p, 2) for p in hist["Close"].tolist()[-30:]]
    except Exception:
        pass

    return {
        "currency": info.get("currency", "USD"),
        "financial_currency": info.get("currency", "USD"),
        "current_price": current_price,
        "previous_close": previous_close,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "bond_yield": _safe_float(info.get("yield") or info.get("dividendYield")),
        "fifty_two_week_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "fifty_two_week_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        "sparkline_data": sparkline,
    }


def fetch_crypto_data(symbol: str) -> dict:
    """Fetch cryptocurrency data from yfinance."""
    import yfinance as yf
    # Ensure -USD suffix for crypto
    if not symbol.endswith("-USD") and not symbol.endswith("=F"):
        symbol = f"{symbol}-USD"
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}

    current_price = _safe_float(info.get("currentPrice") or info.get("regularMarketPrice"))
    previous_close = _safe_float(info.get("previousClose") or info.get("regularMarketPreviousClose"))
    day_change = None
    day_change_pct = None
    if current_price and previous_close and previous_close != 0:
        day_change = round(current_price - previous_close, 2)
        day_change_pct = round((day_change / previous_close) * 100, 2)

    sparkline = []
    try:
        hist = ticker.history(period="1mo")
        if not hist.empty:
            sparkline = [round(p, 2) for p in hist["Close"].tolist()[-30:]]
    except Exception:
        pass

    return {
        "currency": info.get("currency", "USD"),
        "financial_currency": info.get("currency", "USD"),
        "current_price": current_price,
        "previous_close": previous_close,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "market_cap": _safe_int(info.get("marketCap")),
        "volume_24h": _safe_float(info.get("volume24Hr") or info.get("regularMarketVolume")),
        "circulating_supply": _safe_float(info.get("circulatingSupply")),
        "fifty_two_week_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "fifty_two_week_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        "sparkline_data": sparkline,
    }


# ── Dispatch dicts ─────────────────────────────────────

FETCH_DISPATCH = {
    "stock": fetch_stock_data,
    "mutual_fund": fetch_mf_data,
    "etf": fetch_etf_data,
    "precious_metal": fetch_precious_metal_data,
    "bond": fetch_bond_data,
    "crypto": fetch_crypto_data,
}


def search_stocks(query: str) -> list[dict]:
    """Search stocks via yfinance."""
    import yfinance as yf
    try:
        results = []
        # yfinance search
        search = yf.Search(query)
        for quote in (search.quotes or [])[:15]:
            symbol = quote.get("symbol", "")
            name = quote.get("shortname") or quote.get("longname") or symbol
            exchange = quote.get("exchange", "")
            results.append({
                "symbol": symbol,
                "name": name,
                "exchange": exchange,
                "asset_type": "stock",
            })
        return results
    except Exception as e:
        logger.warning(f"Stock search error: {e}")
        return []


def search_mutual_funds(query: str) -> list[dict]:
    """Search Indian mutual funds via mftool."""
    from mftool import Mftool
    try:
        mf = Mftool()
        all_schemes = mf.get_scheme_codes()
        query_lower = query.lower()
        results = []
        for code, name in all_schemes.items():
            if query_lower in name.lower():
                results.append({
                    "symbol": str(code),
                    "name": name,
                    "exchange": "AMFI",
                    "asset_type": "mutual_fund",
                })
                if len(results) >= 15:
                    break
        return results
    except Exception as e:
        logger.warning(f"MF search error: {e}")
        return []


def search_etfs(query: str) -> list[dict]:
    """Search ETFs via yfinance, filtering by quoteType."""
    import yfinance as yf
    try:
        results = []
        search = yf.Search(query)
        for quote in (search.quotes or [])[:30]:
            qt = quote.get("quoteType", "")
            if qt == "ETF":
                symbol = quote.get("symbol", "")
                name = quote.get("shortname") or quote.get("longname") or symbol
                exchange = quote.get("exchange", "")
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "exchange": exchange,
                    "asset_type": "etf",
                })
                if len(results) >= 15:
                    break
        return results
    except Exception as e:
        logger.warning(f"ETF search error: {e}")
        return []


def search_precious_metals(query: str) -> list[dict]:
    """Search precious metals from hardcoded list."""
    from .asset_classes import PRECIOUS_METALS_LIST
    query_lower = query.lower()
    results = []
    for item in PRECIOUS_METALS_LIST:
        if query_lower in item["name"].lower() or query_lower in item["symbol"].lower():
            results.append({**item, "asset_type": "precious_metal"})
    # Also try yfinance for commodity futures
    if len(results) < 5:
        import yfinance as yf
        try:
            search = yf.Search(query)
            for quote in (search.quotes or [])[:15]:
                symbol = quote.get("symbol", "")
                if symbol.endswith("=F") or quote.get("quoteType") == "FUTURE":
                    name = quote.get("shortname") or quote.get("longname") or symbol
                    if not any(r["symbol"] == symbol for r in results):
                        results.append({
                            "symbol": symbol,
                            "name": name,
                            "exchange": quote.get("exchange", ""),
                            "asset_type": "precious_metal",
                        })
                        if len(results) >= 15:
                            break
        except Exception:
            pass
    return results[:15]


def search_bonds(query: str) -> list[dict]:
    """Search bond instruments from hardcoded list + yfinance."""
    from .asset_classes import BOND_INSTRUMENTS_LIST
    query_lower = query.lower()
    results = []
    for item in BOND_INSTRUMENTS_LIST:
        if query_lower in item["name"].lower() or query_lower in item["symbol"].lower():
            results.append({**item, "asset_type": "bond"})
    # Also try yfinance
    if len(results) < 5:
        import yfinance as yf
        try:
            search = yf.Search(query)
            for quote in (search.quotes or [])[:15]:
                symbol = quote.get("symbol", "")
                name = quote.get("shortname") or quote.get("longname") or symbol
                name_lower = (name or "").lower()
                if any(kw in name_lower for kw in ("bond", "treasury", "fixed income", "yield")):
                    if not any(r["symbol"] == symbol for r in results):
                        results.append({
                            "symbol": symbol,
                            "name": name,
                            "exchange": quote.get("exchange", ""),
                            "asset_type": "bond",
                        })
                        if len(results) >= 15:
                            break
        except Exception:
            pass
    return results[:15]


def search_crypto(query: str) -> list[dict]:
    """Search cryptocurrencies via yfinance."""
    import yfinance as yf
    try:
        results = []
        search = yf.Search(query)
        for quote in (search.quotes or [])[:30]:
            qt = quote.get("quoteType", "")
            symbol = quote.get("symbol", "")
            if qt == "CRYPTOCURRENCY" or symbol.endswith("-USD"):
                name = quote.get("shortname") or quote.get("longname") or symbol
                exchange = quote.get("exchange", "")
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "exchange": exchange,
                    "asset_type": "crypto",
                })
                if len(results) >= 15:
                    break
        return results
    except Exception as e:
        logger.warning(f"Crypto search error: {e}")
        return []


SEARCH_DISPATCH = {
    "stock": search_stocks,
    "mutual_fund": search_mutual_funds,
    "etf": search_etfs,
    "precious_metal": search_precious_metals,
    "bond": search_bonds,
    "crypto": search_crypto,
}


def fetch_price_history(symbol: str, asset_type: str, period: str = "1y") -> list[dict]:
    """Fetch historical price data for charting."""
    if asset_type == "mutual_fund":
        return _fetch_mf_history(symbol, period)
    # All yfinance-based types use stock history
    return _fetch_stock_history(symbol, period)


def _fetch_stock_history(symbol: str, period: str) -> list[dict]:
    import yfinance as yf
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period)
        if hist.empty:
            return []
        result = []
        for date, row in hist.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            })
        return result
    except Exception as e:
        logger.warning(f"Stock history error for {symbol}: {e}")
        return []


def _fetch_mf_history(scheme_code: str, period: str) -> list[dict]:
    from mftool import Mftool
    try:
        mf = Mftool()
        hist = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if hist is None or hist.empty:
            return []
        # Filter by period
        from datetime import timedelta
        period_map = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "3y": 1095, "5y": 1825}
        days = period_map.get(period, 365)
        cutoff = datetime.now() - timedelta(days=days)
        result = []
        for date_str, row in hist.iterrows():
            try:
                from datetime import datetime as dt
                d = dt.strptime(str(date_str), "%d-%m-%Y")
                if d >= cutoff:
                    result.append({
                        "date": d.strftime("%Y-%m-%d"),
                        "close": round(float(row["nav"]), 2),
                    })
            except (ValueError, TypeError):
                continue
        return result
    except Exception as e:
        logger.warning(f"MF history error for {scheme_code}: {e}")
        return []


def fetch_financials(symbol: str) -> dict:
    """Fetch income statement and balance sheet from yfinance (stocks only)."""
    import yfinance as yf
    try:
        ticker = yf.Ticker(symbol)
        result = {"income_statement": [], "balance_sheet": []}

        # Income statement
        income = ticker.financials
        if income is not None and not income.empty:
            for col in income.columns[:4]:  # Last 4 years
                year_data = {"period": col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)}
                for idx in income.index:
                    val = income.loc[idx, col]
                    year_data[str(idx)] = float(val) if val is not None and str(val) != "nan" else None
                result["income_statement"].append(year_data)

        # Balance sheet
        balance = ticker.balance_sheet
        if balance is not None and not balance.empty:
            for col in balance.columns[:4]:
                year_data = {"period": col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)}
                for idx in balance.index:
                    val = balance.loc[idx, col]
                    year_data[str(idx)] = float(val) if val is not None and str(val) != "nan" else None
                result["balance_sheet"].append(year_data)

        return result
    except Exception as e:
        logger.warning(f"Financials error for {symbol}: {e}")
        return {"income_statement": [], "balance_sheet": []}


async def fetch_market_data_for_item(item_id: UUID, symbol: str, asset_type: str) -> None:
    """Background task: fetch and cache market data for one item."""
    try:
        loop = asyncio.get_event_loop()
        fetch_fn = FETCH_DISPATCH.get(asset_type, fetch_stock_data)
        data = await loop.run_in_executor(None, fetch_fn, symbol)

        if not data:
            logger.warning(f"No market data returned for {symbol}")
            return

        # Update cache in DB
        async for session in get_session():
            result = await session.execute(
                select(MarketDataCache).where(MarketDataCache.watchlist_item_id == item_id)
            )
            cache = result.scalar_one_or_none()
            if not cache:
                return

            now = datetime.now(timezone.utc)
            for key, val in data.items():
                if hasattr(cache, key):
                    setattr(cache, key, val)
            cache.price_fetched_at = now
            cache.fundamentals_fetched_at = now
            await session.commit()
            logger.info(f"Market data cached for {symbol}")

    except Exception as e:
        logger.error(f"Failed to fetch market data for {symbol}: {e}")


async def refresh_all_items() -> None:
    """Refresh market data for all watchlist items."""
    async for session in get_session():
        result = await session.execute(select(WatchlistItem))
        items = list(result.scalars().all())
        logger.info(f"Refreshing market data for {len(items)} items")

        for item in items:
            try:
                await fetch_market_data_for_item(item.id, item.symbol, item.asset_type)
            except Exception as e:
                logger.warning(f"Refresh failed for {item.symbol}: {e}")
