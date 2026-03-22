## 1. Service Scaffolding & Infrastructure

- [x] 1.1 Create `backend/services/portfolio/` directory structure: app/, migrations/versions/, alembic.ini, requirements.txt
- [x] 1.2 Create `app/db.py` (async session), `app/config.py` (BaseServiceConfig subclass, SERVICE_NAME="pos-portfolio", port 8010)
- [x] 1.3 Create `app/main.py` with FastAPI app, UserIdMiddleware, lifespan (init_db, scheduler), health endpoint
- [x] 1.4 Create Alembic env.py with per-service version table (`alembic_version_portfolio`)
- [x] 1.5 Add gateway proxy route: `/api/portfolio/*` → `http://localhost:8010` in `backend/gateway/app/routes.py`
- [x] 1.6 Register portfolio service in Makefile (log level variable, pass to dev-start.sh)
- [x] 1.7 Add portfolio service startup, migrations, and health check to `infra/scripts/dev-start.sh`
- [x] 1.8 Add `casparser` to requirements.txt, install in venv

## 2. Database Models & Migrations

- [x] 2.1 Create `app/models.py`: Portfolio model (name, holder_name, pan_encrypted, email, description) extending UserScopedBase
- [x] 2.2 Add CASImport model (portfolio_id FK, filename, source_type, import_date, transaction_count, status, raw_file_path)
- [x] 2.3 Add Transaction model (portfolio_id FK, import_id FK, folio_number, amc_name, scheme_name, scheme_isin, amfi_code, transaction_date, transaction_type enum, amount Numeric, units Numeric, nav Numeric, balance_units Numeric) with dedup unique constraint
- [x] 2.4 Add NAVCache model (amfi_code, scheme_name, nav Numeric, nav_date, updated_at) with unique constraint on (amfi_code, nav_date)
- [x] 2.5 Create Alembic migration 001: portfolios, cas_imports, transactions, nav_cache tables

## 3. Investment Plan Models & Migration

- [x] 3.1 Add InvestmentPlan model (name, total_corpus Numeric, start_date, end_date, status enum, notes) extending UserScopedBase
- [x] 3.2 Add PlanAllocation model (plan_id FK, asset_identifier, asset_name, asset_type, target_amount Numeric, target_price Numeric nullable, priority int)
- [x] 3.3 Add DeploymentEvent model (allocation_id FK, event_date, amount Numeric, units Numeric nullable, price_per_unit Numeric nullable, transaction_id UUID nullable, notes) — immutable ledger
- [x] 3.4 Add PlanRevisionEvent model (plan_id FK, event_type enum, previous_value text, new_value text, event_date, notes) — immutable ledger
- [x] 3.5 Create Alembic migration 002: investment_plans, plan_allocations, deployment_events, plan_revision_events tables

## 4. Portfolio Backend — Core CRUD & Schemas

- [x] 4.1 Create `app/schemas.py`: PortfolioCreate, PortfolioUpdate, PortfolioResponse (with masked PAN), PortfolioSummary (with computed stats)
- [x] 4.2 Add CAS import schemas: CASImportResponse, ImportSummaryResponse
- [x] 4.3 Add Transaction schemas: TransactionResponse, TransactionFilter (scheme, type, date range)
- [x] 4.4 Add Holdings schemas: HoldingResponse (scheme, units, invested, current_value, return, xirr), PortfolioHoldingsSummary
- [x] 4.5 Add Aggregation schemas: HolderAggregation, FamilyAggregation
- [x] 4.6 Create `app/service_portfolio.py`: Portfolio CRUD (create, list, get, update, delete with cascade)
- [x] 4.7 Create `app/routes_portfolio.py`: REST endpoints for portfolio CRUD
- [x] 4.8 Add PAN encryption/decryption utility (Fernet with HKDF from APP_SECRET_KEY + user_id, same pattern as vault)

## 5. CAS PDF Import

- [x] 5.1 Create `app/service_cas_import.py`: Accept PDF file + password, parse via casparser.read_cas_pdf(), extract investor info and transactions
- [x] 5.2 Implement transaction normalization: map casparser transaction types to our enum (buy, sell, sip, switch_in, switch_out, dividend_payout, dividend_reinvest, redemption)
- [x] 5.3 Implement dedup logic: check existing transactions by (folio_number, scheme_isin, transaction_date, transaction_type, amount, units), skip duplicates
- [x] 5.4 Store CASImport record with filename, source_type (CAMS/KFintech), counts
- [x] 5.5 Store raw PDF file to `data/portfolio/{user_id}/imports/` for re-parsing capability
- [x] 5.6 Create `app/routes_import.py`: POST endpoint for PDF upload with multipart form (file + password + portfolio_id)

## 6. Holdings & NAV

