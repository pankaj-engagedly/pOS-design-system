"""HDFC Bank XLS/XLSX statement parser.

XLS format (from netbanking):
  Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
  Header row has "Narration" — preceded by ~20 rows of account metadata.
  Dates are DD/MM/YY. Amounts are floats (e.g. 200000.0).
  Row after header is asterisks — skip it.
"""

import io

from .base import ParsedTransaction
from .hdfc_base import HDFCTabularParser

try:
    import openpyxl
except ImportError:
    openpyxl = None

try:
    import xlrd
except ImportError:
    xlrd = None


class HDFCXLSParser(HDFCTabularParser):

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        lower = filename.lower()
        if not (lower.endswith(".xls") or lower.endswith(".xlsx")):
            return False
        if "hdfc" in lower:
            return True
        if file_bytes:
            try:
                text = file_bytes.decode("utf-8", errors="ignore")[:2000].lower()
                return "narration" in text
            except Exception:
                pass
        return False

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        lower = filename.lower()
        if lower.endswith(".xls") and not lower.endswith(".xlsx"):
            return self._parse_xls(file_bytes)
        return self._parse_xlsx(file_bytes)

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
