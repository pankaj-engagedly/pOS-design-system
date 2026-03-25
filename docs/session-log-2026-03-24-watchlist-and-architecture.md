# Session Log — March 24, 2026

## Part 1: Module Fixes & Features

### 1. KB Module Fixes
- **Delete/fav not working on cards**: Fixed z-index on `.card-actions` (thumbnail was intercepting clicks in compact/grid mode). Fixed `_findItem()` to also search home page items (not just store). Added `_refreshCurrentView()` so mutations reload the correct view (home vs list vs feeds).
- **Add content from context**: When adding content from Favourites view, new items auto-marked as favourite. From collection view, auto-added to that collection. Active tag filter pre-filled in dialog.

### 2. Extension Token Refresh Fix
- **Root cause**: Two parallel API calls (tags + collections) both got 401, both tried `tryRefreshToken()` simultaneously. First one rotated the refresh token (server revoked old one), second one failed with the now-revoked token → triggered logout.
- **Fix**: Added refresh mutex (shared promise) so concurrent callers wait for the same refresh. Added proactive refresh on popup open since 15-min tokens are likely expired. Fixed main app's hardcoded `_scheduleProactiveRefresh(120)` → `(15)` to match actual `.env` token expiry. Applied to both Chrome and Safari extensions.

### 3. Document Folder Watcher
- Created `infra/scripts/doc-folder-watch.py` — standalone Python script using `requests` (no watchdog dependency). Watches a local folder, mirrors structure to Documents API, tracks sync state in `~/.pos-doc-sync.json`. Supports one-time sync (`--once`) or polling mode (default 5s interval). Skips dot-files, temp files, system files.

### 4. KB Feed Enhancements
- **Feed artwork**: Improved feed parser to extract `<itunes:image>` (podcast cover art). Subscribe dialog shows artwork in URL mode preview. Podcast subscribe passes iTunes `artworkUrl600` to backend so it's persisted.
- **Podcast playback**: Feed item card detects audio URLs (`.mp3`, `.m4a`, etc.) and opens lightbox audio player instead of `window.open()` (which downloaded the file). Regular articles still open in browser.
- **Feed pagination**: Added "Load older episodes" button. Backend already supported `limit`/`offset`; frontend now uses it. Loads 50 per batch, appends to existing items.
- **Save-to-KB with organizing**: Bookmark click now saves to KB then opens lightbox for immediate tagging/collection assignment. Already-saved items open their existing KB entry in lightbox. Bookmark icon fills solid blue when saved; star fills gold when starred.

### 5. Sidebar Consistency
- **Documents**: Moved "New folder" from `<div slot="footer">` to inline after folder list items (matching Todos/Notes/KB pattern). Added `margin-top` for spacing.
- **Vault**: Moved "New Category" from footer to inline after category items. Categories section header now always shows (even when empty) so the create button is always visible.
- **Photos**: Already inline — no change needed.

### 6. Portfolio Sidebar
- **"+" button fix**: `create-portfolio-request` event was dispatched by sidebar but never listened to in the app. Added the missing event listener.
- **Styling**: Added CSS for `section-sublabel` (holder names like "Pankaj", "Family") — medium weight, secondary color, slight indent. Added `hover-action` CSS — appears on section-label hover, pushes right with `margin-left: auto`.
- **Hover actions on portfolios**: Each portfolio item now has edit (pencil) and delete (trash) on hover. "+" on holder sub-labels creates portfolio pre-filled with that holder name.
- **Edit mode**: Create dialog now doubles as edit dialog — pre-fills all fields (name, holder, PAN, email, description), calls `updatePortfolio` instead of `createPortfolio`.
- **Delete**: Confirmation dialog, calls `deletePortfolio`, resets view if deleted item was selected.

### 7. Watchlist Kanban Board
- **Drag-and-drop cards**: Cards have `draggable="true"`, cursor grab. Drag to another column → `item-stage-change` event → `updateItem({ stage_id })`. Visual feedback: card dims, target column gets blue outline.
- **Column reorder**: Column headers are draggable. Drop → `stages-reorder` event → `PATCH /stages/reorder` with new ID order. Fixed FastAPI route ordering bug (`/stages/reorder` must be defined before `/stages/{stage_id}` to avoid path parameter collision).
- **Inline stage creation**: Compact 32x32 "+" button after last column (not a full-width column). Click → 180px inline input. Enter creates stage (slug auto-generated server-side). Escape cancels.
- **Board → detail**: Card click now navigates to full detail page (same as table) instead of the limited flyout. Detail page has everything: theme, sub-theme, tags, investment thesis, financials.
- **Delete from all views**: Table (hover trash on row), board (hover actions bar with fav+delete), detail page (delete button in header). All dispatch `item-delete` → confirmation → `deleteItem()` → reload.
- **Favourite on board cards**: Hover actions bar with star (fav) + trash (delete), matching the pattern across other modules. Star fills gold when active.

