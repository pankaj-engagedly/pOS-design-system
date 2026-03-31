"""Market data integration — yfinance for stocks, mftool for Indian mutual funds."""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .models import MarketDataCache, Security, WatchlistItem


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
        # Company info
        "company_description": (info.get("longBusinessSummary") or "")[:5000] or None,
        "website": info.get("website"),
        "full_time_employees": _safe_int(info.get("fullTimeEmployees")),
        "country": info.get("country"),
        "city": info.get("city"),
        "industry": info.get("industry"),
        "sector": info.get("sector"),
        # Valuation
        "pe_ratio": _safe_float(info.get("trailingPE")),
        "pb_ratio": _safe_float(info.get("priceToBook")),
        "forward_pe": _safe_float(info.get("forwardPE")),
        "peg_ratio": _safe_float(info.get("pegRatio")),
        "price_to_sales": _safe_float(info.get("priceToSalesTrailing12Months")),
        "market_cap": _safe_int(info.get("marketCap")),
        "enterprise_value": _safe_int(info.get("enterpriseValue")),
        "eps": _safe_float(info.get("trailingEps")),
        "book_value": _safe_float(info.get("bookValue")),
        "beta": _safe_float(info.get("beta")),
        # Profitability & growth
        "roe": _safe_float(info.get("returnOnEquity")),
        "return_on_assets": _safe_float(info.get("returnOnAssets")),
        "profit_margins": _safe_float(info.get("profitMargins")),
        "operating_margins": _safe_float(info.get("operatingMargins")),
        "gross_margins": _safe_float(info.get("grossMargins")),
        "ebitda_margins": _safe_float(info.get("ebitdaMargins")),
        "revenue_growth": _safe_float(info.get("revenueGrowth")),
        "earnings_growth": _safe_float(info.get("earningsGrowth")),
        # Financial aggregates
        "total_revenue": _safe_int(info.get("totalRevenue")),
        "total_debt": _safe_int(info.get("totalDebt")),
        "total_cash": _safe_int(info.get("totalCash")),
        "free_cashflow": _safe_int(info.get("freeCashflow")),
        "ebitda": _safe_int(info.get("ebitda")),
        "debt_to_equity": _safe_float(info.get("debtToEquity")),
        "current_ratio": _safe_float(info.get("currentRatio")),
        "dividend_yield": _safe_float(info.get("dividendYield")),
        "fifty_two_week_low": _safe_float(info.get("fiftyTwoWeekLow")),
        "fifty_two_week_high": _safe_float(info.get("fiftyTwoWeekHigh")),
        # Analyst
        "target_mean_price": _safe_float(info.get("targetMeanPrice")),
        "target_high_price": _safe_float(info.get("targetHighPrice")),
        "target_low_price": _safe_float(info.get("targetLowPrice")),
        "recommendation_key": info.get("recommendationKey"),
        "analyst_count": _safe_int(info.get("numberOfAnalystOpinions")),
        # Ownership
        "held_pct_institutions": _safe_float(info.get("heldPercentInstitutions")),
        "held_pct_insiders": _safe_float(info.get("heldPercentInsiders")),
        "sparkline_data": sparkline,
    }


