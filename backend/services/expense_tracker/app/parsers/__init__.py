"""Bank statement parsers registry."""

from .base import BaseParser
from .bob_pdf import BoBPDFParser
from .bob_xls import BoBXLSParser
from .hdfc_csv import HDFCCSVParser
from .hdfc_pdf import HDFCPDFParser
from .hdfc_xls import HDFCXLSParser
from .kotak_csv import KotakCSVParser

PARSERS: list[BaseParser] = [
    HDFCCSVParser(),
    HDFCXLSParser(),
    HDFCPDFParser(),
    BoBXLSParser(),
    BoBPDFParser(),
    KotakCSVParser(),
]


def get_parser(bank: str, filename: str) -> BaseParser | None:
    """Return the parser matching a bank name and file type.

    First matches on bank_name, then checks if the parser supports the file extension.
    The bank name match is done here, so detect() only needs to verify file format.
    """
    bank_lower = bank.lower()
    # Inject bank name into filename for detect() if not already there
    detect_filename = filename if bank_lower in filename.lower() else f"{bank_lower}_{filename}"
    for parser in PARSERS:
        if parser.bank_name.lower() in bank_lower or bank_lower in parser.bank_name.lower():
            if parser.detect(None, detect_filename):
                return parser
    return None


# Backward compat alias
def get_parser_for_bank(bank: str) -> BaseParser | None:
    """Deprecated — use get_parser(bank, filename) instead."""
    bank_lower = bank.lower()
    for parser in PARSERS:
        if parser.bank_name.lower() in bank_lower or bank_lower in parser.bank_name.lower():
            return parser
    return None
