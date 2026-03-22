## ADDED Requirements

### Requirement: Module structure
The portfolio frontend module SHALL follow the standard pOS module pattern: `frontend/modules/portfolio/` with pages/, components/, services/, and store.js. It SHALL use `pos-module-layout` for the two-panel sidebar + content layout.

#### Scenario: Module loads
- **WHEN** user navigates to the portfolio module via sidebar
- **THEN** system loads the portfolio app page with sidebar and content area, fetches portfolios list, and displays the default view

### Requirement: Sidebar navigation
The sidebar SHALL display: smart views (All Portfolios, Family Dashboard), a list of portfolios grouped by holder (PAN-based grouping), and investment plans. Each portfolio entry SHALL show holder_name, portfolio name, and a summary value. The sidebar SHALL follow `pos-sidebar` + `SIDEBAR_NAV_STYLES` composition pattern.

#### Scenario: Sidebar with multiple holders
- **WHEN** user has portfolios for "Pankaj" (PAN ...34F), "Wife" (PAN ...78K), and "Dad" (PAN ...12P)
- **THEN** sidebar shows portfolios grouped under each holder name, with per-holder subtotals

#### Scenario: Sidebar investment plans section
- **WHEN** user has active investment plans
- **THEN** sidebar shows an "Investment Plans" section with each active plan name and progress (e.g., "57% deployed")

#### Scenario: Family Dashboard view
- **WHEN** user clicks "Family Dashboard" in smart views
- **THEN** content area shows aggregate family net worth, per-holder breakdown, and asset allocation chart

### Requirement: Portfolio detail view
When a portfolio is selected, the content area SHALL show a holdings table with: scheme name, folio, units, invested amount, current value, absolute return, return %, and XIRR. The table SHALL be sortable by any column. A summary row SHALL show portfolio totals.

#### Scenario: View portfolio holdings
- **WHEN** user selects a portfolio from the sidebar
- **THEN** content area shows the holdings table with all schemes, current values, and returns

#### Scenario: Sort holdings
- **WHEN** user clicks on the "Return %" column header
- **THEN** holdings table sorts by return percentage (toggle ascending/descending)

#### Scenario: Empty portfolio
- **WHEN** user selects a portfolio with no transactions
- **THEN** content area shows an empty state prompting to import a CAS PDF

### Requirement: CAS PDF import dialog
The system SHALL provide a dialog for uploading CAS PDF files. The dialog SHALL accept: file upload (drag-drop or file picker), PDF password input field, and portfolio selection (which portfolio to import into). It SHALL show import progress and results.

#### Scenario: Upload CAS PDF
- **WHEN** user opens import dialog, selects a PDF file, enters password, and selects target portfolio
- **THEN** system uploads the file, shows a spinner during parsing, then displays results: schemes found, transactions imported, duplicates skipped

#### Scenario: Import error display
- **WHEN** CAS PDF parsing fails (wrong password, corrupt file, unsupported format)
- **THEN** dialog shows a clear error message without closing, allowing retry

#### Scenario: Import success
- **WHEN** import completes successfully
- **THEN** dialog shows success summary and a "View Holdings" button that closes the dialog and navigates to the portfolio

### Requirement: Transaction history view
The system SHALL provide a transaction history view accessible from a portfolio. Transactions SHALL display in a table: date, scheme, type (buy/sell/SIP/etc.), amount, units, NAV, balance. Filters SHALL include scheme selector, transaction type, and date range.

#### Scenario: View all transactions
- **WHEN** user clicks "Transactions" for a portfolio
- **THEN** system shows all transactions in reverse chronological order

#### Scenario: Filter by scheme
- **WHEN** user selects a specific scheme from the filter dropdown
- **THEN** table shows only transactions for that scheme

### Requirement: Investment plan UI
The system SHALL provide UI for creating and managing investment plans. Plan creation SHALL include: name, total corpus, start date, optional end date. The plan detail view SHALL show allocations as cards/rows with target amount, deployed amount, remaining, progress bar, and target buy price.

#### Scenario: Create new plan
- **WHEN** user clicks "New Plan" and fills in name and corpus
- **THEN** system creates the plan and opens the plan detail view for adding allocations

#### Scenario: Add allocation to plan
- **WHEN** user adds an allocation with asset name, target amount, and optional buy price
- **THEN** system adds the allocation row to the plan, showing it as 0% deployed

#### Scenario: Record deployment
- **WHEN** user clicks "Record Deployment" on an allocation and enters amount, units, and price
- **THEN** system creates the deployment event and updates the allocation's deployed amount and progress bar

#### Scenario: View plan history
- **WHEN** user expands the history section of a plan
- **THEN** system shows chronological list of all revision and deployment events with dates and details

### Requirement: Portfolio creation dialog
The system SHALL provide a dialog for creating new portfolios. Fields: name (required), holder_name (required), PAN (required, masked input showing only last 4 chars after entry), email (optional), description (optional).

#### Scenario: Create portfolio
- **WHEN** user fills in the form and submits
- **THEN** system creates the portfolio and it appears in the sidebar under the appropriate holder group

#### Scenario: PAN masking
- **WHEN** user enters a PAN number
- **THEN** input masks the PAN after entry, showing only "****1234F" pattern

### Requirement: Family dashboard
The family dashboard SHALL show: total family net worth (sum of all portfolio current values), per-holder cards (holder name, total invested, current value, return), and an asset allocation view showing MF scheme distribution across the family.

#### Scenario: Family overview
- **WHEN** user navigates to Family Dashboard
- **THEN** system shows family net worth prominently, followed by per-holder summary cards, each showing their total invested, current value, and return percentage

#### Scenario: Single holder
- **WHEN** user has portfolios for only one PAN
- **THEN** family dashboard shows the same data as the holder view (no redundant grouping), but the view still works

### Requirement: Watchlist cross-reference
When viewing a portfolio holding, if the same asset (by ISIN) exists in the watchlist, the system SHALL show a subtle indicator (e.g., small icon or badge). Clicking it SHALL navigate to the watchlist item. This is frontend-only composition — no cross-service API calls.

#### Scenario: Holding exists in watchlist
- **WHEN** portfolio shows a holding for ISIN "INF846K01EW2" and watchlist has the same ISIN
- **THEN** holding row shows a small link icon; clicking it navigates to the watchlist item detail

#### Scenario: Holding not in watchlist
- **WHEN** portfolio shows a holding with an ISIN not in watchlist
- **THEN** no watchlist indicator is shown

### Requirement: Sidebar navigation entry
The app shell sidebar SHALL include a "Portfolio" entry (with appropriate icon) in the main navigation, positioned after "Watchlist".

#### Scenario: Navigate to portfolio
- **WHEN** user clicks "Portfolio" in the app shell sidebar
- **THEN** system navigates to the portfolio module and loads the default view