def fetch_mf_data(scheme_code: str) -> dict:
    """Fetch mutual fund data from mftool (synchronous — run in thread)."""
    from mftool import Mftool
    from datetime import datetime as dt, timedelta
    mf = Mftool()

    nav_data = mf.get_scheme_quote(scheme_code)
    if not nav_data:
        return {}

    nav = _safe_float(nav_data.get("nav") or nav_data.get("scheme_nav"))

    # Get scheme details for metadata
    details = {}
    try:
        details = mf.get_scheme_details(scheme_code) or {}
    except Exception:
        pass

    # Historical NAV for sparkline + return calculations
    sparkline = []
    all_navs = []  # (date, nav) for return calculation
    try:
        hist = mf.get_scheme_historical_nav(scheme_code, as_Dataframe=True)
        if hist is not None and not hist.empty:
            prices = hist["nav"].astype(float).tolist()
            sparkline = [round(p, 2) for p in prices[-30:]]
            # Parse dates for return calculation
            for date_str, row in hist.iterrows():
                try:
                    d = dt.strptime(str(date_str), "%d-%m-%Y")
                    all_navs.append((d, float(row["nav"])))
                except (ValueError, TypeError):
                    continue
    except Exception:
        pass

    # Calculate day change
    day_change = None
    day_change_pct = None
    if len(sparkline) >= 2:
        prev = sparkline[-2]
        curr = sparkline[-1]
        if prev and prev != 0:
            day_change = round(curr - prev, 2)
            day_change_pct = round((day_change / prev) * 100, 2)

    # Calculate returns from NAV history
    return_1y = return_3y = return_5y = None
    if nav and all_navs:
        now = dt.now()
        for years, attr in [(1, 'return_1y'), (3, 'return_3y'), (5, 'return_5y')]:
            target_date = now - timedelta(days=years * 365)
            # Find NAV closest to target date
            closest = min(all_navs, key=lambda x: abs((x[0] - target_date).days), default=None)
            if closest and abs((closest[0] - target_date).days) < 30 and closest[1] > 0:
                ret = ((nav / closest[1]) - 1) * 100
                if attr == 'return_1y':
                    return_1y = round(ret, 2)
                elif attr == 'return_3y':
                    return_3y = round(ret, 2)
                elif attr == 'return_5y':
                    return_5y = round(ret, 2)

    # Company description from scheme details
    desc_parts = []
    if details.get("fund_house"):
        desc_parts.append(f"Fund House: {details['fund_house']}")
    if details.get("scheme_type"):
        desc_parts.append(f"Type: {details['scheme_type']}")
    if details.get("scheme_category"):
        desc_parts.append(f"Category: {details['scheme_category']}")
    start = details.get("scheme_start_date", {})
    if isinstance(start, dict) and start.get("date"):
        desc_parts.append(f"Inception: {start['date']} (NAV: {start.get('nav', '')})")

    return {
        "currency": "INR",
        "financial_currency": "INR",
        "nav": nav,
        "current_price": nav,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "category": details.get("scheme_category") or nav_data.get("scheme_category"),
        "company_description": ". ".join(desc_parts) if desc_parts else None,
        "return_1y": return_1y,
        "return_3y": return_3y,
        "return_5y": return_5y,
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
        "company_description": (info.get("longBusinessSummary") or "")[:5000] or None,
        "website": info.get("website"),
        "sector": info.get("sectorWeightings") and "ETF" or info.get("sector"),
        "nav": _safe_float(info.get("navPrice")),
        "expense_ratio": _safe_float(info.get("annualReportExpenseRatio") or info.get("netExpenseRatio")),
        "aum": _safe_float(info.get("totalAssets")),
        "market_cap": _safe_int(info.get("marketCap")),
        "holdings_count": _safe_int(info.get("holdings")),
        "dividend_yield": _safe_float(info.get("yield") or info.get("dividendYield")),
        "beta": _safe_float(info.get("beta3Year") or info.get("beta")),
        "return_1y": _safe_float(info.get("trailingAnnualTotalReturn")),
        "return_3y": _safe_float(info.get("threeYearAverageReturn")),
        "return_5y": _safe_float(info.get("fiveYearAverageReturn")),
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
        "company_description": (info.get("description") or "")[:5000] or None,
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


async def fetch_market_data_for_security(security_id: UUID, symbol: str, asset_type: str) -> None:
    """Background task: fetch and cache market data for one security (shared)."""
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
                select(MarketDataCache).where(MarketDataCache.security_id == security_id)
            )
            cache = result.scalar_one_or_none()
            if not cache:
                # Create cache if missing (e.g., security created without cache)
                cache = MarketDataCache(security_id=security_id)
                session.add(cache)

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


# Backward-compatible alias for routes that pass item_id
async def fetch_market_data_for_item(item_id: UUID, symbol: str, asset_type: str) -> None:
    """Resolve item → security, then fetch."""
    async for session in get_session():
        result = await session.execute(
            select(WatchlistItem.security_id).where(WatchlistItem.id == item_id)
        )
        security_id = result.scalar_one_or_none()
        if security_id:
            await fetch_market_data_for_security(security_id, symbol, asset_type)


async def refresh_all_securities() -> None:
    """Refresh market data for all unique securities (once per ticker, not per user)."""
    async for session in get_session():
        result = await session.execute(select(Security))
        securities = list(result.scalars().all())
        logger.info(f"Refreshing market data for {len(securities)} securities")

        for sec in securities:
            try:
                await fetch_market_data_for_security(sec.id, sec.symbol, sec.asset_type)
            except Exception as e:
                logger.warning(f"Refresh failed for {sec.symbol}: {e}")


# Backward-compatible alias
async def refresh_all_items() -> None:
    await refresh_all_securities()