---

## Part 2: Watchlist Financial Data Overhaul

### Questions & Answers (from user's 6 questions)

**Q1: More data from yfinance we're not storing?**
Yes — yfinance `.info` returns ~150 fields, we captured ~15. Missing: company description, website, employees, country, forward PE, PEG ratio, P/S, enterprise value, beta, ROA, profit/operating/gross/EBITDA margins, revenue/earnings growth, total revenue/debt/cash, free cashflow, EBITDA, debt-to-equity, current ratio, analyst targets, recommendation, ownership percentages.

**Q2: Refresh not working?**
Tested — actually working. Timestamps update correctly. "Not refreshing" was because market was closed on weekends (yfinance returns same price). Manual refresh confirmed: 18:40:50 → 18:49:00 timestamp change.

**Q3: Historical data in JSONB?**
Two systems: `FinancialStatement` table stores accumulated data (upserted daily, incremental — old periods preserved). But the frontend detail page was calling `fetch_financials()` LIVE from yfinance on every page load, getting only last 4 years. Fixed to read from accumulated table.

**Q4: Income statement structure looks wrong?**
yfinance returns raw GAAP/IFRS items ("Tax Effect Of Unusual Items", "Reconciled Depreciation"). ValueResearch shows clean P&L (Revenue, Expenses, Net Profit). Created `financial_mapping.py` to map 50+ raw items to clean standardized sections.

**Q5: Does yfinance give cash flow?**
Yes — `ticker.cashflow` + quarterly variant. We already accumulated it but the frontend only showed income + balance sheet. Added cash flow to the display.

**Q6: Storing incrementally or overwriting?**
Incremental (upsert). Unique constraint on `(item, type, period, freq)`. Year 1: yfinance returns 2022-2025 → stored. Year 2: returns 2023-2026 → 2022 preserved, 2026 added. Over time builds history beyond yfinance's window.

### Implementation

#### Phase A — Quick wins
- **Migration 007**: 31 new columns on `market_data_cache` — company info, valuation, profitability, financials, analyst, ownership.
- **Updated `fetch_stock_data()`**: Extracts all new fields from yfinance `.info`.
- **Financials endpoint**: Now reads from `FinancialStatement` table. Falls back to live fetch+accumulate on first access. Returns standardized sections.

#### Phase B — Clean presentation
- **`financial_mapping.py`**: Standardizes raw yfinance → clean sections:
  - Income: Revenue → Expenses → Profitability (EBITDA, EBIT, Net Income) → Per Share (EPS)
  - Balance Sheet: Assets (current/non-current) → Liabilities → Equity → Key Metrics (book value, net debt, working capital)
  - Cash Flow: Operating → Investing → Financing → Summary (FCF, net change, beginning/ending cash)
- Financial tables now have section header rows (uppercase, secondary background).

#### Phase C — Company profile + trends
- **Company profile**: Business description (truncated 400 chars), website link, employee count, location — in detail page right column.
- **Analyst badge**: Color-coded (`strong_buy`=green, `hold`=yellow, `sell`=red) with target price range and analyst count.
- **Financial highlights bar charts**: Revenue (blue), Net Profit (green), EBITDA (purple) as bar charts over all accumulated years. Red for negative values.
- **Enhanced stock metrics grid**: 32 metrics organized by category (up from 12).

### Shared Securities Refactor (Migration 008)

**Problem**: Market data was user-scoped. Two users watching RELIANCE.NS = two cache rows, two fetches, two sets of financial statements. Wasteful and wrong.

**Solution**: New `securities` table — shared across all users.
```
securities (shared)
  ├── market_data_cache (1:1)
  ├── metric_snapshots (daily)
  └── financial_statements (accumulated)

watchlist_items (user-scoped)
  └── security_id FK → securities
```

**Migration**: Created `securities` from distinct `(symbol, asset_type)` in `watchlist_items`. Migrated cache/snapshots/financials from `watchlist_item_id` to `security_id`. Deduplicated rows (kept most recent per security). Dropped old columns.

