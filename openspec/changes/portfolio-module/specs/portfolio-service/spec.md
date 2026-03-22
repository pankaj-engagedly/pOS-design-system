## ADDED Requirements

### Requirement: Portfolio CRUD
The system SHALL provide a portfolio service on port 8010 that allows users to create, read, update, and delete portfolio containers. Each portfolio SHALL have a name, holder_name, PAN (encrypted at rest), email, and optional description. Portfolios are user_id scoped via UserScopedBase.

#### Scenario: Create portfolio
- **WHEN** user creates a portfolio with name "My MF", holder_name "Pankaj", PAN "ABCDE1234F", email "pankaj@example.com"
- **THEN** system stores the portfolio with an auto-generated UUIDv7 id, encrypts the PAN, and returns the portfolio with masked PAN (showing only last 4 chars)

#### Scenario: List portfolios
- **WHEN** user requests all portfolios
- **THEN** system returns all portfolios for the user with summary stats (total invested, current value, overall return %) and holder_name for grouping

#### Scenario: Update portfolio
- **WHEN** user updates a portfolio's name or description
- **THEN** system updates the fields and returns the updated portfolio

#### Scenario: Delete portfolio
- **WHEN** user deletes a portfolio that has transactions
- **THEN** system deletes the portfolio and all associated transactions, holdings cache, and import records (cascade)

### Requirement: CAS PDF import
The system SHALL accept CAMS and KFintech CAS PDF uploads, parse them using the `casparser` library, and store normalized transactions. The PDF password SHALL be accepted as a parameter (typically PAN + DOB). The system SHALL store a record of each import (filename, import_date, source_type, transaction_count, status).

#### Scenario: Upload CAMS CAS PDF
- **WHEN** user uploads a CAMS CAS PDF with the correct password for a portfolio
- **THEN** system parses the PDF, extracts all MF transactions (buy, sell, SIP, switch_in, switch_out, dividend_payout, dividend_reinvest, redemption), stores them as normalized transaction records linked to the portfolio, and returns import summary (schemes found, transactions imported, duplicates skipped)

#### Scenario: Upload KFintech CAS PDF
- **WHEN** user uploads a KFintech CAS PDF with the correct password
- **THEN** system parses and imports transactions identically to CAMS CAS

#### Scenario: Wrong PDF password
- **WHEN** user uploads a CAS PDF with an incorrect password
- **THEN** system returns a clear error indicating the password is incorrect

#### Scenario: Re-import with existing transactions
- **WHEN** user uploads a CAS PDF that contains transactions already in the system
- **THEN** system deduplicates by (folio_number, scheme_isin, transaction_date, transaction_type, amount, units) and only inserts new transactions, returning counts of imported vs skipped

#### Scenario: CAS contains multiple folios
- **WHEN** a CAS PDF contains transactions across multiple folio numbers and AMCs
- **THEN** system imports all folios into the same portfolio, preserving folio_number on each transaction for grouping

### Requirement: Transaction storage
The system SHALL store MF transactions with: portfolio_id, folio_number, amc_name, scheme_name, scheme_isin, amfi_code, transaction_date, transaction_type (enum: buy, sell, sip, switch_in, switch_out, dividend_payout, dividend_reinvest, redemption), amount (Numeric), units (Numeric), nav (Numeric), balance_units (Numeric), and import_id (FK to the import record).

#### Scenario: Query transactions by portfolio
- **WHEN** user requests transactions for a portfolio
- **THEN** system returns all transactions ordered by transaction_date descending, with optional filters for scheme_isin, transaction_type, and date range

#### Scenario: Query transactions by scheme
- **WHEN** user requests transactions filtered by scheme_isin within a portfolio
- **THEN** system returns only transactions for that scheme, ordered by date

### Requirement: Holdings computation
The system SHALL compute current holdings from transaction history. For each unique scheme in a portfolio, holdings SHALL include: scheme_name, scheme_isin, amfi_code, folio_number, total_units (sum of buy/SIP/switch_in/dividend_reinvest minus sell/switch_out/redemption), invested_amount (sum of buy-side amounts minus sell-side amounts), current_nav, current_value (total_units * current_nav), absolute_return (current_value - invested_amount), return_percentage, and xirr.

#### Scenario: Compute holdings for portfolio
- **WHEN** user requests holdings for a portfolio
- **THEN** system computes holdings from all transactions, fetches current NAV for each scheme, and returns per-scheme holdings with P&L and XIRR

#### Scenario: Scheme with zero units
- **WHEN** all units of a scheme have been redeemed (total_units = 0)
- **THEN** system includes the scheme in holdings with zero current value but shows the realized return (invested vs redeemed amounts)

#### Scenario: Holdings summary
- **WHEN** user requests portfolio summary
- **THEN** system returns aggregate: total_invested, total_current_value, total_return, overall_xirr, scheme_count, and asset_allocation breakdown

### Requirement: NAV data
The system SHALL fetch daily MF NAV data from the AMFI India daily NAV file. NAV data SHALL be cached in the database with scheme AMFI code and date. The system SHALL provide a scheduler (APScheduler) that fetches NAV daily at a configurable time (default: 11:30 PM IST).

#### Scenario: Daily NAV fetch
- **WHEN** the scheduled NAV fetch job runs
- **THEN** system downloads the AMFI NAV file, parses it, and updates NAV cache for all schemes held across all user portfolios

#### Scenario: NAV lookup for holdings
- **WHEN** holdings computation needs current NAV for a scheme
- **THEN** system looks up the most recent NAV from the cache by AMFI code

#### Scenario: Manual NAV refresh
- **WHEN** user triggers a manual NAV refresh
- **THEN** system fetches latest NAV data immediately and recomputes holdings

### Requirement: Aggregation
The system SHALL provide aggregation at three levels: per-portfolio, per-PAN (person), and family (all portfolios for the user). Aggregation SHALL include total_invested, total_current_value, total_return, overall_xirr, and asset allocation.

#### Scenario: Per-PAN aggregation
- **WHEN** user requests aggregation grouped by PAN
- **THEN** system groups all portfolios by PAN, computes per-group totals (invested, current, return, XIRR), and returns holder_name with each group

#### Scenario: Family aggregation
- **WHEN** user requests family-level aggregation
- **THEN** system computes totals across ALL portfolios for the user, returning total family invested, current value, return, and XIRR

### Requirement: Tagging support
The system SHALL support tagging on portfolios using the shared tag_service with entity_type "portfolio".

#### Scenario: Add tag to portfolio
- **WHEN** user adds a tag "retirement" to a portfolio
- **THEN** system creates the tag association via tag_service with entity_type="portfolio"

#### Scenario: Filter portfolios by tag
- **WHEN** user filters portfolios by tag "retirement"
- **THEN** system returns only portfolios with that tag

### Requirement: Gateway integration
The API gateway SHALL proxy all `/api/portfolio/*` requests to the portfolio service on port 8010 with JWT authentication and X-User-Id header injection.

#### Scenario: Authenticated portfolio request
- **WHEN** an authenticated user makes a request to `/api/portfolio/portfolios`
- **THEN** gateway proxies to `http://localhost:8010/api/portfolio/portfolios` with X-User-Id header

#### Scenario: Unauthenticated portfolio request
- **WHEN** an unauthenticated request hits `/api/portfolio/*`
- **THEN** gateway returns 401 Unauthorized
