"""HDFC Bank CSV statement parser.

CSV format (from netbanking download):
  Sl. No., Transaction Date, Value Date, Description, Chq / Ref No., Debit, Credit, Balance, Dr / Cr

Also supports the older format where columns match the XLS layout:
  Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
"""

import csv
import io

from .base import ParsedTransaction
from .hdfc_base import HDFCTabularParser


class HDFCCSVParser(HDFCTabularParser):

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        if not filename.lower().endswith(".csv"):
            return False
        if "hdfc" in filename.lower():
            return True
        if file_bytes:
            try:
                text = file_bytes.decode("utf-8", errors="ignore")[:2000].lower()
                return "narration" in text or "description" in text
            except Exception:
                pass
        return False

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
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
