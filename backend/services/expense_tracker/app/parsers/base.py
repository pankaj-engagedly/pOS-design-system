"""Base parser interface for bank statement parsers."""

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation


@dataclass
class ParsedTransaction:
    """Standardized transaction from any bank parser."""
    date: date
    description: str
    amount: Decimal  # always positive
    txn_type: str  # "debit" or "credit"
    reference: str | None = None
    balance: Decimal | None = None


class BaseParser:
    """Interface for bank-specific parsers.

    Subclasses must implement `parse()` and `detect()`.
    Shared helpers for date and amount parsing are provided.
    """

    bank_name: str = ""
    date_formats: list[str] = ["%d/%m/%y", "%d/%m/%Y", "%d-%m-%Y", "%d-%m-%y"]

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        """Parse a statement file and return standardized transactions."""
        raise NotImplementedError

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        """Return True if this parser can handle the given file."""
        raise NotImplementedError

    def _parse_date(self, s: str) -> date | None:
        """Parse a date string using the configured format list."""
        s = s.strip().split(" ")[0]  # Handle "02/04/20 00:00:00" from xlrd
        for fmt in self.date_formats:
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return None

    def _parse_amount(self, s: str) -> Decimal | None:
        """Parse a monetary amount, returning absolute value or None."""
        if not s or s in ("", "None", "nan", "0", "0.0"):
            return None
        try:
            val = abs(Decimal(s.replace(",", "").strip()))
            return val if val > 0 else None
        except (InvalidOperation, ValueError):
            return None
