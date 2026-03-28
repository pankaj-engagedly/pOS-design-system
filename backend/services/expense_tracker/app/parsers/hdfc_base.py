"""Shared logic for HDFC Bank parsers — header detection and row parsing.

Used by CSV and XLS/XLSX parsers which share the same tabular column structure.
The PDF parser does its own text-based extraction.
"""

from .base import BaseParser, ParsedTransaction


class HDFCTabularParser(BaseParser):
    """Base for HDFC parsers that work with tabular rows (CSV, XLS, XLSX).

    Provides dynamic header detection and row parsing. Subclasses just need
    to implement file reading and yield rows as list[str].
    """

    bank_name = "HDFC"

    def _detect_header(self, cells: list[str]) -> dict | None:
        """Find the header row and map column positions dynamically.

        Supports both XLS columns (Date, Narration, Withdrawal Amt., Deposit Amt.)
        and CSV columns (Transaction Date, Description, Debit, Credit).
        """
        lower_cells = [c.lower() for c in cells]

        # Key trigger: must contain "narration" or "description"
        if not any("narration" in c or "description" in c for c in lower_cells):
            return None

        col_map = {}
        for i, c in enumerate(lower_cells):
            if c in ("date",) or c.startswith("date") or "transaction date" in c:
                col_map["date"] = i
            elif "narration" in c or "description" in c:
                col_map["desc"] = i
            elif "chq" in c or "ref" in c:
                col_map["ref"] = i
            elif "withdrawal" in c or c.strip() == "debit" or c.startswith("debit"):
                col_map["debit"] = i
            elif "deposit" in c or c.strip() == "credit" or c.startswith("credit"):
                col_map["credit"] = i
            elif "closing" in c or "balance" in c:
                col_map["balance"] = i

        # Must have at least date, desc, and one amount column
        if "date" in col_map and "desc" in col_map and ("debit" in col_map or "credit" in col_map):
            return col_map

        return None

    def _parse_row_mapped(self, cells: list[str], col_map: dict) -> ParsedTransaction | None:
        """Parse a data row using the dynamic column mapping."""
        try:
            date_str = cells[col_map["date"]]
            description = cells[col_map["desc"]]

            if not date_str or not description:
                return None

            debit_str = cells[col_map["debit"]] if "debit" in col_map and col_map["debit"] < len(cells) else ""
            credit_str = cells[col_map["credit"]] if "credit" in col_map and col_map["credit"] < len(cells) else ""
            ref = cells[col_map["ref"]] if "ref" in col_map and col_map["ref"] < len(cells) else None
            balance_str = cells[col_map["balance"]] if "balance" in col_map and col_map["balance"] < len(cells) else None

            txn_date = self._parse_date(date_str)
            if not txn_date:
                return None

            debit = self._parse_amount(debit_str)
            credit = self._parse_amount(credit_str)

            if debit and debit > 0:
                amount = debit
                txn_type = "debit"
            elif credit and credit > 0:
                amount = credit
                txn_type = "credit"
            else:
                return None

            return ParsedTransaction(
                date=txn_date,
                description=description,
                amount=amount,
                txn_type=txn_type,
                reference=ref if ref and ref != "0" * len(ref) else None,
                balance=self._parse_amount(balance_str) if balance_str else None,
            )
        except (IndexError, ValueError):
            return None
