# Expense Tracker — Phase 1 Design Spec

**Date**: 2026-03-26
**Service**: expense_tracker (port 8011)
**Status**: Approved

## Overview

Import-first expense tracker for the pOS personal operating system. Tracks household expenses across multiple bank accounts and credit cards by importing statements. Auto-categorizes transactions using keyword rules that learn from user corrections. Detects inter-account transfers and investment flows to avoid double-counting.

**Family model**: Each pOS user manages their own accounts independently. Accounts have an `owner_label` (free text) for grouping — e.g., Pankaj tags his wife's accounts in his own view to get a family aggregate. No cross-user sharing.

## Target Banks (Parser Priority)

| Bank | User | Type | Formats |
|------|------|------|---------|
| HDFC | Both | Savings + CC | CSV, Excel, PDF |
| Kotak | Pankaj | Savings + CC | Excel, PDF |
| Standard Chartered | Wife | Savings + CC | PDF |
| Bank of Baroda | Pankaj | Savings | PDF only |
| Canara Bank | Wife | Savings | PDF only |

**Phase 1 scope**: CSV/Excel import for HDFC and Kotak. PDF parsing deferred.

## Data Model

All tables extend `UserScopedBase` (auto UUIDv7 id, user_id, created_at, updated_at).

### accounts

| Column | Type | Notes |
|--------|------|-------|
| name | str | "HDFC Savings", "Kotak CC" |
| bank | str | "HDFC", "Kotak", "BoB" |
| type | enum | savings, current, credit_card, wallet, cash |
| owner_label | str | "Pankaj", "Wife" — free text for grouping |
| account_number_masked | str, optional | "XX1234" for display/dedup |

### categories

| Column | Type | Notes |
|--------|------|-------|
| name | str | "Groceries", "Fuel", "Food & Dining" |
| parent_id | FK (self), nullable | null = top-level, set = subcategory |
| icon | str, optional | Emoji or icon class |
| is_system | bool | true for pre-seeded defaults |
| sort_order | int | Display ordering |

Pre-seeded with Indian-specific taxonomy:

```
INCOME: Salary, Freelance/Business, Interest, Dividends, Rental Income, Refunds, Cashback

EXPENSES:
  Food & Dining: Groceries, Restaurants, Food Delivery, Coffee/Snacks
  Housing: Rent, Society Maintenance, Home Repairs, Furnishing, Property Tax
  Utilities: Electricity, Water, Gas, Internet/Broadband, Mobile, DTH/Cable
  Transport: Fuel/Petrol, Cab/Auto, Metro/Bus/Train, Parking/Toll, Vehicle Maintenance, Vehicle Insurance
  Shopping: Clothing, Electronics, Online Shopping, Household Supplies
  Health: Doctor/Medical, Pharmacy, Lab Tests, Gym/Fitness, Health Insurance
  Education: School/College Fees, Books, Online Courses, Coaching
  Entertainment: Movies/Events, OTT Subscriptions, Games/Hobbies, Music
  Travel: Flights, Hotels, Train/Bus (long distance), Travel Insurance
  Personal Care: Salon/Grooming, Spa/Wellness
  Family: Domestic Help, Kids, Gifts, Family Support
  Financial: EMI Payments, Loan Interest, Bank Charges, Life Insurance
  Government/Tax: Income Tax, GST/Professional Tax, Stamp Duty, Fines
  Donations: Charity, Religious, Political
  Cash: ATM Withdrawal, Cash Payment

TRANSFERS (excluded from totals): Self Transfer, CC Bill Payment, Wallet Top-up

INVESTMENT (excluded from expense totals): MF/Stocks/FD/PPF/NPS, Investment Income (returns, dividends)
```

### category_rules

| Column | Type | Notes |
|--------|------|-------|
| keyword | str | "swiggy", "bigbasket", "shell petrol" |
| category_id | FK | Target category |
| priority | int | Higher wins on conflict |
| source | enum | system, user_correction |

User corrections always override system rules. ~100 system rules pre-seeded for common Indian merchants.

### transactions

| Column | Type | Notes |
|--------|------|-------|
| date | date | Transaction date |
| description | str | Raw text from statement |
| merchant | str, optional | Cleaned/normalized name |
| amount | decimal | Always positive |
| txn_type | enum | debit, credit |
| category_id | FK, nullable | null = uncategorized |
| account_id | FK | Which account |
| notes | str, optional | User notes |
| reference | str, optional | UPI ref, cheque no, etc. |
| is_transfer | bool, default false | Excluded from expense totals |
| transfer_pair_id | FK self-ref, nullable | Links both sides of a transfer |
| hash | str | SHA256(date + amount + description) — unique per account for dedup |
| import_id | FK, nullable | Which import brought this in |

