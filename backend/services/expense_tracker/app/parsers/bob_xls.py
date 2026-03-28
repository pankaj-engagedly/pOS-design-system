"""Bank of Baroda XLS statement parser.

BoB XLS format (from netbanking):
  Sparse column layout — data spread across ~19 columns with many empty cells.
  Header row has: DATE, NARRATION, CHQ.NO., WITHDRAWAL(DR), DEPOSIT(CR), BALANCE(INR)
  Dates are DD/MM/YYYY. Amounts use Indian comma format (e.g. 92,000.00).
  Balance has 'Cr' suffix (e.g. 48,54,624.20Cr).
  Transactions are in reverse chronological order.
"""

from .base import BaseParser, ParsedTransaction

try:
    import xlrd
except ImportError:
    xlrd = None


class BoBXLSParser(BaseParser):
    bank_name = "BoB"
    date_formats = ["%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d-%m-%y"]

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        lower = filename.lower()
        if not (lower.endswith(".xls") or lower.endswith(".xlsx")):
            return False
        return "bob" in lower or "baroda" in lower or "optransaction" in lower

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        if not xlrd:
            raise ImportError("xlrd required for .xls parsing — pip install xlrd")

        wb = xlrd.open_workbook(file_contents=file_bytes)
        ws = wb.sheet_by_index(0)
        transactions = []
        col_map = None

        for i in range(ws.nrows):
            cells = [str(ws.cell_value(i, j)).strip() for j in range(ws.ncols)]

            # Skip fully empty rows
            if not any(cells):
                continue

            if col_map is None:
                col_map = self._detect_header(cells)
                continue

            txn = self._parse_row(cells, col_map)
            if txn:
                transactions.append(txn)

        # BoB statements are reverse chronological — sort ascending
        transactions.sort(key=lambda t: t.date)
        return transactions

    def _detect_header(self, cells: list[str]) -> dict | None:
        """Find header row and map column positions in the sparse layout."""
        lower_cells = [c.lower() for c in cells]

        if not any("narration" in c for c in lower_cells):
            return None

        col_map = {}
        for i, c in enumerate(lower_cells):
            if c == "date" or c == "tran date":
                col_map["date"] = i
            elif "narration" in c:
                col_map["desc"] = i
            elif "chq" in c:
                col_map["ref"] = i
            elif "withdrawal" in c:
                col_map["debit"] = i
            elif "deposit" in c:
                col_map["credit"] = i
            elif "balance" in c:
                col_map["balance"] = i

        if "date" in col_map and "desc" in col_map and ("debit" in col_map or "credit" in col_map):
            return col_map
        return None

    def _parse_row(self, cells: list[str], col_map: dict) -> ParsedTransaction | None:
        try:
            date_str = cells[col_map["date"]] if col_map["date"] < len(cells) else ""
            description = cells[col_map["desc"]] if col_map["desc"] < len(cells) else ""

            if not date_str or not description:
                return None

            txn_date = self._parse_date(date_str)
            if not txn_date:
                return None

            debit_str = cells[col_map["debit"]] if "debit" in col_map and col_map["debit"] < len(cells) else ""
            credit_str = cells[col_map["credit"]] if "credit" in col_map and col_map["credit"] < len(cells) else ""
            ref = cells[col_map["ref"]] if "ref" in col_map and col_map["ref"] < len(cells) else None
            balance_str = cells[col_map["balance"]] if "balance" in col_map and col_map["balance"] < len(cells) else None

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

            balance = self._parse_bob_balance(balance_str) if balance_str else None

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

    def _parse_bob_balance(self, s: str):
        """Parse BoB balance format: '48,54,624.20Cr' → Decimal."""
        if not s:
            return None
        # Strip Cr/Dr suffix
        s = s.replace("Cr", "").replace("Dr", "").strip()
        return self._parse_amount(s)
