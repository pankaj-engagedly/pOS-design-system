"""HDFC Bank CSV/XLS/XLSX statement parser.

HDFC XLS format (actual from netbanking):
  Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
  Header row has "Narration" — preceded by ~20 rows of account metadata.
  Dates are DD/MM/YY. Amounts are floats (e.g. 200000.0).
  Row after header is asterisks — skip it.

HDFC CSV format:
  Same columns, comma-separated.
"""

import csv
import io
from datetime import datetime
from decimal import Decimal, InvalidOperation

from .base import BaseParser, ParsedTransaction

try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    import xlrd
except ImportError:
    xlrd = None


class HDFCCSVParser(BaseParser):
    bank_name = "HDFC"

    def detect(self, file_bytes: bytes, filename: str) -> bool:
        lower = filename.lower()
        if "hdfc" in lower:
            return True
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return "narration" in text[:2000].lower()
        except Exception:
            return False

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        lower = filename.lower()
        if lower.endswith(".xls") and not lower.endswith(".xlsx"):
            return self._parse_xls(file_bytes)
        if lower.endswith(".xlsx"):
            return self._parse_xlsx(file_bytes)
        return self._parse_csv(file_bytes)

    def _parse_xls(self, file_bytes: bytes) -> list[ParsedTransaction]:
        """Parse old-format .xls using xlrd."""
        if not xlrd:
            raise ImportError("xlrd required for .xls parsing — pip install xlrd")

        wb = xlrd.open_workbook(file_contents=file_bytes)
        ws = wb.sheet_by_index(0)
        transactions = []
        col_map = None

        for i in range(ws.nrows):
            cells = [str(ws.cell_value(i, j)).strip() for j in range(ws.ncols)]

            if col_map is None:
                col_map = self._detect_header(cells)
                continue

            # Skip asterisk separator rows and empty rows
            if not cells[0] or cells[0].startswith("*"):
                continue

            txn = self._parse_row_mapped(cells, col_map)
            if txn:
                transactions.append(txn)

        return transactions

    def _parse_xlsx(self, file_bytes: bytes) -> list[ParsedTransaction]:
        """Parse .xlsx using openpyxl."""
        if not openpyxl:
            raise ImportError("openpyxl required for .xlsx parsing")

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        transactions = []
        col_map = None

        for row in ws.iter_rows(values_only=True):
            if not row or all(c is None for c in row):
                continue

            cells = [str(c).strip() if c is not None else "" for c in row]

            if col_map is None:
                col_map = self._detect_header(cells)
                continue

            if not cells[0] or cells[0].startswith("*"):
                continue

            txn = self._parse_row_mapped(cells, col_map)
            if txn:
                transactions.append(txn)

        wb.close()
        return transactions

    def _parse_csv(self, file_bytes: bytes) -> list[ParsedTransaction]:
        text = file_bytes.decode("utf-8", errors="ignore")
        transactions = []
        col_map = None

        reader = csv.reader(io.StringIO(text))
        for row in reader:
            if not row or len(row) < 5:
                continue

            cells = [c.strip() for c in row]

            if col_map is None:
                col_map = self._detect_header(cells)
                continue

            if not cells[0] or cells[0].startswith("*"):
                continue

            txn = self._parse_row_mapped(cells, col_map)
            if txn:
                transactions.append(txn)

        return transactions

    def _detect_header(self, cells: list[str]) -> dict | None:
        """Find the header row and map column positions dynamically."""
        lower_cells = [c.lower() for c in cells]

        # Look for "narration" — the key HDFC column
        if not any("narration" in c for c in lower_cells):
            return None

        col_map = {}
        for i, c in enumerate(lower_cells):
            if c == "date" or c.startswith("date"):
                col_map["date"] = i
            elif "narration" in c:
                col_map["desc"] = i
            elif "chq" in c or "ref" in c:
                col_map["ref"] = i
            elif "withdrawal" in c or c == "debit amount" or c.startswith("debit"):
                col_map["debit"] = i
            elif "deposit" in c or c == "credit amount" or c.startswith("credit"):
                col_map["credit"] = i
            elif "closing" in c or "balance" in c:
                col_map["balance"] = i

        # Must have at least date, desc, and one amount column
        if "date" in col_map and "desc" in col_map and ("debit" in col_map or "credit" in col_map):
            return col_map

        return None

    def _parse_row_mapped(self, cells: list[str], col_map: dict) -> ParsedTransaction | None:
        """Parse a row using dynamic column mapping."""
        try:
            date_str = cells[col_map["date"]]
            description = cells[col_map["desc"]]

            if not date_str or not description:
                return None

            debit_str = cells[col_map["debit"]] if "debit" in col_map and col_map["debit"] < len(cells) else ""
            credit_str = cells[col_map["credit"]] if "credit" in col_map and col_map["credit"] < len(cells) else ""
            ref = cells[col_map["ref"]] if "ref" in col_map and col_map["ref"] < len(cells) else None
            balance_str = cells[col_map["balance"]] if "balance" in col_map and col_map["balance"] < len(cells) else None

            # Parse date — HDFC uses DD/MM/YY or DD/MM/YYYY
            txn_date = self._parse_date(date_str)
            if not txn_date:
                return None

            # Determine amount and type
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

    def _parse_date(self, s: str) -> object | None:
        """Parse HDFC date formats."""
        s = s.strip().split(" ")[0]  # Handle "02/04/20 00:00:00" from xlrd
        for fmt in ("%d/%m/%y", "%d/%m/%Y", "%d-%m-%Y", "%d-%m-%y"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return None

    def _parse_amount(self, s: str) -> Decimal | None:
        if not s or s in ("", "None", "nan", "0", "0.0"):
            return None
        try:
            val = abs(Decimal(s.replace(",", "").strip()))
            return val if val > 0 else None
        except (InvalidOperation, ValueError):
            return None