**Technical challenge**: SQLAlchemy `Base` vs `UserScopedBase` are separate `DeclarativeBase` subclasses with separate metadata. ForeignKeys can't resolve across metadata boundaries. Solution: All models use `UserScopedBase` (shared tables have nullable `user_id`). Cross-base relationships set up at module bottom using direct class references instead of strings.

**Result**: 16 securities, 16 cache rows (1:1), 20 watchlist items (multiple users share securities). Scheduler refreshes 16 tickers instead of 20.

### Asset Class Enrichment
- **Mutual Funds**: Computes 1Y/3Y/5Y returns from NAV history, extracts fund house, scheme type, category, inception date from mftool.
- **ETFs**: Added description, beta (`beta3Year`), returns (`trailingAnnualTotalReturn`, `threeYearAverageReturn`, `fiveYearAverageReturn`), website.
- **Crypto**: Added description extraction from yfinance `.info`.

### Indian Number Formatting
- INR: `₹10,41,627 Cr` (Indian comma notation with Cr/Lakh suffixes)
- USD/other: `$2.1B` (Western notation)
- Currency-aware `_fmtCap()`, `_fmtFin()`, `_fmtTrendVal()` in detail, table, board components.
- `_isINR()` helper checks `cache.financial_currency || cache.currency`.

### Metric Trends Fixes
- **Dropdown blanking on refresh**: `_refresh()` now re-calls `_loadAvailableMetrics()` and `_loadFinancials()` after re-render. Preserves and restores previously selected metric.
- **Duplicate removal**: Backend maps camelCase snapshot keys (`profitMargins`) to snake_case cache keys (`profit_margins`). Only canonical version appears in dropdown.
- **Text fields excluded**: `company_description`, `website`, `city`, `country`, `industry`, `sector`, `category`, `recommendation_key`, `currency`, `full_time_employees` removed from chartable metrics.
- **Manual refresh creates snapshot**: `_take_snapshot_for_security()` called on refresh so metric trends have data immediately.
- **Financial-derived metrics**: Revenue, Net Income, EBITDA, Operating Income, Gross Profit, Total Assets, Total Debt, Total Equity, Operating Cash Flow, Free Cash Flow, CapEx — derived from accumulated annual financial statements. Gives 4-5 years of data points immediately without waiting for daily snapshots.
- **Clean metric count**: Down from 78 to ~45 meaningful, chartable, deduplicated metrics.

---

## Part 3: Architecture Deep Dive — Auth & Security

### How JWT Auth Works in pOS

**Flow**: Browser → Gateway (:8000) → Auth Middleware → Backend Service (:800x)

1. **Gateway auth middleware** (`gateway/app/middleware/auth.py`): Intercepts every request (except public paths). Extracts `Authorization: Bearer <token>`, calls `jwt.decode()` (HS256, ~10μs), puts `user_id` into `request.state`.
2. **Gateway proxy** (`gateway/app/proxy.py`): Forwards request to target service, injects `X-User-Id` header.
3. **Service middleware**: Reads `X-User-Id` header, makes available via `Depends(get_user_id)`.

JWT secret known only to gateway + auth service. Backend services never see the token.

### Token Expiry Handling
- `jwt.decode()` checks `exp` claim automatically. `python-jose` raises `ExpiredSignatureError` (subclass of `JWTError`) if expired.
- Gateway catches it → returns 401.
- Frontend `apiFetch()` catches 401 → calls `refreshAccessToken()` → retries with new token.
- Proactive refresh runs 2 min before expiry (`_scheduleProactiveRefresh(15)`) so most requests never hit a 401.

### JWT Performance
- `jwt.decode()` called on every API request (except public paths).
- HS256 is symmetric HMAC: base64-decode 3 parts, compute HMAC-SHA256, compare signature, check `exp > now`. Pure CPU, ~5-10 microseconds.
- No database call, no network call. At 1000 req/s = 5-10ms total. Negligible vs actual API work (5-500ms).
- RS256 (asymmetric, used by Auth0/Okta) would be ~100x slower (~0.5ms). HS256 is optimal for internal use.

### Attack Vectors

1. **Secret key compromise** (highest risk): `.env` file on disk. If leaked, attacker forges any user's token. Mitigation: secrets manager in production, never commit `.env`, rotate periodically.

