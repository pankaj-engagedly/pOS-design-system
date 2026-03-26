"""Bank statement parsers registry."""

from .hdfc_csv import HDFCCSVParser
from .kotak_csv import KotakCSVParser

PARSERS = [
    HDFCCSVParser(),
    KotakCSVParser(),
]


def get_parser_for_bank(bank: str):
    """Return the parser matching a bank name."""
    bank_lower = bank.lower()
    for parser in PARSERS:
        if parser.bank_name.lower() in bank_lower or bank_lower in parser.bank_name.lower():
            return parser
    return None
