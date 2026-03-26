"""HDFC Bank CSV/Excel statement parser.

HDFC format (CSV):
  Date, Narration, Value Dat, Debit Amount, Credit Amount, Chq/Ref Number, Closing Balance

HDFC format (XLS/XLSX) — same columns as CSV, first few rows may be header metadata.
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


class HDFCCSVParser(BaseParser):
    bank_name = "HDFC"

    def detect(self, file_bytes: bytes, filename: str) -> bool:
        lower = filename.lower()
        if "hdfc" in lower:
            return True
        # Check CSV header
        try:
            text = file_bytes.decode("utf-8", errors="ignore")
            return "narration" in text[:500].lower() and "closing balance" in text[:500].lower()
        except Exception:
            return False

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        lower = filename.lower()
        if lower.endswith((".xlsx", ".xls")):
            return self._parse_excel(file_bytes)
        return self._parse_csv(file_bytes)

    def _parse_csv(self, file_bytes: bytes) -> list[ParsedTransaction]:
        text = file_bytes.decode("utf-8", errors="ignore")
        transactions = []

        reader = csv.reader(io.StringIO(text))
        header_found = False

        for row in reader:
            if not row or len(row) < 5:
                continue

            # Find header row
            if not header_found:
                if any("narration" in cell.lower() for cell in row):
                    header_found = True
                continue

            # Skip empty rows after header
            if not row[0].strip():
                continue

            txn = self._parse_row(row)
            if txn:
                transactions.append(txn)

        return transactions

    def _parse_excel(self, file_bytes: bytes) -> list[ParsedTransaction]:
        if not openpyxl:
            raise ImportError("openpyxl required for Excel parsing")

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        transactions = []
        header_found = False

        for row in ws.iter_rows(values_only=True):
            if not row or all(c is None for c in row):
                continue

            cells = [str(c) if c is not None else "" for c in row]

            if not header_found:
                if any("narration" in c.lower() for c in cells):
                    header_found = True
                continue

            if not cells[0].strip():
                continue

            txn = self._parse_row(cells)
            if txn:
                transactions.append(txn)

        wb.close()
        return transactions

    def _parse_row(self, row: list[str]) -> ParsedTransaction | None:
        """Parse a single HDFC row: Date, Narration, Value Dat, Debit, Credit, Ref, Balance."""
        try:
            date_str = row[0].strip()
            description = row[1].strip()
            debit_str = row[3].strip().replace(",", "") if len(row) > 3 else ""
            credit_str = row[4].strip().replace(",", "") if len(row) > 4 else ""
            ref = row[5].strip() if len(row) > 5 else None
            balance_str = row[6].strip().replace(",", "") if len(row) > 6 else None

            # Parse date — HDFC uses DD/MM/YY or DD/MM/YYYY
            for fmt in ("%d/%m/%y", "%d/%m/%Y", "%d-%m-%Y", "%d-%m-%y"):
                try:
                    txn_date = datetime.strptime(date_str, fmt).date()
                    break
                except ValueError:
                    continue
            else:
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
                return None  # skip zero or unparseable

            balance = self._parse_amount(balance_str) if balance_str else None

            return ParsedTransaction(
                date=txn_date,
                description=description,
                amount=amount,
                txn_type=txn_type,
                reference=ref if ref else None,
                balance=balance,
            )
        except (IndexError, ValueError):
            return None

    def _parse_amount(self, s: str) -> Decimal | None:
        if not s or s in ("", "None", "nan"):
            return None
        try:
            return abs(Decimal(s.replace(",", "").strip()))
        except (InvalidOperation, ValueError):
            return None