2. **Token theft via XSS** (most common real-world): Malicious JS reads access token from memory or refresh token from localStorage. Mitigation: HTTPS, CSP headers, HttpOnly cookies for refresh tokens.

3. **No instant token revocation**: Stolen token valid for full 15 minutes. `jwt.decode()` only checks signature + expiry, not a revocation list. Mitigation: short expiry (15 min is our defense). Or add Redis token allowlist (checked per request).

4. **Refresh token rotation bypass**: Attacker steals refresh token, uses it before legitimate user. Attacker gets new tokens, real user locked out. Mitigation: reuse detection — if revoked refresh token is used, revoke ALL tokens for that user.

5. **Gateway bypass**: Services trust `X-User-Id` header. If attacker reaches service directly (ports 8001-8010), they can set any user ID. Mitigation: network isolation (K8s NetworkPolicy), or HMAC-signed internal headers.

6. **Algorithm confusion**: Theoretical — `alg: none` or HS256→RS256 switch. Prevented: we pass `algorithms=["HS256"]` explicitly to `jwt.decode()`.

**Not vulnerable**: Brute-forcing HS256 (2^256 space), token tampering (HMAC invalidates), replay across users (sub claim is user-specific).

### Redis for Auth — Discussed, Not Implemented

**Allowlist pattern**: `SET token:{jti} {user_id} EX 900` on login, `GET token:{jti}` on every request, `DEL token:{jti}` on logout.

**Blocklist pattern**: Only store revoked tokens. Smaller set but less secure if Redis unreachable.

**Conclusion for pOS**: Not worth it currently. JWT alone with 15-min expiry is sufficient. Redis adds single point of failure and essentially re-invents server-side sessions. The 15-minute expiry IS the revocation mechanism. Add Redis when you actually need instant revocation, session management, or rate limiting — likely Phase 6 when infrastructure justifies it.

**Performance comparison**:
| Approach | Per-request cost | Can revoke? |
|----------|-----------------|-------------|
| JWT only | ~10μs | No |
| JWT + Redis | ~0.3ms | Yes |
| JWT + Auth service call | ~5ms | Yes |
| JWT + Auth service + DB | ~15ms | Yes |

### Gateway Auth Patterns (3 approaches)

**Pattern 1: Gateway validates, services trust header** (what we have)
- Gateway validates JWT, injects `X-User-Id`. Services trust the header.
- Simple, fast, but vulnerable to gateway bypass.

**Pattern 2: Every service validates JWT**
- Gateway passes JWT through. Each service calls `jwt.decode()`.
- Secure but secret sprawl (N services have the key), duplicated auth logic.

**Pattern 3: Gateway validates + signs internal token** (recommended for production)
- Gateway validates external JWT, then HMAC-signs `(user_id, timestamp)` with a separate internal key.
- Services verify the HMAC signature (~5μs) and reject requests older than 30 seconds.
- Two trust boundaries, two keys. External JWT for client auth, HMAC for internal proof.
- Even if a service port is exposed, attacker can't forge the HMAC without the internal key.
- **Mental model**: JWT is the building ID badge (checked at main entrance). HMAC signature is the wristband (verified at every internal door). Can't fake the wristband even if you climb through a window.

**For SaaS at scale**:
- Small-medium (< 50 services): Pattern 3 with HMAC — simple, fast, two keys.
- Large (50+ services, multiple teams): Internal JWT with asymmetric keys (RS256) — gateway signs with private key, services verify with public key (can be distributed freely).
- Enterprise (multi-region, zero-trust): Service mesh with mTLS + OAuth2 token exchange (Istio/Linkerd, SPIFFE). What Google and Netflix use.

### Session Activity Tracking with Redis

**Recording activity**: Gateway updates Redis on every request (fire-and-forget):
```
Key:   activity:{user_id}
Value: timestamp
TTL:   1 hour (auto-expires if no activity)
```

One `SET` per request. Key existence = user active in last hour. TTL handles expiry automatically.

**Session timeout**: Different from token expiry. Token valid 15 min, session timeout 1 hour inactivity. Gateway checks: `EXISTS activity:{user_id}` → missing = force re-login.

**Historical analytics**: Don't write to DB on every request. Background job runs hourly, reads Redis activity keys, writes hourly buckets to database. Gives you activity heatmaps without write amplification.

**Real-time presence**: `SCAN activity:*` → list of currently active users.

**"Logout everywhere"**: Admin deletes all `activity:{user_id}` + `token:{user_id}:*` keys.

