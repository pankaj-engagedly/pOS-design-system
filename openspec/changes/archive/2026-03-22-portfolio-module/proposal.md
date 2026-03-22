## Why

Tracking investments across multiple demat accounts, mutual fund folios, and family members is currently done in spreadsheets where every update overwrites the previous value — losing the history of what was planned, what changed, and when capital was deployed. pOS needs a portfolio module that serves as the single source of truth for holdings, investment plans, and capital deployment across the family.

## What Changes

### New: Portfolio Service (backend, :8010)
- **Portfolios**: Named containers with PAN, email, holder name — one per account/folio (e.g., "My Zerodha", "Wife's CAMS MF", "Dad's SBI MF")
- **CAS PDF Import**: Upload CAMS or KFintech CAS PDFs → parse via `casparser` library → extract and store normalized MF transactions (buy, sell, SIP, switch, dividend, redemption)
- **Holdings**: Computed from transactions — current units, invested value, current value (from AMFI NAV), P&L, XIRR per fund and per portfolio
- **Investment Plans**: Corpus-based capital allocation plans with per-asset targets, buy-price triggers, and ledger-style deployment tracking (no overwrites — every change is a record)
- **NAV Data**: Daily MF NAV fetch from AMFI for current valuation
- **Aggregation**: Per-portfolio totals, per-PAN (person) grouping, family-level net worth

### New: Portfolio Frontend Module
- Portfolio list with holder info and summary stats
- Holdings table (fund name, units, invested, current, P&L, XIRR)
- CAS PDF upload dialog with password handling (PAN-based)
- Transaction history view
- Investment plan creation and tracking UI
- Family aggregate dashboard

### Modified: Infrastructure
- Gateway proxy route for `/api/portfolio/*` → `:8010`
- Makefile + dev-start.sh registration for portfolio service
- Frontend shell sidebar navigation entry

## Capabilities

### New Capabilities
- `portfolio-service`: Backend service — portfolios CRUD, CAS PDF import/parsing, transaction storage, holdings computation, NAV fetching, XIRR calculation, aggregation
- `investment-plans`: Investment planning — corpus allocation, per-asset targets with buy prices, ledger-style deployment tracking, plan revision history
- `portfolio-frontend`: Frontend module — portfolio list, holdings view, CAS import dialog, transaction history, investment plan UI, family dashboard

### Modified Capabilities
- None — all existing specs are design-system level. App-level services have no formal specs to modify.

## Impact

- **New service**: `backend/services/portfolio/` on port 8010 with Alembic migrations
- **New frontend module**: `frontend/modules/portfolio/`
- **Gateway**: New proxy route in `backend/gateway/app/routes.py`
- **Infra**: Updates to `Makefile`, `infra/scripts/dev-start.sh`
- **Dependencies**: `casparser` (MIT, for CAMS/KFintech PDF parsing), `mftool` or AMFI CSV for NAV data
- **Shared**: Uses `pos_contracts` (UserScopedBase, tag_service with entity_type="portfolio_item")
- **Cross-service**: Watchlist linkage via shared ISIN/ticker identifiers (frontend-level composition, no direct DB coupling)
