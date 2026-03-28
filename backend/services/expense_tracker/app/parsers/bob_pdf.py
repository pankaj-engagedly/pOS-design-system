"""Bank of Baroda PDF statement parser.

BoB PDF format:
  Header: TRAN DATE, VALUE DATE, NARRATION, CHQ.NO., WITHDRAWAL(DR), DEPOSIT(CR), BALANCE(INR)
  Dates: DD/MM/YYYY (4-digit year)
  Amounts: Indian comma format with 2 decimals
  Balance: has 'Cr' suffix (e.g. 9,25,805.48Cr)
  Multi-line narrations and amounts (narration/amount can span 2-3 lines)
  Transactions in reverse chronological order.
  Footer: timestamp + page number + disclaimer text
"""

import io
import re

from .base import BaseParser, ParsedTransaction

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# Date at start of line: DD/MM/YYYY
_DATE_RE = re.compile(r"^(\d{2}/\d{2}/\d{4})\s+")

# Balance at end: Indian format with Cr suffix
_BALANCE_RE = re.compile(r"([\d,]+\.\d{2})Cr\s*$")

# Amount pattern: Indian comma format
_AMOUNT_RE = re.compile(r"^([\d,]+\.\d{2})$")

# Lines to skip
_SKIP_PATTERNS = (
    "*This is computer",
    "Contact-Us@",
    "Main Account",
    "Joint Account",
    "Customer Id:",
    "Branch Name:",
    "IFSC Code:",
    "Your Account Statement",
    "Statement of transactions",
    "PANKAJ KUMAR SINGH",
    "TRAN DATE",
    "Page ",
)


class BoBPDFParser(BaseParser):
    bank_name = "BoB"
    date_formats = ["%d/%m/%Y", "%d/%m/%y"]

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        if not filename.lower().endswith(".pdf"):
            return False
        return "bob" in filename.lower() or "baroda" in filename.lower()

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        if not pdfplumber:
            raise ImportError("pdfplumber required for PDF parsing — pip install pdfplumber")

        pdf = pdfplumber.open(io.BytesIO(file_bytes))
        raw_lines = []
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                for line in text.split("\n"):
                    raw_lines.append(line.strip())
        pdf.close()

        blocks = self._collect_blocks(raw_lines)

        # Phase 1: Parse blocks
        raw_txns = []
        for block in blocks:
            txn = self._parse_block(block)
            if txn:
                raw_txns.append(txn)

        # Phase 2: Determine debit/credit via balance comparison
        # BoB statements are reverse chronological, so reverse for balance comparison
        raw_txns.reverse()
        transactions = []
        for i, txn in enumerate(raw_txns):
            if txn.balance is not None and i > 0 and raw_txns[i - 1].balance is not None:
                prev_balance = raw_txns[i - 1].balance
                if abs(prev_balance + txn.amount - txn.balance) < 1:
                    txn = ParsedTransaction(
                        date=txn.date, description=txn.description,
                        amount=txn.amount, txn_type="credit",
                        reference=txn.reference, balance=txn.balance,
                    )
                elif abs(prev_balance - txn.amount - txn.balance) < 1:
                    txn = ParsedTransaction(
                        date=txn.date, description=txn.description,
                        amount=txn.amount, txn_type="debit",
                        reference=txn.reference, balance=txn.balance,
                    )
            transactions.append(txn)

        return transactions

    def _collect_blocks(self, lines: list[str]) -> list[list[str]]:
        """Group lines into transaction blocks starting with DD/MM/YYYY.

        BoB PDF has multi-line transactions where the amount and continuation
        narration appear on lines that also start with the same date. We merge
        consecutive same-date lines into one block. A new block only starts
        when the date changes or we see a balance (Cr suffix) on the previous block.
        """
        blocks: list[list[str]] = []
        current: list[str] | None = None
        current_date: str | None = None

        for line in lines:
            if not line:
                continue

            # Skip metadata/footer lines
            if any(line.startswith(p) for p in _SKIP_PATTERNS):
                continue
            # Skip masked address lines
            if re.match(r"^[A-Z\d\*\s]+$", line) and "*" in line:
                continue
            if line.startswith("Savings Account"):
                continue

            date_match = _DATE_RE.match(line)
            if date_match:
                new_date = date_match.group(1)
                # Same date and current block has no balance yet → merge
                if current and new_date == current_date and not self._block_has_balance(current):
                    current.append(line)
                else:
                    if current:
                        blocks.append(current)
                    current = [line]
                    current_date = new_date
            elif current is not None:
                current.append(line)

        if current:
            blocks.append(current)

        return blocks

    def _block_has_balance(self, lines: list[str]) -> bool:
        """Check if any line in the block ends with a balance (Cr suffix)."""
        return any(_BALANCE_RE.search(l) for l in lines)

    def _parse_block(self, lines: list[str]) -> ParsedTransaction | None:
        """Parse a multi-line BoB transaction block.

        BoB PDF lines can look like:
          Simple:   "10/04/2024 10/04/2024 Loan Recovery For32680600001397 1,94,640.00 46,59,984.20Cr"
          Credit:   "13/01/2025 NEFT-BARBV25013979576-PANKAJ 12,99,602.20Cr"
                    "13/01/2025 10,00,000.00"
                    "SINGH-HDFC BANK LTD."
          Interest: "02/02/2025 32680100013049:Int.Pd:01-11-2024 to 31- 15,484.00 13,15,085.96Cr"
                    "31/01/2025"
                    "01-2025"
        """
        first_line = lines[0]

        # Extract transaction date
        date_match = _DATE_RE.match(first_line)
        if not date_match:
            return None

        txn_date = self._parse_date(date_match.group(1))
        if not txn_date:
            return None

        # Join all lines for analysis
        all_text = " ".join(lines)

        # Extract balance — look for any "amount+Cr" pattern anywhere in the text
        balance_re_any = re.compile(r"([\d,]+\.\d{2})Cr")
        balance = None
        text_cleaned = all_text
        for m in balance_re_any.finditer(all_text):
            balance = self._parse_amount(m.group(1))
            # Remove the balance from text so it doesn't pollute narration
            text_cleaned = all_text[:m.start()] + all_text[m.end():]
            break  # Take first balance occurrence

        # Remove date prefixes
        remainder = re.sub(r"\d{2}/\d{2}/\d{4}\s*", "", text_cleaned).strip()

        # Find all monetary amounts in the remainder
        amounts = []
        narration_parts = []
        for token in remainder.split():
            cleaned = token.replace(",", "")
            try:
                from decimal import Decimal
                val = Decimal(cleaned)
                if val > 0 and "." in token:
                    amounts.append(self._parse_amount(token))
                else:
                    narration_parts.append(token)
            except Exception:
                narration_parts.append(token)

        narration = " ".join(narration_parts).strip()
        if not narration:
            return None

        # Determine debit/credit and amount
        # BoB has separate WITHDRAWAL(DR) and DEPOSIT(CR) columns
        # With 2 amounts: first is the transaction amount, second might be part of narration
        # With 1 amount: it's the transaction amount
        # Use balance comparison for direction
        if not amounts:
            return None

        amount = amounts[0]
        if not amount or amount <= 0:
            return None

        # Default to debit; will be corrected by balance comparison in post-processing
        txn_type = "debit"

        return ParsedTransaction(
            date=txn_date,
            description=narration,
            amount=amount,
            txn_type=txn_type,
            reference=None,
            balance=balance,
        )

