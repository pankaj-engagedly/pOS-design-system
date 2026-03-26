"""Base parser interface for bank statement parsers."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


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
    """Interface for bank-specific parsers."""

    bank_name: str = ""

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        """Parse a statement file and return standardized transactions."""
        raise NotImplementedError

    def detect(self, file_bytes: bytes, filename: str) -> bool:
        """Return True if this parser can handle the given file."""
        raise NotImplementedError