Tags via shared `tag_service` with `entity_type="transaction"`.

### statement_imports

| Column | Type | Notes |
|--------|------|-------|
| account_id | FK | Target account |
| filename | str | Original filename |
| file_type | enum | pdf, csv, xlsx |
| bank | str | Detected or specified bank |
| period_start | date, optional | Statement period |
| period_end | date, optional | Statement period |
| total_transactions | int | Total parsed |
| new_transactions | int | After dedup |
| status | enum | processing, completed, failed |
| error_message | str, optional | On failure |

## Import Flow

1. User selects an account → clicks "Import Statement"
2. Upload dialog: pick file (CSV/Excel for Phase 1), optional password field (for future PDF)
3. Backend detects bank from account metadata → routes to bank-specific parser
4. Parser extracts transactions → dedup by hash against existing transactions in that account
5. Auto-categorize each transaction:
   - Match description against `category_rules` (user_correction rules checked first, then system)
   - First matching keyword wins (by priority)
   - No match → leave uncategorized
6. Auto-detect transfers (see below)
7. Return import summary: X new, Y duplicates skipped, Z auto-categorized, W uncategorized
8. Transactions appear in the list — user fixes categories inline

## Transfer Detection

Runs after each import, scanning new transactions against all user's accounts:

- **Inter-account transfers**: Same amount, opposite txn_type (debit in one account, credit in another), within 3-day window
- **CC bill payments**: Bank account debit matching credit card payment credit (same amount, within 3 days)
- **Investment outflows**: Bank → Zerodha/demat — categorized as "Investment" (one-sided, no pairing needed)
- **Investment inflows**: Returns from demat to bank — categorized as "Investment Income" (one-sided)

Auto-detected transfers: set `is_transfer = true` + link via `transfer_pair_id`. User can override.

Investment flows are categorized (not flagged as transfers) since we don't have the other side in the system.

## Categorization Pipeline

1. **System keyword rules** (~100 pre-seeded): Common Indian merchants → categories
   - swiggy/zomato/dominos → Food Delivery
   - amazon/flipkart/myntra → Online Shopping
   - uber/ola/rapido → Cab/Auto
   - airtel/jio/vodafone → Mobile
   - netflix/hotstar/spotify → OTT Subscriptions
   - shell/hp/ioc/bpcl → Fuel/Petrol
   - bigbasket/blinkit/zepto → Groceries
   - (etc.)

2. **User-learned rules**: When user changes a transaction's category, system saves/updates `merchant → category` rule with source=user_correction

3. **Priority**: user_correction > system (user rules always win)

4. **Future**: Claude API (Haiku) for remaining uncategorized — Phase 5

## API Endpoints

```
# Accounts
GET    /api/expenses/accounts
POST   /api/expenses/accounts
PATCH  /api/expenses/accounts/{id}
DELETE /api/expenses/accounts/{id}

# Transactions
GET    /api/expenses/transactions                 — with filters: account_id, category_id, date_from, date_to, is_transfer, uncategorized_only, owner_label, search
PATCH  /api/expenses/transactions/{id}            — update category, notes, is_transfer, tags
DELETE /api/expenses/transactions/{id}

# Import
POST   /api/expenses/accounts/{id}/import         — multipart file upload
GET    /api/expenses/imports                       — import history

# Categories
GET    /api/expenses/categories                    — returns tree
POST   /api/expenses/categories
PATCH  /api/expenses/categories/{id}
DELETE /api/expenses/categories/{id}

# Category Rules
GET    /api/expenses/rules
POST   /api/expenses/rules
PATCH  /api/expenses/rules/{id}
DELETE /api/expenses/rules/{id}

# Dashboard
GET    /api/expenses/dashboard/summary             — summary cards (spend, income, net, MoM)
GET    /api/expenses/dashboard/category-breakdown   — spend per category for period
GET    /api/expenses/dashboard/monthly-trend         — monthly totals over time
GET    /api/expenses/dashboard/owner-split           — per-owner breakdown

# Tags (shared tag_service)
GET    /api/expenses/tags
POST   /api/expenses/tags
PATCH  /api/expenses/tags/{id}
DELETE /api/expenses/tags/{id}
```

## Frontend Structure

### Sidebar

```
Smart Views:
  - Dashboard (default landing)
  - All Transactions
  - Uncategorized

Accounts (grouped by owner_label, collapsible):
  Pankaj:
    - HDFC Savings
    - Kotak Savings
    - BoB Savings
    - HDFC CC
    - Kotak CC
  Wife:
    - HDFC Savings
    - StanChart Savings
    - ...

Bottom:
  - Manage Categories
  - Manage Rules
```

