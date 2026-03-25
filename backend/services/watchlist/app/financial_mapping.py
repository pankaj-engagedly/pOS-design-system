"""Standardized financial statement line item mapping.

Maps raw yfinance line items to clean, human-readable sections
similar to ValueResearch / Tijori / Zerodha presentations.
"""

# ── Income Statement ────────────────────────────────────────────────────────
# Maps display label → list of yfinance line item keys (first match wins)

INCOME_STATEMENT_MAP = [
    ("Revenue", [
        ("Total Revenue", ["Total Revenue", "Operating Revenue"]),
        ("Cost of Revenue", ["Cost Of Revenue", "Reconciled Cost Of Revenue"]),
        ("Gross Profit", ["Gross Profit"]),
    ]),
    ("Expenses", [
        ("Operating Expenses", ["Operating Expense"]),
        ("Selling & Admin", ["Selling General And Administration"]),
        ("Other Expenses", ["Other Operating Expenses"]),
        ("Total Expenses", ["Total Expenses"]),
    ]),
    ("Profitability", [
        ("EBITDA", ["EBITDA", "Normalized EBITDA"]),
        ("Depreciation", ["Reconciled Depreciation"]),
        ("EBIT", ["EBIT"]),
        ("Operating Income", ["Operating Income"]),
        ("Interest Expense", ["Interest Expense", "Interest Expense Non Operating"]),
        ("Interest Income", ["Interest Income", "Interest Income Non Operating"]),
        ("Other Income/Expenses", ["Other Non Operating Income Expenses"]),
        ("Pretax Income", ["Pretax Income"]),
        ("Tax Provision", ["Tax Provision"]),
        ("Net Income", ["Net Income", "Net Income Common Stockholders"]),
    ]),
    ("Per Share", [
        ("Basic EPS", ["Basic EPS"]),
        ("Diluted EPS", ["Diluted EPS"]),
    ]),
]


# ── Balance Sheet ───────────────────────────────────────────────────────────

BALANCE_SHEET_MAP = [
    ("Assets", [
        ("Total Assets", ["Total Assets"]),
        ("Current Assets", ["Current Assets"]),
        ("Cash & Equivalents", ["Cash And Cash Equivalents", "Cash Cash Equivalents And Short Term Investments"]),
        ("Short Term Investments", ["Other Short Term Investments"]),
        ("Accounts Receivable", ["Accounts Receivable"]),
        ("Inventory", ["Inventory"]),
        ("Other Current Assets", ["Other Current Assets", "Prepaid Assets"]),
        ("Non-Current Assets", ["Total Non Current Assets"]),
        ("Net PPE", ["Net PPE"]),
        ("Goodwill", ["Goodwill"]),
        ("Other Intangibles", ["Other Intangible Assets"]),
        ("Long Term Investments", ["Investmentin Financial Assets", "Long Term Equity Investment"]),
    ]),
    ("Liabilities", [
        ("Total Liabilities", ["Total Liabilities Net Minority Interest"]),
        ("Current Liabilities", ["Current Liabilities"]),
        ("Accounts Payable", ["Accounts Payable", "Payables"]),
        ("Current Debt", ["Current Debt", "Current Debt And Capital Lease Obligation"]),
        ("Other Current Liabilities", ["Other Current Liabilities"]),
        ("Non-Current Liabilities", ["Total Non Current Liabilities Net Minority Interest"]),
        ("Long Term Debt", ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"]),
        ("Other Non-Current Liabilities", ["Other Non Current Liabilities"]),
        ("Total Debt", ["Total Debt"]),
    ]),
    ("Equity", [
        ("Total Equity", ["Stockholders Equity", "Common Stock Equity"]),
        ("Retained Earnings", ["Retained Earnings"]),
        ("Common Stock", ["Capital Stock", "Common Stock"]),
        ("Additional Paid-In Capital", ["Additional Paid In Capital"]),
        ("Minority Interest", ["Minority Interest"]),
        ("Total Equity (incl. Minority)", ["Total Equity Gross Minority Interest"]),
    ]),
    ("Key Metrics", [
        ("Book Value", ["Tangible Book Value"]),
        ("Net Debt", ["Net Debt"]),
        ("Working Capital", ["Working Capital"]),
        ("Invested Capital", ["Invested Capital"]),
    ]),
]


# ── Cash Flow ───────────────────────────────────────────────────────────────

CASHFLOW_MAP = [
    ("Operating Activities", [
        ("Operating Cash Flow", ["Operating Cash Flow"]),
        ("Net Income", ["Net Income From Continuing Operations"]),
        ("Depreciation & Amortization", ["Depreciation And Amortization", "Depreciation"]),
        ("Deferred Tax", ["Deferred Tax"]),
        ("Change in Working Capital", ["Change In Working Capital"]),
        ("Change in Receivables", ["Change In Receivables"]),
        ("Change in Inventory", ["Change In Inventory"]),
        ("Change in Payables", ["Change In Payable"]),
        ("Other Non-Cash Items", ["Other Non Cash Items"]),
    ]),
    ("Investing Activities", [
        ("Investing Cash Flow", ["Investing Cash Flow"]),
        ("Capital Expenditure", ["Capital Expenditure", "Capital Expenditure Reported"]),
        ("Purchase of Investments", ["Purchase Of Investment"]),
        ("Sale of Investments", ["Sale Of Investment"]),
        ("Purchase of PPE", ["Purchase Of PPE"]),
        ("Sale of PPE", ["Sale Of PPE"]),
        ("Other Investing", ["Net Other Investing Changes"]),
    ]),
    ("Financing Activities", [
        ("Financing Cash Flow", ["Financing Cash Flow"]),
        ("Debt Issuance", ["Issuance Of Debt", "Long Term Debt Issuance"]),
        ("Debt Repayment", ["Repayment Of Debt", "Long Term Debt Payments"]),
        ("Dividends Paid", ["Cash Dividends Paid"]),
        ("Stock Issuance", ["Issuance Of Capital Stock", "Common Stock Issuance"]),
        ("Interest Paid", ["Interest Paid Cff"]),
        ("Other Financing", ["Net Other Financing Charges"]),
    ]),
    ("Summary", [
        ("Free Cash Flow", ["Free Cash Flow"]),
        ("Net Change in Cash", ["Changes In Cash"]),
        ("Beginning Cash", ["Beginning Cash Position"]),
        ("Ending Cash", ["End Cash Position"]),
    ]),
]


STATEMENT_MAPS = {
    "income": INCOME_STATEMENT_MAP,
    "balance": BALANCE_SHEET_MAP,
    "cashflow": CASHFLOW_MAP,
}


def standardize_line_items(statement_type: str, raw_line_items: dict) -> list[dict]:
    """Transform raw yfinance line items into clean standardized sections.

    Returns: [
        {
            "section": "Revenue",
            "items": [
                {"label": "Total Revenue", "value": 12345678},
                {"label": "Cost of Revenue", "value": 5678901},
            ]
        },
        ...
    ]
    """
    mapping = STATEMENT_MAPS.get(statement_type, [])
    result = []

    for section_name, item_defs in mapping:
        section_items = []
        for display_label, raw_keys in item_defs:
            value = None
            for raw_key in raw_keys:
                if raw_key in raw_line_items:
                    v = raw_line_items[raw_key]
                    if v is not None:
                        value = v
                        break
            section_items.append({"label": display_label, "value": value})

        # Only include section if at least one item has a value
        if any(item["value"] is not None for item in section_items):
            result.append({"section": section_name, "items": section_items})

    return result