**Key principle**: Redis for hot state (is user active RIGHT NOW?), database for historical (when was user active LAST MONTH?). Don't mix them.

---

## Files Changed

### Backend
- `backend/services/watchlist/app/models.py` — Security model, shared cache/snapshot/financial models, cross-base relationships
- `backend/services/watchlist/app/service_market_data.py` — security-based refresh, enriched fetch functions (MF returns, ETF beta, crypto description)
- `backend/services/watchlist/app/service_snapshots.py` — security-based snapshots/financials, `_take_snapshot_for_security`, camelCase→snake_case metric dedup
- `backend/services/watchlist/app/service_watchlist.py` — `get_or_create_security()`, eager-load through security relationship
- `backend/services/watchlist/app/financial_mapping.py` — NEW: standardized P&L/BS/CF line item mapping
- `backend/services/watchlist/app/routes_snapshots.py` — deduplicated metrics, excluded text fields, financial-derived trends
- `backend/services/watchlist/app/routes_search.py` — security-based financials endpoint, snapshot on refresh
- `backend/services/watchlist/app/routes_watchlist.py` — security-based item creation + refresh
- `backend/services/watchlist/app/schemas.py` — 30+ new fields on MarketDataResponse
- `backend/services/watchlist/migrations/versions/007_*` — 31 new cache columns
- `backend/services/watchlist/migrations/versions/008_*` — shared securities table migration
- `backend/services/kb/app/feed_parser.py` — itunes:image extraction
- `backend/services/kb/app/routes_feeds.py` — icon_url on subscribe, route ordering fix
- `backend/services/kb/app/schemas.py` — icon_url on FeedSourceCreate

### Frontend
- `frontend/modules/watchlist/components/pos-watchlist-detail.js` — company profile, analyst badge, financial highlights charts, standardized financial tables, Indian formatting, metric dropdown fix, enhanced metrics grid
- `frontend/modules/watchlist/components/pos-watchlist-board.js` — drag-drop cards+columns, hover actions (fav+delete), inline stage create, Indian formatting
- `frontend/modules/watchlist/components/pos-watchlist-table.js` — delete hover action, Indian formatting
- `frontend/modules/watchlist/pages/pos-watchlist-app.js` — board→detail navigation, delete handler, stage-create/reorder handlers
- `frontend/modules/knowledge-base/components/pos-content-card.js` — z-index fix, .saved/.starred CSS
- `frontend/modules/knowledge-base/pages/pos-knowledge-base-app.js` — _refreshCurrentView, context-aware add, feed-item-play, load-more-feeds
- `frontend/modules/knowledge-base/components/pos-kb-feed-item-card.js` — audio detection, feed-item-play event
- `frontend/modules/knowledge-base/components/pos-kb-feed-timeline.js` — load-more button, hasMore property
- `frontend/modules/knowledge-base/components/pos-kb-subscribe-dialog.js` — artwork in preview, iTunes artwork passthrough
- `frontend/modules/knowledge-base/components/pos-kb-add-content-dialog.js` — context (favourite, collection, tag)
- `frontend/modules/knowledge-base/services/feed-api.js` — subscribeFeed with iconUrl
- `frontend/modules/knowledge-base/store.js` — feedHasMore state
- `frontend/modules/portfolio/components/pos-portfolio-sidebar.js` — hover actions, section styling, holder "+" button
- `frontend/modules/portfolio/components/pos-portfolio-create-dialog.js` — edit mode, holderName pre-fill
- `frontend/modules/portfolio/pages/pos-portfolio-app.js` — create/edit/delete portfolio event handlers
- `frontend/modules/documents/components/pos-documents-sidebar.js` — inline create (moved from footer)
- `frontend/modules/vault/components/pos-vault-sidebar.js` — inline create (moved from footer)
- `frontend/shared/services/auth-store.js` — 15-min proactive refresh
- `extensions/chrome-kb-saver/popup.js` — refresh mutex, proactive refresh
- `extensions/safari-kb-saver/.../popup.js` — same fixes

### New Files
- `backend/services/watchlist/app/financial_mapping.py`
- `backend/services/watchlist/migrations/versions/007_add_company_info_and_ratios_to_cache.py`
- `backend/services/watchlist/migrations/versions/008_shared_securities_table.py`
- `infra/scripts/doc-folder-watch.py`
- `docs/session-log-2026-03-24-watchlist-and-architecture.md`
