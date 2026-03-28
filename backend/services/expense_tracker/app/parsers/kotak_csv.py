"""Kotak Mahindra Bank Excel statement parser.

Kotak format (XLSX):
  Sl. No., Transaction Date, Value Date, Description, Chq / Ref No., Debit, Credit, Balance

Date format: DD-MM-YYYY or DD/MM/YYYY
"""

import io

from .base import BaseParser, ParsedTransaction

try:
    import openpyxl
except ImportError:
    openpyxl = None


class KotakCSVParser(BaseParser):
    bank_name = "Kotak"
    date_formats = ["%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y", "%Y-%m-%d"]

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        return "kotak" in filename.lower()

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        if not openpyxl:
            raise ImportError("openpyxl required for Excel parsing")

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        transactions = []
        header_found = False
        col_map = {}

        for row in ws.iter_rows(values_only=True):
            if not row or all(c is None for c in row):
                continue

            cells = [str(c) if c is not None else "" for c in row]

            # Find header row
            if not header_found:
                lower_cells = [c.lower().strip() for c in cells]
                if any("transaction date" in c or "tran date" in c for c in lower_cells):
                    for i, c in enumerate(lower_cells):
                        if "transaction date" in c or "tran date" in c:
                            col_map["date"] = i
                        elif "description" in c or "narration" in c or "particulars" in c:
                            col_map["desc"] = i
                        elif c.strip() == "debit" or "debit" in c:
                            col_map["debit"] = i
                        elif c.strip() == "credit" or "credit" in c:
                            col_map["credit"] = i
                        elif "chq" in c or "ref" in c:
                            col_map["ref"] = i
                        elif "balance" in c:
                            col_map["balance"] = i
                    header_found = True
                    continue

            if not header_found or not cells[col_map.get("date", 0)].strip():
                continue

            txn = self._parse_row(cells, col_map)
            if txn:
                transactions.append(txn)

        wb.close()
        return transactions

    def _parse_row(self, cells: list[str], col_map: dict) -> ParsedTransaction | None:
        try:
            date_str = cells[col_map.get("date", 0)].strip()
            description = cells[col_map.get("desc", 1)].strip()
            debit_str = cells[col_map.get("debit", 3)].strip()
            credit_str = cells[col_map.get("credit", 4)].strip()
            ref = cells[col_map.get("ref", 2)].strip() if "ref" in col_map else None
            balance_str = cells[col_map.get("balance", 5)].strip() if "balance" in col_map else None

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