Hover actions on accounts: edit, delete. "+" button to add account.

### Views

**Dashboard** (default):
- Summary cards: Total spend this month, income this month, net savings, month-over-month change
- Category breakdown: Bar or donut chart showing top spending categories
- Monthly trend: Line chart of spend over last 6-12 months
- Recent transactions: Last 10-15 transactions
- Per-owner split: Pankaj vs Wife breakdown

**Transaction List** (click account or smart view):
- Table: Date, Description, Category (inline editable), Amount (color-coded), Account, Owner
- Search + filters: date range, category, account, owner
- Import button in page header
- Inline category edit: click category cell → dropdown with search, selecting saves + creates user rule

**Manage Categories**:
- Tree view showing parent → subcategories
- Add/edit/reorder/delete (prevent delete if transactions exist — reassign first)

**Manage Rules**:
- Table: Keyword, Category, Source (system/user), Priority
- Add/edit/delete

### Dialogs

- **Account create/edit**: Name, bank (dropdown), type (dropdown), owner label, masked account number
- **Import statement**: File picker (accept .csv, .xlsx), shows account name, optional password field (for future PDF)

### Components

```
frontend/modules/expense_tracker/
  pages/
    pos-expense-tracker-app.js        — main app (pos-module-layout + sidebar + content)
  components/
    pos-expense-sidebar.js            — sidebar with smart views + accounts
    pos-expense-dashboard.js          — dashboard/overview view
    pos-expense-transactions.js       — transaction table with filters
    pos-expense-categories.js         — category management tree
    pos-expense-rules.js              — category rules management
    pos-expense-account-dialog.js     — create/edit account
    pos-expense-import-dialog.js      — import statement upload
  services/
    expense-api.js                    — API client
  store.js                            — reactive state
```

## Backend Structure

```
backend/services/expense_tracker/
  app/
    main.py                — FastAPI app, lifespan, UserIdMiddleware
    models.py              — Account, Category, CategoryRule, Transaction, StatementImport
    schemas.py             — Pydantic request/response models
    config.py              — BaseServiceConfig extension
    db.py                  — Database init, session management
    routes_accounts.py     — Account CRUD
    routes_transactions.py — Transaction list/update + filters
    routes_import.py       — Statement import endpoint
    routes_categories.py   — Category CRUD (tree)
    routes_rules.py        — Category rule CRUD
    routes_dashboard.py    — Dashboard aggregation queries
    service_accounts.py    — Account business logic
    service_transactions.py — Transaction queries + category update + rule learning
    service_import.py      — Import orchestration (parse → dedup → categorize → detect transfers)
    service_categories.py  — Category tree operations + seeding
    service_transfer_detection.py — Transfer matching logic
    parsers/
      __init__.py
      base.py              — Base parser interface
      hdfc_csv.py          — HDFC CSV/Excel parser
      kotak_csv.py         — Kotak Excel parser
  migrations/
    alembic.ini            — version_table = alembic_version_expense_tracker
    env.py
    script.py.mako
    versions/
      001_create_expense_tracker_tables.py
      002_seed_categories_and_rules.py
  requirements.txt         — openpyxl (Excel parsing)
```

## Infrastructure Changes

- **Gateway** (`backend/gateway/`): Add `EXPENSE_TRACKER_SERVICE_URL = http://localhost:8011`, proxy route for `/api/expenses/*`
- **dev-start.sh**: Add expense_tracker log level var, startup command on port 8011, wait_for_port, summary line
- **Makefile**: Add `expense_tracker` log level variable, pass to dev-start.sh
- **Shell routing**: Add "Expenses" to sidebar nav under Finance group (after Portfolio), lazy load module

## Phase 1 Scope Summary

**In scope**:
- Accounts CRUD with owner labels
- Pre-seeded Indian category taxonomy + user customization
- Category keyword rules (system + user-learned)
- CSV/Excel import for HDFC and Kotak
- Transaction dedup on re-import
- Auto-categorization on import
- Transfer detection (inter-account + CC bill payments)
- Investment flow categorization (one-sided, not paired)
- Transaction list with inline category editing
- Tags via shared tag_service
- Notes field on transactions
- Basic dashboard (summary cards, category breakdown, trend, owner split)
- Manual transaction entry (available but not primary)

**Deferred**:
- PDF parsing (Phase 2)
- Credit card statement parsing (Phase 3)
- Gmail API email alerts (Phase 4)
- AI categorization via Claude API (Phase 5)
- Budgets, forecasting, recurring detection (Phase 6)
- Split transactions (if needed)
- Standard Chartered, BoB, Canara parsers (after PDF support)
