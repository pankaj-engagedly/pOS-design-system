"""CAS parser adapter — abstracts casparser library into standard types.

If we need to switch to a different parser library, only this file changes.
The rest of the import service works with plain dicts.
"""

from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Optional


@dataclass
class ParsedTransaction:
    date: date
    description: str
    transaction_type: str  # buy, sip, redemption, switch_in, switch_out, dividend_payout, dividend_reinvest
    amount: Decimal
    units: Decimal
    nav: Optional[Decimal] = None
    balance: Optional[Decimal] = None


@dataclass
class ParsedScheme:
    name: str
    isin: Optional[str] = None
    amfi_code: Optional[str] = None
    rta_code: Optional[str] = None
    transactions: list[ParsedTransaction] = field(default_factory=list)


@dataclass
class ParsedFolio:
    folio_number: str
    amc: str
    pan: Optional[str] = None
    schemes: list[ParsedScheme] = field(default_factory=list)


@dataclass
class ParsedCAS:
    source_type: str  # CAMS, KFINTECH, NSDL, unknown
    folios: list[ParsedFolio] = field(default_factory=list)


# ── casparser TransactionType → our normalized type ──────

_TYPE_MAP = {
    "PURCHASE": "buy",
    "PURCHASE_SIP": "sip",
    "REDEMPTION": "redemption",
    "DIVIDEND_PAYOUT": "dividend_payout",
    "DIVIDEND_REINVEST": "dividend_reinvest",
    "SWITCH_IN": "switch_in",
    "SWITCH_IN_MERGER": "switch_in",
    "SWITCH_OUT": "switch_out",
    "SWITCH_OUT_MERGER": "switch_out",
    "REVERSAL": "sell",
}

# Types we skip entirely (tax entries, stamps, etc.)
_SKIP_TYPES = {"STT_TAX", "STAMP_DUTY_TAX", "TDS_TAX", "SEGREGATION", "MISC"}


def _to_decimal(val) -> Decimal:
    """Safely convert any numeric value to Decimal."""
    if val is None:
        return Decimal("0")
    return Decimal(str(val))


def _to_date(val) -> date:
    """Convert date or string to date object."""
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
        return date.today()
    return date.today()


def _enum_value(obj) -> str:
    """Get string value from an enum or string."""
    if hasattr(obj, "value"):
        return str(obj.value)
    return str(obj) if obj else "unknown"


def parse_cas_pdf(file_path: str, password: str) -> ParsedCAS:
    """Parse a CAS PDF file and return standardized ParsedCAS.

    Uses casparser internally. To switch libraries, replace this function body.
    Raises ValueError on parse failure.
    """
    import casparser

    try:
        cas_data = casparser.read_cas_pdf(file_path, password)
    except Exception as e:
        error_msg = str(e)
        if "password" in error_msg.lower() or "decrypt" in error_msg.lower():
            raise ValueError(f"Incorrect PDF password: {error_msg}")
        raise ValueError(f"Failed to parse CAS PDF: {error_msg}")

    source_type = _enum_value(cas_data.file_type)

    parsed_folios = []
    for folio in cas_data.folios:
        parsed_schemes = []
        for scheme in folio.schemes:
            parsed_txns = []
            for txn in scheme.transactions:
                # Get transaction type
                type_key = _enum_value(txn.type)

                # Skip tax/misc entries
                if type_key in _SKIP_TYPES:
                    continue

                amount = _to_decimal(txn.amount)
                units = _to_decimal(txn.units)

                # Skip zero entries
                if units == 0 and amount == 0:
                    continue

                normalized_type = _TYPE_MAP.get(type_key)
                if not normalized_type:
                    # Fallback: infer from units sign
                    normalized_type = "buy" if units > 0 else "sell"

                nav = _to_decimal(txn.nav) if txn.nav else None
                balance = _to_decimal(txn.balance) if txn.balance else None

                parsed_txns.append(ParsedTransaction(
                    date=_to_date(txn.date),
                    description=txn.description or "",
                    transaction_type=normalized_type,
                    amount=amount,
                    units=units,
                    nav=nav,
                    balance=balance,
                ))

            parsed_schemes.append(ParsedScheme(
                name=scheme.scheme or "unknown",
                isin=scheme.isin,
                amfi_code=getattr(scheme, "amfi", None),
                rta_code=getattr(scheme, "rta_code", None),
                transactions=parsed_txns,
            ))

        parsed_folios.append(ParsedFolio(
            folio_number=folio.folio or "unknown",
            amc=folio.amc or "unknown",
            pan=getattr(folio, "PAN", None),
            schemes=parsed_schemes,
        ))

    return ParsedCAS(
        source_type=source_type,
        folios=parsed_folios,
    )
