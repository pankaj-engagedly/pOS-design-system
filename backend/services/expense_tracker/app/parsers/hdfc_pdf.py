"""HDFC Bank PDF statement parser.

PDF format (from netbanking):
  Each page has ~20 lines of header metadata, then transaction lines.
  Transaction lines start with DD/MM/YY date.
  Long narrations wrap to subsequent lines (no date prefix).
  Amounts are comma-formatted with 2 decimal places (e.g. 100,000.00).
  Columns: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance

The last page may end with a summary section ("STATEMENTSUMMARY") and footer text.
"""

import io
import re

from .base import BaseParser, ParsedTransaction

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

# Regex: line starting with a date DD/MM/YY
_DATE_RE = re.compile(r"^(\d{2}/\d{2}/\d{2})\s+")

# Regex: amounts at the end of a transaction line
# Matches 1-3 comma-formatted amounts with 2 decimal places at the end
_AMOUNTS_RE = re.compile(
    r"([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"   # withdrawal + deposit + balance (rare)
    r"|"
    r"([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"                       # amount + balance (most common)
    r"|"
    r"([\d,]+\.\d{2})\s*$"                                           # balance only (continuation)
)

# Lines to skip on each page
_SKIP_PATTERNS = (
    "HDFCBANKLIMITED",
    "*Closingbalance",
    "Contentsofthisstatement",
    "StateaccountbranchGSTN",
    "HDFCBankGSTIN",
    "RegisteredOfficeAddress",
    "Thisisacomputergenerated",
    "STATEMENTSUMMARY",
    "OpeningBalance",
    "GeneratedOn:",
)


class HDFCPDFParser(BaseParser):
    bank_name = "HDFC"

    def detect(self, file_bytes: bytes | None, filename: str) -> bool:
        if not filename.lower().endswith(".pdf"):
            return False
        return "hdfc" in filename.lower()

    def parse(self, file_bytes: bytes, filename: str) -> list[ParsedTransaction]:
        if not pdfplumber:
            raise ImportError("pdfplumber required for PDF parsing — pip install pdfplumber")

        pdf = pdfplumber.open(io.BytesIO(file_bytes))
        raw_lines = []

        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
            for line in text.split("\n"):
                raw_lines.append(line)

        pdf.close()

        # Phase 1: Collect transaction blocks (date-started groups of lines)
        txn_blocks = self._collect_blocks(raw_lines)

        # Phase 2: Parse each block into a raw transaction (amount + balance, no type yet)
        raw_txns = []
        for block in txn_blocks:
            txn = self._parse_block(block)
            if txn:
                raw_txns.append(txn)

        # Phase 3: Determine debit/credit using balance progression
        # If balance went up by the amount, it's credit. If down, debit.
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
                # else: keep original guess (debit)
            transactions.append(txn)

        return transactions

    def _collect_blocks(self, lines: list[str]) -> list[list[str]]:
        """Group lines into transaction blocks.

        A block starts with a line matching DD/MM/YY and continues
        until the next date line or a skip/footer pattern.
        """
        blocks: list[list[str]] = []
        current_block: list[str] | None = None
        in_header = True

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Skip known footer/metadata patterns
            if any(stripped.startswith(p) for p in _SKIP_PATTERNS):
                if current_block:
                    blocks.append(current_block)
                    current_block = None
                continue

            # Detect page header — skip lines until we see "Date Narration" or a date
            if in_header:
                if "Narration" in stripped and "Chq" in stripped:
                    in_header = False
                    continue
                # Also handle page continuation where header line is missing
                if _DATE_RE.match(stripped):
                    in_header = False
                    # Fall through to process this line
                else:
                    continue

            # Check if this line starts a new transaction
            if _DATE_RE.match(stripped):
                if current_block:
                    blocks.append(current_block)
                current_block = [stripped]
            elif current_block is not None:
                # Continuation line — append to current block
                current_block.append(stripped)
            # else: orphan line before any transaction, skip

        if current_block:
            blocks.append(current_block)

        return blocks

    def _parse_block(self, lines: list[str]) -> ParsedTransaction | None:
        """Parse a multi-line transaction block into a ParsedTransaction.

        Strategy: Parse the FIRST line for date, amounts, ref, value date.
        Continuation lines (2+) are extra narration text only.
        """
        first_line = lines[0]

        # Extract date from the start
        date_match = _DATE_RE.match(first_line)
        if not date_match:
            return None

        date_str = date_match.group(1)
        txn_date = self._parse_date(date_str)
        if not txn_date:
            return None

        remainder = first_line[date_match.end():]

        # Extract amounts from the end of the first line
        amounts_match = _AMOUNTS_RE.search(remainder)
        if not amounts_match:
            return None

        # Determine which pattern matched
        if amounts_match.group(1):
            # 3 amounts: withdrawal, deposit, balance
            withdrawal = self._parse_amount(amounts_match.group(1))
            deposit = self._parse_amount(amounts_match.group(2))
            balance = self._parse_amount(amounts_match.group(3))
        elif amounts_match.group(4):
            # 2 amounts: amount + balance (most common)
            # Need to determine if it's withdrawal or deposit from context
            amount_val = self._parse_amount(amounts_match.group(4))
            balance = self._parse_amount(amounts_match.group(5))
            withdrawal = amount_val
            deposit = None
        elif amounts_match.group(6):
            # 1 amount: just balance (shouldn't happen for valid transactions)
            return None
        else:
            return None

        # Middle section of first line: narration + ref + value_date
        middle = remainder[:amounts_match.start()].strip()

        # Append continuation lines to narration
        extra_narration = " ".join(l.strip() for l in lines[1:] if l.strip())

        # Try to extract value date and ref from the middle
        narration, ref = self._split_narration_ref(middle)

        if extra_narration:
            narration = narration + " " + extra_narration

        # Determine debit vs credit
        if withdrawal and withdrawal > 0:
            amount = withdrawal
            txn_type = "debit"
        elif deposit and deposit > 0:
            amount = deposit
            txn_type = "credit"
        else:
            return None

        return ParsedTransaction(
            date=txn_date,
            description=narration,
            amount=amount,
            txn_type=txn_type,
            reference=ref,
            balance=balance,
        )

    def _split_narration_ref(self, middle: str) -> tuple[str, str | None]:
        """Split the middle section into narration and reference number.

        The middle typically looks like:
          "NEFT DR-KKBK0000424-PANKAJ... N097242974680641 06/04/24"
        where the ref is the last alphanumeric token before the value date,
        and the value date (DD/MM/YY) is at the very end.
        """
        # Strip trailing value date if present
        vdate_match = re.search(r"\s+(\d{2}/\d{2}/\d{2})\s*$", middle)
        if vdate_match:
            middle = middle[:vdate_match.start()]

        # The ref is typically the last whitespace-separated token that looks
        # like a reference number (alphanumeric, 10+ chars)
        parts = middle.rsplit(None, 1)
        if len(parts) == 2:
            narration, possible_ref = parts
            # Check if it looks like a reference (mostly digits/uppercase, 10+ chars)
            if len(possible_ref) >= 10 and re.match(r"^[A-Z0-9]+$", possible_ref):
                return narration.strip(), possible_ref
            # Could also be a shorter ref like "MIR2516194178738"
            if len(possible_ref) >= 8 and re.match(r"^[A-Z0-9]+$", possible_ref):
                return narration.strip(), possible_ref

        return middle.strip(), None
