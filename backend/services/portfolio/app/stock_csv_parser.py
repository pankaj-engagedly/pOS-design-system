"""Stock tradebook CSV/Excel parser — broker-specific parsers for stock transactions.

Each broker parser reads its export format and returns the same ParsedCAS structure
used by the CAS import pipeline, enabling a unified import flow.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

from loguru import logger

from .cas_parser_adapter import ParsedCAS, ParsedFolio, ParsedScheme, ParsedTransaction


# ── Helpers ─────────────────────────────────────────────


def _to_decimal(val) -> Decimal:
    if val is None or val == "":
        return Decimal("0")
    try:
        return Decimal(str(val).replace(",", "").strip())
    except InvalidOperation:
        return Decimal("0")


def _parse_date(val: str, formats: list[str] | None = None) -> date:
    """Try multiple date formats common in Indian broker exports."""
    if not val or not val.strip():
        return date.today()
    val = val.strip()
    fmts = formats or [
        "%Y-%m-%d",       # 2024-01-15
        "%d-%m-%Y",       # 15-01-2024
        "%d/%m/%Y",       # 15/01/2024
        "%d-%b-%Y",       # 15-Jan-2024
        "%d %b %Y",       # 15 Jan 2024
        "%m/%d/%Y",       # 01/15/2024
    ]
    for fmt in fmts:
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    logger.warning(f"Could not parse date: {val}")
    return date.today()


def _normalize_header(header: str) -> str:
    """Normalize CSV header to lowercase with underscores."""
    return header.strip().lower().replace(" ", "_").replace("-", "_")


def _read_csv_rows(file_path: str) -> tuple[list[str], list[dict]]:
    """Read CSV file, return (raw_headers, list of row dicts with normalized keys)."""
    path = Path(file_path)

    # Try reading with utf-8, fall back to latin-1 (common for Indian exports)
    for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
        try:
            content = path.read_text(encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"Could not decode file {file_path} with any supported encoding")

    # Skip blank lines at the top (some exports have headers after blank lines)
    lines = content.strip().splitlines()
    start_idx = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            # Check if this looks like a header row (has letters, not just numbers)
            if any(c.isalpha() for c in stripped):
                start_idx = i
                break

    trimmed = "\n".join(lines[start_idx:])

    # Auto-detect delimiter (tab, comma, semicolon)
    first_data_line = lines[start_idx] if start_idx < len(lines) else ""
    if "\t" in first_data_line:
        delimiter = "\t"
    elif ";" in first_data_line and "," not in first_data_line:
        delimiter = ";"
    else:
        delimiter = ","

    reader = csv.DictReader(io.StringIO(trimmed), delimiter=delimiter)

    raw_headers = reader.fieldnames or []
    normalized = [_normalize_header(h) for h in raw_headers]

    rows = []
    for row in reader:
        normalized_row = {}
        for orig_key, norm_key in zip(raw_headers, normalized):
            normalized_row[norm_key] = row.get(orig_key, "").strip()
        rows.append(normalized_row)

    return normalized, rows


def _read_excel_rows(file_path: str) -> tuple[list[str], list[dict]]:
    """Read Excel file, return (normalized_headers, list of row dicts).

    Handles Zerodha-style xlsx with metadata rows before the header:
    - Skips blank rows and metadata rows
    - Detects header row by looking for known column names (Symbol, Trade Date, etc.)
    - Strips leading empty columns
    """
    import openpyxl

    wb = openpyxl.load_workbook(file_path, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)

    # Known header keywords that indicate a tradebook header row
    _HEADER_KEYWORDS = {
        "symbol", "trade_date", "trade date", "exchange", "trade_type", "trade type",
        "quantity", "price", "rate", "isin", "tradingsymbol", "scrip_name", "scrip name",
        "scrip_symbol", "scrip symbol", "buy/sell", "buy_sell", "trade id", "order id",
        "segment", "net_rate", "net rate", "net_amount", "net amount", "final_amount",
    }

    # Find header row: must have at least 3 recognized keywords
    headers = None
    for row in rows_iter:
        if not row or all(cell is None for cell in row):
            continue
        vals = [str(cell).strip() if cell is not None else "" for cell in row]
        lower_vals = [v.lower() for v in vals]
        matches = sum(1 for v in lower_vals if v in _HEADER_KEYWORDS)
        if matches >= 3:
            headers = vals
            break

    if not headers:
        raise ValueError("Could not find tradebook header row in Excel file. "
                         "Expected columns like Symbol, Trade Date, Exchange, etc.")

    # Strip leading empty columns (Zerodha has empty column A)
    start_col = 0
    for i, h in enumerate(headers):
        if h:
            start_col = i
            break
    headers = headers[start_col:]

    normalized = [_normalize_header(h) for h in headers]

    rows = []
    for row in rows_iter:
        if not row or all(cell is None for cell in row):
            continue
        vals = [str(cell).strip() if cell is not None else "" for cell in row]
        vals = vals[start_col:]  # strip same leading columns
        if not any(v for v in vals):
            continue
        row_dict = dict(zip(normalized, vals))
        rows.append(row_dict)

    wb.close()
    return normalized, rows


# ── Broker Detection ────────────────────────────────────


# Known header patterns per broker
_ZERODHA_HEADERS = {"trade_date", "tradingsymbol", "exchange", "segment", "trade_type", "quantity", "price"}
_ZERODHA_ALT_HEADERS = {"symbol", "isin", "trade_date", "exchange", "segment", "trade_type", "quantity", "price"}

_SHAREKHAN_HEADERS_V1 = {"trade_date", "exchange", "scrip_symbol", "buy/sell", "quantity", "rate"}
_SHAREKHAN_HEADERS_V2 = {"trade_date", "exchange", "scrip_name", "buy/sell", "quantity", "rate"}
_SHAREKHAN_HEADERS_V3 = {"date", "exchange", "scrip_name", "type", "quantity", "rate"}


def detect_broker(headers: list[str]) -> str:
    """Detect broker from CSV/Excel column headers."""
    header_set = set(headers)

    if _ZERODHA_HEADERS.issubset(header_set) or _ZERODHA_ALT_HEADERS.issubset(header_set):
        return "Zerodha"

    if ("tradingsymbol" in header_set or "symbol" in header_set) and "trade_type" in header_set:
        return "Zerodha"

    # Sharekhan variations
    if "scrip_symbol" in header_set or "scrip_name" in header_set or "scrip_code" in header_set:
        return "Sharekhan"

    if "buy/sell" in header_set and "net_rate" in header_set:
        return "Sharekhan"

    return "unknown"


# ── Zerodha Parser ──────────────────────────────────────


def _parse_zerodha_rows(rows: list[dict], headers: list[str]) -> ParsedCAS:
    """Parse Zerodha tradebook CSV rows.

    Known column formats:
    Format 1: trade_date, tradingsymbol, exchange, segment, trade_type, quantity, price, order_id, trade_id, order_execution_time
    Format 2: symbol, isin, trade_date, exchange, segment, series, trade_type, auction, quantity, price, trade_id, order_id, order_execution_time
    """
    # Map column names (handle both formats)
    symbol_col = "tradingsymbol" if "tradingsymbol" in headers else "symbol"
    has_isin = "isin" in headers

    # Group transactions by symbol (each unique symbol = one "scheme")
    by_symbol: dict[str, list] = {}

    for row in rows:
        symbol = row.get(symbol_col, "").strip()
        if not symbol:
            continue

        # Filter to equity segment only
        segment = row.get("segment", "EQ").upper()
        if segment not in ("EQ", ""):
            continue

        trade_type_raw = row.get("trade_type", "").strip().lower()
        if trade_type_raw not in ("buy", "sell"):
            continue

        qty = _to_decimal(row.get("quantity", "0"))
        price = _to_decimal(row.get("price", "0"))
        if qty == 0:
            continue

        amount = qty * price
        trade_date = _parse_date(row.get("trade_date", ""))
        isin = row.get("isin", "").strip() if has_isin else None
        exchange = row.get("exchange", "NSE").strip().upper()

        txn = ParsedTransaction(
            date=trade_date,
            description=f"{trade_type_raw.upper()} {symbol} x{qty} @{price} on {exchange}",
            transaction_type=trade_type_raw,  # buy or sell
            amount=amount,
            units=qty,
            nav=price,
        )

        key = f"{symbol}|{isin or ''}|{exchange}"
        if key not in by_symbol:
            by_symbol[key] = {"symbol": symbol, "isin": isin, "exchange": exchange, "txns": []}
        by_symbol[key]["txns"].append(txn)

    # Build ParsedCAS: one folio (Zerodha account), multiple schemes (stocks)
    schemes = []
    for info in by_symbol.values():
        schemes.append(ParsedScheme(
            name=info["symbol"],
            isin=info["isin"],
            amfi_code=info["symbol"],  # Store NSE symbol in amfi_code field
            transactions=info["txns"],
        ))

    folio = ParsedFolio(
        folio_number="Zerodha",  # Will be overridden with client ID if available
        amc="Zerodha",
        schemes=schemes,
    )

    return ParsedCAS(source_type="Zerodha", folios=[folio])


# ── Sharekhan Parser ────────────────────────────────────


def _parse_sharekhan_rows(rows: list[dict], headers: list[str]) -> ParsedCAS:
    """Parse Sharekhan trade listing CSV/Excel rows.

    Actual Sharekhan Trade Listing format:
    Exchange | Trade Date | Scrip Symbol | TDInd | Buy/Sell | Quantity | Rate |
    Brokerage Per Share | Net Rate | Net Amount | IGST | SGST | CGST | UTGST |
    Cess | Stamp | TO Charges | IPFT | Sebi Fees | STT Amount | Final Amount
    """
    # Flexible column mapping — ordered by priority
    date_col = _find_col(headers, ["trade_date", "date", "trade_dt", "settlement_date"])
    symbol_col = _find_col(headers, ["scrip_symbol", "scrip_name", "symbol", "stock_name", "scrip"])
    code_col = _find_col(headers, ["scrip_code", "symbol_code", "nse_code", "bse_code"])
    type_col = _find_col(headers, ["buy/sell", "buy_sell", "type", "trade_type", "transaction_type"])
    qty_col = _find_col(headers, ["quantity", "qty", "traded_qty"])
    # Use 'rate' (raw trade price) over 'net_rate' (includes brokerage)
    price_col = _find_col(headers, ["rate", "price", "avg_price", "trade_price"])
    exchange_col = _find_col(headers, ["exchange", "exch"])
    isin_col = _find_col(headers, ["isin", "isin_code"])

    if not symbol_col:
        raise ValueError("Could not find symbol/scrip column in Sharekhan file. "
                         f"Headers found: {headers}")
    if not qty_col:
        raise ValueError(f"Could not find quantity column. Headers: {headers}")

    by_symbol: dict[str, list] = {}

    for row in rows:
        symbol = row.get(symbol_col, "").strip()
        if not symbol:
            continue

        # Determine trade type
        trade_type_raw = row.get(type_col, "").strip().upper() if type_col else ""
        if trade_type_raw in ("B", "BUY", "BOUGHT"):
            trade_type = "buy"
        elif trade_type_raw in ("S", "SELL", "SOLD"):
            trade_type = "sell"
        else:
            continue  # skip unknown types

        qty = _to_decimal(row.get(qty_col, "0"))
        price = _to_decimal(row.get(price_col, "0")) if price_col else Decimal("0")
        if qty == 0:
            continue

        amount = qty * price
        trade_date = _parse_date(row.get(date_col, "")) if date_col else date.today()
        exchange = row.get(exchange_col, "NSE").strip().upper() if exchange_col else "NSE"
        isin = row.get(isin_col, "").strip() if isin_col else None
        scrip_code = row.get(code_col, "").strip() if code_col else None

        txn = ParsedTransaction(
            date=trade_date,
            description=f"{trade_type.upper()} {symbol} x{qty} @{price} on {exchange}",
            transaction_type=trade_type,
            amount=amount,
            units=qty,
            nav=price,
        )

        key = f"{symbol}|{isin or ''}|{exchange}"
        if key not in by_symbol:
            by_symbol[key] = {"symbol": symbol, "isin": isin, "exchange": exchange,
                              "code": scrip_code, "txns": []}
        by_symbol[key]["txns"].append(txn)

    schemes = []
    for info in by_symbol.values():
        schemes.append(ParsedScheme(
            name=info["symbol"],
            isin=info["isin"],
            amfi_code=info["code"] or info["symbol"],
            transactions=info["txns"],
        ))

    folio = ParsedFolio(
        folio_number="Sharekhan",
        amc="Sharekhan",
        schemes=schemes,
    )

    return ParsedCAS(source_type="Sharekhan", folios=[folio])


def _find_col(headers: list[str], candidates: list[str]) -> Optional[str]:
    """Find first matching column from candidates list."""
    for c in candidates:
        if c in headers:
            return c
    return None


# ── Generic / Manual Mapping Parser ─────────────────────


def _parse_generic_rows(rows: list[dict], headers: list[str], broker_name: str = "unknown") -> ParsedCAS:
    """Fallback parser for unknown broker formats.

    Expects at minimum: date, symbol/name, type (buy/sell), quantity, price.
    Will try common column name variations.
    """
    date_col = _find_col(headers, ["trade_date", "date", "transaction_date", "txn_date"])
    symbol_col = _find_col(headers, ["tradingsymbol", "symbol", "scrip_name", "stock_name",
                                     "name", "instrument", "scrip"])
    type_col = _find_col(headers, ["trade_type", "type", "buy/sell", "buy_sell",
                                   "transaction_type", "side"])
    qty_col = _find_col(headers, ["quantity", "qty", "traded_qty", "units", "shares"])
    price_col = _find_col(headers, ["price", "rate", "avg_price", "trade_price", "nav"])
    isin_col = _find_col(headers, ["isin", "isin_code"])
    exchange_col = _find_col(headers, ["exchange", "exch"])

    if not symbol_col or not qty_col:
        raise ValueError(
            f"Cannot parse file: missing required columns (symbol and quantity). "
            f"Headers found: {headers}"
        )

    by_symbol: dict[str, list] = {}

    for row in rows:
        symbol = row.get(symbol_col, "").strip()
        if not symbol:
            continue

        trade_type_raw = row.get(type_col, "").strip().upper() if type_col else ""
        if trade_type_raw in ("B", "BUY", "BOUGHT", "PURCHASE"):
            trade_type = "buy"
        elif trade_type_raw in ("S", "SELL", "SOLD", "REDEMPTION"):
            trade_type = "sell"
        else:
            continue

        qty = _to_decimal(row.get(qty_col, "0"))
        price = _to_decimal(row.get(price_col, "0")) if price_col else Decimal("0")
        if qty == 0:
            continue

        amount = qty * price
        trade_date = _parse_date(row.get(date_col, "")) if date_col else date.today()
        exchange = row.get(exchange_col, "NSE").strip().upper() if exchange_col else "NSE"
        isin = row.get(isin_col, "").strip() if isin_col else None

        txn = ParsedTransaction(
            date=trade_date,
            description=f"{trade_type.upper()} {symbol} x{qty} @{price}",
            transaction_type=trade_type,
            amount=amount,
            units=qty,
            nav=price,
        )

        key = f"{symbol}|{isin or ''}|{exchange}"
        if key not in by_symbol:
            by_symbol[key] = {"symbol": symbol, "isin": isin, "exchange": exchange, "txns": []}
        by_symbol[key]["txns"].append(txn)

    schemes = []
    for info in by_symbol.values():
        schemes.append(ParsedScheme(
            name=info["symbol"],
            isin=info["isin"],
            amfi_code=info["symbol"],
            transactions=info["txns"],
        ))

    folio = ParsedFolio(
        folio_number=broker_name,
        amc=broker_name,
        schemes=schemes,
    )

    return ParsedCAS(source_type=broker_name, folios=[folio])


# ── Public API ──────────────────────────────────────────


def parse_stock_file(file_path: str, broker: str | None = None) -> ParsedCAS:
    """Parse a stock tradebook file (CSV or Excel) and return ParsedCAS.

    Args:
        file_path: Path to CSV or Excel file.
        broker: Optional broker hint ("Zerodha", "Sharekhan"). Auto-detected if None.

    Returns:
        ParsedCAS with one folio per broker, one scheme per stock.

    Raises:
        ValueError on parse failure.
    """
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext in (".xlsx", ".xls"):
        headers, rows = _read_excel_rows(file_path)
    elif ext in (".csv", ".txt"):
        headers, rows = _read_csv_rows(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}. Use CSV or Excel.")

    if not rows:
        raise ValueError("File contains no data rows")

    logger.info(f"Read {len(rows)} rows from {path.name}, headers: {headers}")

    # Detect or verify broker
    detected = detect_broker(headers)
    broker_name = broker or detected

    if broker and detected != "unknown" and detected != broker:
        logger.warning(f"Broker hint '{broker}' doesn't match detected '{detected}', using hint")

    logger.info(f"Parsing as broker: {broker_name}")

    if broker_name == "Zerodha":
        return _parse_zerodha_rows(rows, headers)
    elif broker_name in ("Sharekhan", "Sharekhan_TxnReport"):
        parsed = _parse_sharekhan_rows(rows, headers)
        # Override source_type to distinguish the two formats
        if broker_name == "Sharekhan_TxnReport":
            parsed = ParsedCAS(
                source_type="Sharekhan (Txn Report)",
                folios=parsed.folios,
            )
        return parsed
    else:
        return _parse_generic_rows(rows, headers, broker_name)