- [x] 6.1 Create `app/service_holdings.py`: Compute holdings from transactions — group by scheme_isin, sum units (buy-side minus sell-side), sum invested amounts
- [x] 6.2 Implement XIRR calculation (scipy.optimize or pyxirr library) for per-scheme and per-portfolio returns
- [x] 6.3 Create `app/service_nav.py`: Fetch AMFI daily NAV file, parse CSV, upsert into NAVCache
- [x] 6.4 Add APScheduler job for daily NAV fetch (configurable time, default 23:30 IST)
- [x] 6.5 Create `app/routes_holdings.py`: GET endpoints for holdings (per-portfolio, summary), manual NAV refresh trigger
- [x] 6.6 Implement aggregation endpoints: per-PAN grouping, family totals with XIRR

## 7. Investment Plans Backend

- [x] 7.1 Create investment plan schemas: PlanCreate, PlanUpdate, PlanResponse, PlanSummary
- [x] 7.2 Add allocation schemas: AllocationCreate, AllocationUpdate, AllocationResponse (with computed deployed/remaining)
- [x] 7.3 Add event schemas: DeploymentEventCreate, DeploymentEventResponse, RevisionEventResponse, PlanHistoryResponse
- [x] 7.4 Create `app/service_plans.py`: Plan CRUD, allocation CRUD, deployment event creation (immutable), revision event creation (immutable)
- [x] 7.5 Implement plan summary computation: corpus, allocated, deployed, remaining, per-allocation progress, per-asset-class breakdown
- [x] 7.6 Create `app/routes_plans.py`: REST endpoints for plans, allocations, deployment events, revision events, plan history, plan summary

## 8. Frontend — Module Setup & Store

- [x] 8.1 Create `frontend/modules/portfolio/` directory structure: pages/, components/, services/, store.js
- [x] 8.2 Create `services/portfolio-api.js`: API wrapper for all portfolio endpoints (portfolios, imports, holdings, transactions, plans, allocations, deployments)
- [x] 8.3 Create `store.js`: State management — selectedView, selectedPortfolioId, selectedPlanId, portfolios, holdings, transactions, plans, loading states
- [x] 8.4 Add portfolio route to frontend router and sidebar navigation entry (icon + "Portfolio" label after Watchlist)

## 9. Frontend — Portfolio Views

- [x] 9.1 Create `pages/pos-portfolio-app.js`: Main app page with pos-module-layout, sidebar + content area, state subscription, data loading
- [x] 9.2 Create `components/pos-portfolio-sidebar.js`: Smart views (All Portfolios, Family Dashboard), portfolio list grouped by holder, investment plans section with progress
- [x] 9.3 Create `components/pos-portfolio-holdings.js`: Holdings table (scheme, folio, units, invested, current, return, XIRR), sortable columns, summary row, empty state
- [x] 9.4 Create `components/pos-portfolio-transactions.js`: Transaction history table with filters (scheme dropdown, type, date range), reverse chronological
- [x] 9.5 Create `components/pos-portfolio-create-dialog.js`: Portfolio creation form (name, holder_name, PAN masked input, email, description)
- [x] 9.6 Create `components/pos-portfolio-import-dialog.js`: CAS PDF upload (drag-drop + file picker), password field, portfolio selector, progress spinner, results summary

## 10. Frontend — Investment Plans UI

- [x] 10.1 Create `components/pos-portfolio-plan-detail.js`: Plan detail view — header (name, corpus, period, progress bar), allocations list as cards/rows
- [x] 10.2 Create `components/pos-portfolio-plan-create-dialog.js`: Plan creation form (name, corpus, start_date, end_date)
- [x] 10.3 Create `components/pos-portfolio-allocation-dialog.js`: Add/edit allocation form (asset name, ISIN/ticker, asset type, target amount, target price)
- [x] 10.4 Create `components/pos-portfolio-deployment-dialog.js`: Record deployment form (amount, units, price, notes) — append-only
- [x] 10.5 Create `components/pos-portfolio-plan-history.js`: Chronological event list (revisions + deployments) with expandable detail

## 11. Frontend — Family Dashboard & Cross-reference

- [x] 11.1 Create `components/pos-portfolio-family-dashboard.js`: Family net worth, per-holder summary cards (name, invested, current, return %), asset allocation breakdown
- [x] 11.2 Implement watchlist cross-reference: when rendering holdings, check if ISIN exists in watchlist store, show link icon, navigate on click
- [x] 11.3 Add currency formatting utility (INR ₹ with lakhs/crores notation) shared across portfolio components

## 12. Integration & Polish

- [x] 12.1 Test full flow: create portfolio → upload CAS PDF → view holdings → check aggregation
- [x] 12.2 Test investment plan flow: create plan → add allocations → record deployments → view history
- [x] 12.3 Test re-import: upload same CAS PDF twice, verify dedup works correctly
- [x] 12.4 Test family aggregation: multiple portfolios with different PANs, verify per-holder and family totals
- [x] 12.5 Verify gateway proxy routing, auth middleware, and error handling
