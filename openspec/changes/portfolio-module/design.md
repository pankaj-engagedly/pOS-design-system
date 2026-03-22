## Context

pOS currently has a watchlist module (`:8009`) for researching and monitoring assets — stocks, MFs, ETFs, precious metals, bonds, crypto. What's missing is tracking actual ownership: holdings, transactions, cost basis, returns, and investment planning.

The user manages investments across multiple family members, each with their own PAN and demat/MF accounts. Currently tracked in Excel where every cell update overwrites history, losing the trail of planned vs actual deployment. CAMS/KFintech CAS PDFs contain complete MF transaction history and are the primary data source.

The portfolio module sits between watchlist (research) and actual capital deployment, serving as the single source of truth for "what do we own, what's the plan, and how are we tracking."

## Goals / Non-Goals

**Goals:**
- Portfolio containers scoped by PAN/holder — support family-level tracking under one pOS user
- Import MF transactions from CAMS and KFintech CAS PDFs via `casparser`
- Compute holdings, P&L, and XIRR from transaction history
- Daily NAV fetch for current MF valuation
- Investment plans with ledger-style tracking — every allocation, revision, and deployment is a record (no overwrites)
- Aggregation at portfolio level, per-PAN (person), and family (all portfolios)
- Cross-reference with watchlist via shared ISIN/ticker (frontend composition only)

**Non-Goals:**
- Stock/demat holdings import (NSDL CAS parsing is unreliable — v2)
- Broker API integrations (Zerodha Kite Connect, etc. — v2)
- Direct CAMS/NSDL API integration for automated CAS fetching
- Tax computation (capital gains, STCG/LTCG — v2)
- SIP tracking as a first-class entity (SIP transactions are captured, but SIP schedule management is not)
- Real-time price streaming
- Portfolio rebalancing recommendations

## Decisions

### 1. Separate service vs extending watchlist
**Decision**: New service on `:8010`
**Rationale**: Portfolio has fundamentally different domain models (transactions, holdings, cost basis, plans) vs watchlist (market data, research, pipeline stages). Coupling them would bloat the watchlist service and create confusing boundaries. They share asset identifiers (ISIN/ticker) but serve different purposes.
**Alternative**: Extend watchlist with portfolio tables — rejected because it violates single-responsibility and the models are too different.

### 2. CAS parsing approach
**Decision**: Use `casparser` library (MIT license, PyPI)
**Rationale**: Mature open-source library that handles CAMS + KFintech CAS PDFs reliably. Extracts investor info, folio details, scheme info, transactions, and valuations. Handles password-protected PDFs natively. No need to write custom PDF parsing.
**Alternative**: Custom parsing with `pdfminer`/`camelot` — rejected as CAMS PDF format is complex and `casparser` already handles edge cases.

### 3. Holdings computation
**Decision**: Compute holdings from transaction history (not from CAS valuation snapshot)
**Rationale**: CAS valuation is a point-in-time snapshot. By storing all transactions and computing holdings, we get accurate cost basis, can compute XIRR at any point, and handle partial imports (multiple CAS uploads over time). Dedup by folio + scheme + date + amount + units.
**Alternative**: Store CAS valuation directly — rejected because it doesn't support incremental imports or accurate cost-basis tracking.

### 4. NAV data source
**Decision**: AMFI daily NAV file (text/CSV from amfiindia.com)
**Rationale**: Free, official, updated daily by ~11pm IST. Contains NAV for all MF schemes with AMFI code mapping. Same source `mftool` uses internally. We fetch and cache it ourselves to avoid dependency on `mftool`'s scraping approach.
**Alternative**: `mftool` library — acceptable fallback, but direct AMFI fetch is simpler and more reliable.

### 5. Investment plan as ledger
**Decision**: Every plan change (creation, allocation, revision, deployment) is an immutable event record
**Rationale**: The core pain point is Excel overwriting history. A ledger model means you can always see: what was the original plan, when did allocations change, when was capital deployed, what's remaining. Plan "state" is derived by replaying events.
**Alternative**: Mutable plan with audit log — simpler but the audit log becomes the real data, so just make events first-class.

### 6. Plan ↔ Portfolio ↔ Watchlist linking
**Decision**: Shared ISIN/ticker convention, frontend-level composition, no cross-service DB references
**Rationale**: Maintains service boundaries. Both portfolio and watchlist independently store ISIN/ticker. Frontend queries both services and joins in the UI. Gateway could also compose responses if needed, but start with frontend composition.

### 7. Family aggregation model
**Decision**: No separate "member" entity — portfolio containers have holder_name + PAN, aggregate by PAN for per-person view
**Rationale**: The portfolio IS the container, and PAN uniquely identifies a person. Adding a members table is unnecessary indirection. Group-by-PAN gives per-person totals; sum-all gives family totals.

### 8. Transaction deduplication on re-import
**Decision**: Dedup by (folio_number, scheme_isin, transaction_date, transaction_type, amount, units)
**Rationale**: Users will re-import CAS PDFs periodically (each CAS contains full history). We need to merge new transactions without duplicating existing ones. This composite key uniquely identifies a transaction across CAS imports.

## Risks / Trade-offs

- **[CAS format changes]** → `casparser` may break if CAMS/KFintech change PDF format. Mitigation: Pin version, monitor library updates, store raw PDF for re-parsing.
- **[AMFI code mapping]** → CAS uses scheme codes that may not perfectly match AMFI codes. Mitigation: `casparser` provides AMFI code mapping; fall back to scheme name matching.
- **[XIRR computation accuracy]** → XIRR requires accurate transaction dates and amounts. Mitigation: All data comes from CAS (official source), not manual entry.
- **[Large CAS files]** → A CAS spanning 10+ years could have thousands of transactions. Mitigation: Process in background task, show progress. `casparser` is fast (in-memory parsing).
- **[Plan complexity]** → Investment plans with ledger events could become complex UI. Mitigation: Start with simple plan view (target vs deployed), expose event history as expandable detail.

## Migration Plan

New service — no migration needed. Steps:
1. Create `backend/services/portfolio/` with Alembic migrations
2. Add gateway proxy route
3. Register in Makefile + dev-start.sh
4. Create frontend module
5. Add sidebar navigation entry

Rollback: Remove service, drop `portfolio_*` tables, remove gateway route.
