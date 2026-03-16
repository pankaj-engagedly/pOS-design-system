# pOS — Personal Operating System

## Project Requirements & Architecture Reference

**Version**: 2.0 (Living Document)
**Last Updated**: 2026-03-16
**Author**: Pankaj + Claude

---

## 1. Vision

pOS is a self-hosted personal hub that consolidates daily activities — notes, todos, knowledge management, document storage, photo consolidation, credential vault, and content feeds — into a single platform.

Beyond the product, pOS serves as a **learning vehicle** for modern distributed systems: microservices, event-driven architecture, containerized deployment (Docker → Kubernetes), and AI-powered automation.

---

## 2. Current Build Status

### What's Running (as of March 2026)

| Module | Backend | Frontend | Status |
|---|---|---|---|
| **Auth** | ✅ :8001 | ✅ Login + Registration pages | Complete |
| **Todos** | ✅ :8002 | ✅ Full UI with subtasks, attachments, board view | Complete |
| **Attachments** | ✅ :8003 | ✅ Used by Todos and Documents | Complete |
| **Notes** | ✅ :8004 | ✅ Folders, tags, Tiptap editor, search | Complete |
| **Documents** | ✅ :8005 | ✅ Full UI — folder tree, upload, list, share | Complete |
| **Vault** | ✅ :8006 | ✅ 3-column layout, field reveal/copy | Complete |
| **Gateway** | ✅ :8000 | — | Complete |
| Knowledge Base | — | — | Not Started |
| Feed Watcher | — | — | Not Started |
| Photos | — | — | Not Started |

### Active Change Queue

None — all changes archived. Next up: Knowledge Base (Phase 4).

---

## 3. Feature Requirements

### 3.1 Todo List ✅ Built

| Requirement | Details | Status |
|---|---|---|
| Lists | Tasks belong to a list. Default "Inbox". Create/rename/reorder/delete lists. | ✅ |
| Fields | Title, description, due date, priority (none/low/medium/high/urgent), status | ✅ |
| Important/Urgent | Star (important) and fire (urgent) flags. Quick filter by flagged items. | ✅ |
| Subtasks | Flat checklist within a task. Progress shown on task rows. | ✅ |
| Attachments | Attach files via Attachment service. | ✅ |
| Tags | Polymorphic tagging via shared tag_service. | ✅ |
| Views | List view, Board view (kanban by status). Smart views: Inbox, Today, Upcoming, Completed. | ✅ |
| Recurring tasks | Deferred to future phase. | ❌ |

### 3.2 Notes ✅ Built

| Requirement | Details | Status |
|---|---|---|
| Fields | Title (auto from first line if blank), body (rich text via Tiptap), color, pinned flag | ✅ |
| Organization | Folders (one level), tags | ✅ |
| Editor | Tiptap Core — bold, italic, links, code blocks, lists, headings. Works in Shadow DOM. | ✅ |
| Auto-save | Debounced 2s save with visual indicator | ✅ |
| Search | Full-text search on title + body | ✅ |
| Archive | Soft-delete with restore | ✅ |

### 3.3 Vault ✅ Built

**Implementation differs from original plan** — simplified for faster delivery.

| Requirement | Details | Status |
|---|---|---|
| Structure | Items → Fields (no "Groups" layer — tags serve as grouping) | ✅ |
| Fields | Fully dynamic key-value. User defines field names. | ✅ |
| Field types | text, secret, url, email, phone, notes | ✅ |
| Encryption | Fernet (AES-128-CBC) per-user key via HKDF(SHA-256). Server-side. | ✅ |
| Reveal on click | Secret fields masked by default, reveal via API call | ✅ |
| Copy to clipboard | Reveal + copy without displaying on screen | ✅ |
| Tags | Group items (e.g. banks, demat, saas) | ✅ |
| Search | Search by name | ✅ |
| Favorites | Star items, filter by favorites | ✅ |
| Master password | NOT implemented — server-side key instead (see Architecture Decisions) | ❌ |
| Import/Export | Not yet implemented | ❌ |
| Field history | Not yet implemented | ❌ |
| Templates | Not yet implemented | ❌ |

### 3.4 Knowledge Base

**Core**: Curated library of web content, articles, podcasts, videos, and personal excerpts.

| Requirement | Details |
|---|---|
| Item types | Web link (article), YouTube video, Audio/Podcast, Excerpt (rich text), Document |
| Fields | Title, URL, Source, Author, Type, Summary/Notes (rich text), Rating |
| Queue system | Inbox → To Read/Watch/Listen → In Progress → Done → Archived |
| Categories | Hierarchical: Architecture, Design, Science, Math, Finance, Tech, etc. |
| Tags | Flexible cross-cutting tags |
| Highlights | Annotate passages with margin notes |
| Collections | Curated sets ("Best Architecture Reads 2025") |
| Search | Full-text across titles, notes, highlights |

**Inspiration**: Pocket, Raindrop.io, Readwise.

### 3.5 Blog / Podcast Feed Watcher

**Core**: RSS/Atom feed aggregator with KB and Todos integration.

| Requirement | Details |
|---|---|
| Feed sources | RSS/Atom, YouTube channel, Podcast RSS. OPML import. |
| Organization | Folders (Tech Blogs, Podcasts, News) |
| Feed view | Unified timeline. Filter by folder or feed. |
| Item actions | Mark read/unread, Star, Save to KB, Create Todo, Share |
| Refresh | APScheduler background polling (configurable interval, default 1h) |
| Read tracking | Unread count badges. Mark all read. |
| Retention | Auto-archive items older than N days. Keep starred forever. |

### 3.6 Document Repository ⚠️ In Progress

| Requirement | Details | Status |
|---|---|---|
| Structure | Nested folder hierarchy | ✅ Backend |
| Upload | Drag-and-drop multi-file upload with progress | ⚠️ In Progress |
| File types | PDF, images, spreadsheets, documents | ✅ Backend |
| Metadata | Filename, description, tags, comments | ✅ Backend |
| Versioning | Upload new version, keep history, download any version | ✅ Backend |
| Sharing | Cross-user sharing with permission levels (view/download/edit) | ✅ Backend |
| Search | Search by filename, description, tags | ✅ Backend |
| Frontend | Folder tree, document list, upload component, share dialog | ⚠️ In Progress |

### 3.7 Photo Consolidation

**Core**: Unified photo library with multi-source sync.

| Requirement | Details |
|---|---|
| Sources | Manual upload first. Google Photos API, WhatsApp export later. |
| Organization | Auto-organize by date. Albums. Smart albums. |
| Deduplication | Hash-based on import. Near-duplicate comparison. |
| Metadata | EXIF extraction (date, location, camera). AI auto-tagging (Phase 6). |
| Browse | Grid, timeline, album views. |
| Sharing | Share albums with other pOS users. |

**Note**: Starting with manual upload. API integrations (Google Photos, iCloud) are significant OAuth undertakings — deferred.

### 3.8 Authentication & Multi-Tenancy ✅ Built

| Requirement | Details | Status |
|---|---|---|
| Registration | Email + password. | ✅ |
| Login | Email + password. JWT access token (in-memory) + refresh token (localStorage). | ✅ |
| Session | JWT HS256 access tokens (15 min) + refresh tokens (7 days, rotated). | ✅ |
| MFA | TOTP-based. Deferred. | ❌ |
| Profile | Name, email, password change. | ✅ |
| Multi-tenancy | `user_id` on all entities. `UserIdMiddleware` injects header. `UserScopedBase` enforces in ORM. | ✅ |

---

## 4. Architecture

### 4.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │  Design   │  │            App Shell                     │ │
│  │  System   │  │  (Router, Layout, Auth, Module Loader)   │ │
│  │ (Atoms)   │  ├──────────────────────────────────────────┤ │
│  │           │  │  Feature Modules (Web Components)        │ │
│  │           │  │  Auth│Todos│Notes│Vault│Docs│KB│Feeds    │ │
│  └──────────┘  └──────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP / REST
┌─────────────────────────┴───────────────────────────────────┐
│                  API Gateway (:8000)                          │
│         JWT middleware + httpx proxy to services              │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬───────────────┘
   │      │      │      │      │      │      │
:8001  :8002  :8003  :8004  :8005  :8006  (future)
Auth  Todos  Attach Notes  Docs  Vault
                           │
                    ┌──────┴──────────────────┐
                    │  Shared Infrastructure   │
                    │  PostgreSQL 17 (local)   │
                    │  RabbitMQ (events)       │
                    │  shared/migrations       │
                    │  (tags, taggables tables)│
                    └─────────────────────────┘
```

### 4.2 Frontend Architecture

The frontend follows **Atomic Design** in principle, but in practice modules use a flattened `components/` + `pages/` + `services/` + `store.js` structure (the full molecules/organisms/templates hierarchy adds overhead without benefit at this scale).

**Actual module structure:**
```
modules/<feature>/
├── components/         # Feature-specific Web Components
├── pages/              # Route-level entry point (pos-<feature>-app.js)
├── services/           # API client for this module
└── store.js            # Reactive state (createStore from state-store.js)
```

**Design System** (`design-system/`) provides atoms — `ui-button`, `ui-input`, `ui-badge`, `ui-dialog`, etc. Modules consume these but never redefine them.

**App Shell** (`frontend/shell/`) handles routing, auth guards, sidebar nav, module lazy-loading.

**Shared services** (`frontend/shared/services/`):
- `api-client.js` — fetch wrapper with auth header injection + error handling
- `auth-store.js` — token management, login state, auto-refresh
- `router.js` — hash-based routing, lazy module loading, hidden routes
- `state-store.js` — minimal reactive store (`createStore`, subscribe/getState/setState)

### 4.3 Backend Architecture

**Framework**: FastAPI (async) + SQLAlchemy 2.0 async + Alembic

**Shared Python libraries** (installed as local packages via pip `-e`):

| Package | Path | Provides |
|---|---|---|
| `pos_contracts` | `backend/shared/pos_contracts/` | `UserScopedBase`, `BaseServiceConfig`, `tag_service`, schemas, exceptions, logging helpers |
| `pos_events` | `backend/shared/pos_events/` | `EventBus`, `DomainEvent`, RabbitMQ transport |

Each service imports from these and has its own `requirements.txt`.

**Database**:
- Single PostgreSQL 17 instance (Homebrew local)
- Single schema, all tables in public
- Per-service Alembic version tables: `alembic_version_auth`, `alembic_version_todos`, etc.
- Shared migrations live in `backend/shared/migrations/` with `alembic_version_shared`
- `UserScopedBase` auto-adds: `id` (UUIDv7), `user_id` (UUID), `created_at`, `updated_at`

**Auth model**: Uses plain `Base` (not `UserScopedBase`) — User entities are not user-scoped.

**Tag system**: Shared `tags` + `taggables` tables (polymorphic: entity_type + entity_id). Managed by `pos_contracts.tag_service` with entity types: `"todo"`, `"note"`, `"document"`, `"vault_item"`.

**Gateway pattern**: Thin FastAPI app. JWT validation via `python-jose`. Injects `X-User-Id` header. All service routes proxied via `httpx.AsyncClient`.

### 4.4 Service Communication

**Synchronous**: Gateway → Services via HTTP (httpx). Services do not call each other directly.

**Asynchronous**: RabbitMQ topic exchange `pos.events`. Best-effort (non-blocking, failures logged but don't break requests). Each service has an `events.py` with `DomainEvent` subclasses.

**Event routing keys in use:**
```
auth.user.registered, auth.user.login
todo.item.created, todo.item.updated, todo.item.completed, todo.item.deleted
note.created, note.updated, note.deleted
vault.item.created, vault.item.updated, vault.item.deleted
vault.field.added, vault.field.updated, vault.field.deleted
doc.uploaded, doc.shared, doc.deleted
```

### 4.5 Security Architecture

**Authentication**: JWT HS256 (symmetric, not RS256 as originally planned — RS256 adds key management complexity without benefit for single-server deployment). Access tokens in memory (15 min), refresh tokens in localStorage (7 days, rotated on use).

**Password hashing**: `bcrypt` direct (NOT passlib — passlib adds an unnecessary abstraction layer, direct bcrypt is simpler and clearer).

**Vault encryption**: Fernet (AES-128-CBC + HMAC-SHA256) per-user keys derived via HKDF(SHA-256) with `APP_SECRET_KEY` as IKM and `user_id` as salt. Server-side encryption only for `secret`-type fields. Explicit `/reveal` endpoint prevents accidental log exposure.

> **Note on original vault design**: The original plan called for AES-256-GCM with a user-held master password (1Password model). This was simplified: the master password model adds significant complexity (key derivation ceremonies, session unlock flows, recovery code generation) and prevents server-side features like search and sharing. For a personal single-user deployment, server-side encryption with a strong app secret is a pragmatic trade-off. Can revisit if multi-user sharing of vault items becomes a requirement.

**User isolation**: All DB queries automatically scoped by `user_id` via `UserScopedBase`. Services read user from `X-User-Id` header (injected by gateway after JWT validation) via `UserIdMiddleware`.

---

## 5. Project Structure (Actual)

```
pOS-design-system/
│
├── design-system/              # Web Component library (atoms)
│   ├── src/components/         # ui-* components (17+)
│   ├── src/core/               # PosBaseElement, define.js
│   ├── tokens/                 # Raw + semantic design tokens
│   ├── test/                   # @web/test-runner tests (100+ tests)
│   └── package.json
│
├── frontend/
│   ├── shell/                  # App shell
│   │   ├── index.html
│   │   ├── app-shell.js        # Layout, auth guard, sidebar nav
│   │   └── components/         # pos-app-sidebar, pos-app-header
│   ├── shared/
│   │   ├── services/           # api-client, auth-store, router, state-store
│   │   └── components/         # Shared components (pos-rich-editor, etc.)
│   ├── modules/
│   │   ├── auth/               # Login + registration pages
│   │   ├── todos/              # components/, pages/, services/, store.js
│   │   ├── notes/              # components/, pages/, services/, store.js
│   │   ├── vault/              # components/, pages/, services/, store.js
│   │   ├── documents/          # pages/ done, components/ in progress
│   │   ├── knowledge-base/     # Skeleton only
│   │   ├── feed-watcher/       # Skeleton only
│   │   ├── photos/             # Skeleton only
│   │   └── settings/           # Skeleton only
│   ├── esbuild.config.js
│   └── package.json
│
├── backend/
│   ├── gateway/                # :8000 — JWT middleware + httpx proxy
│   ├── services/
│   │   ├── auth/               # :8001 — users, tokens, bcrypt
│   │   ├── todos/              # :8002 — lists, tasks, subtasks
│   │   ├── attachments/        # :8003 — file upload/download, local FS
│   │   ├── notes/              # :8004 — notes, folders, Tiptap JSON
│   │   ├── documents/          # :8005 — nested folders, versioning, sharing
│   │   └── vault/              # :8006 — items, encrypted fields, tags
│   └── shared/
│       ├── pos_contracts/      # UserScopedBase, config, tag_service, schemas
│       ├── pos_events/         # EventBus, DomainEvent, RabbitMQ transport
│       ├── migrations/         # Shared Alembic: tags + taggables tables
│       └── pyproject.toml
│
├── infra/scripts/
│   ├── dev-start.sh            # Starts all services + infra
│   ├── dev-stop.sh             # Stops all services
│   └── setup-dev.sh            # One-time environment setup
│
├── openspec/                   # Change management workflow
│   ├── config.yaml
│   ├── specs/
│   └── changes/
│       ├── archive/            # Completed changes (9 from design system era,
│       │                       # 7 from app build era archived 2026-03-16)
│       └── document-repository/ # Active — frontend components remaining
│
├── docs/
│   ├── PROJECT_REQUIREMENTS.md    # This document
│   └── session-log-*.md           # Session notes
│
├── Makefile                    # make dev / stop / test / db-migrate
└── README.md
```

---

## 6. Technology Stack

| Layer | Technology | Decision |
|---|---|---|
| **Frontend** | Vanilla JS + Web Components | No framework — learning + longevity goal |
| **Design System** | Custom pos-design-system | Built first, provides atoms for the app |
| **Frontend Build** | esbuild | Fast, simple, already in use |
| **Frontend Tests** | @web/test-runner + Playwright | In use for design system (100+ tests) |
| **Rich Text** | Tiptap Core (MIT) | Headless — works in Shadow DOM. Only free/core extensions. |
| **Backend Framework** | FastAPI + Python 3.12 | Async, OpenAPI docs, modern. Learning goal. |
| **ORM** | SQLAlchemy 2.0 async + Alembic | Industry standard. Per-service migration chains. |
| **Database** | PostgreSQL 17 (Homebrew local) | Reliable. FTS, JSONB. Single instance, user_id scoped. |
| **Password hashing** | bcrypt (direct, no passlib) | Simpler. passlib is unnecessary indirection. |
| **JWT** | python-jose, HS256 | HS256 sufficient for single-server personal use. |
| **Message Broker** | RabbitMQ (aio-pika) | Events best-effort. Sweet spot between Redis and Kafka. |
| **File Storage** | Local filesystem | Simple. MinIO (S3-compat) in a later phase. |
| **Vault encryption** | Fernet via HKDF + APP_SECRET_KEY | Server-side, per-user key. Simpler than master-password model. |
| **Feed Scheduling** | APScheduler (future) | In-process, PostgreSQL-backed. Celery is overkill. |
| **Monorepo Tooling** | Makefile | Language-agnostic, zero deps, transparent. Works for Python + JS. |
| **Containerization** | Docker (future Phase 5) | K8s EKS later. Not needed yet. |

---

## 7. Key Architectural Decisions

### 7.1 Single DB, User-Scoped Isolation

One PostgreSQL instance, one schema. All entities carry `user_id`. Isolation via `UserScopedBase` in ORM + `UserIdMiddleware` reading `X-User-Id` header. Each service still owns its own Alembic migration chain (separate version tables). No cross-service table joins — services communicate via REST/events.

### 7.2 Shared Library Split: pos_contracts + pos_events

Originally designed as one `pos_common` library. Split into two focused packages:
- `pos_contracts` — framework concerns (base models, config, schemas, exceptions, tag_service)
- `pos_events` — event bus concerns (RabbitMQ transport, DomainEvent base class)

This separation makes it clear which services need events vs just contracts, and lets you mock the event bus in tests without touching the database layer.

### 7.3 Shared Tags Table

Tags and taggables live in `backend/shared/migrations/` and are created once via shared Alembic. Each service links to the shared tables via `tag_service` using `entity_type` strings (`"todo"`, `"note"`, `"document"`, `"vault_item"`). This avoids duplicating tag infrastructure across services.

### 7.4 Vault: Server-Side Encryption vs Master Password

The original design called for a user-held master password (1Password model). Simplified to server-side Fernet encryption keyed by HKDF(app_secret, user_id). Reasons:
- Master password adds significant UX complexity (unlock flow, recovery codes, key escrow decision)
- Prevents server-side features (field search, sharing, admin recovery)
- For a personal single-user deployment, server-side encryption with a strong secret is pragmatically sufficient
- Can add a master password layer later if sharing encrypted fields between users becomes a requirement

### 7.5 JWT: HS256 Not RS256

Original plan used RS256 (asymmetric). Changed to HS256. RS256 adds key pair management (private key handling, rotation, distribution to services) without meaningful security benefit when all services run on the same server. For multi-server or public key distribution scenarios, RS256 makes sense.

### 7.6 Frontend: Flat Module Structure vs Full Atomic Hierarchy

Original plan had strict atoms/molecules/organisms/templates/pages layers inside each module. In practice, most features have 3-5 components that don't need that taxonomy. Flattened to `components/` + `pages/` inside each module. Shared organisms are in `frontend/shared/components/`. The design system remains the atoms layer.

### 7.7 API Gateway: Custom FastAPI (Not Kong, Nginx, Traefik)

A thin FastAPI app proxying via httpx. Simple to understand and modify. No external dependency to manage. In a production K8s setup, an ingress controller (Traefik or AWS ALB) would sit in front, and the Python gateway would handle only auth/JWT/user_id injection.

### 7.8 Monorepo Tooling: Makefile Over Turborepo/Nx

Turborepo/Nx are JavaScript-ecosystem tools that don't understand Python services, Alembic migrations, or Docker Compose. A Makefile is language-agnostic and transparent — each target is plain shell.

---

## 8. Lessons Learned

### Backend

1. **Per-service Alembic version tables are essential.** Using the default `alembic_version` table would cause all services to share migration state. Use `version_table = "alembic_version_<service>"` in `env.py`.

2. **Shared table migrations must be idempotent.** When shared tables (tags, taggables) are run across a fresh DB that already has some tables from an older migration, use `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` in raw SQL rather than `op.create_table()`.

3. **Alembic `script_location` must be `.` when `alembic.ini` is inside the migrations directory.** A common mistake is `script_location = migrations` which looks for a subdirectory.

4. **Delete with cascade requires explicit import.** `from sqlalchemy import delete` — don't rely on `__import__` hacks or assuming it's available on the module.

5. **bcrypt direct is simpler than passlib.** `import bcrypt; bcrypt.checkpw(pw.encode(), hash.encode())`. No wrapper needed.

### Frontend

6. **MutationObserver + Shadow DOM don't mix.** `document.querySelectorAll()` does not pierce shadow DOM boundaries. Never use `MutationObserver` on `document.body` to find custom elements inside shadow roots. Bind event listeners directly in `render()` after `shadow.innerHTML` assignment.

7. **Shadow DOM event bubbling needs `composed: true`.** For events that must cross shadow DOM boundaries (e.g., from a component inside a shadow root to a parent outside it), dispatch with `{ bubbles: true, composed: true }`.

8. **Bind shadow DOM events once, not on every render.** Attach listeners in `connectedCallback()`, not inside `render()`. Use `data-action` attributes + event delegation on the shadow root to avoid re-binding.

9. **Store subscriptions must be cleaned up.** `this._unsub = store.subscribe(() => this.render())` in `connectedCallback`, then `this._unsub?.()` in `disconnectedCallback`. Without cleanup, re-mounted components stack subscribers and cause double-renders.

10. **Tiptap works in Shadow DOM with careful initialization.** Must mount inside the shadow root's DOM node, not `document.body`. Pass `element: this.shadow.querySelector('.editor-target')` to the Tiptap `Editor` constructor.

---

## 9. Execution Plan

### Phase 0: Project Restructure ✅ COMPLETE
Monorepo reorganized. Design system in subdirectory. Frontend/backend/infra scaffolded. dev-start.sh, Makefile, PostgreSQL + RabbitMQ infra wired up.

---

### Phase 1: Auth + Todos ✅ COMPLETE
Auth service (registration, login, JWT, profile). Todos service (lists, tasks, subtasks, priorities, status, drag-and-drop). Attachments service (file upload/download). Common tag_service and tagging infrastructure. Full frontend modules with board view, smart views, inline editing.

---

### Phase 2: Notes + Shared Library Refactor ✅ COMPLETE
Notes service (folders, tags, search, archive). Tiptap-based rich text editor in Shadow DOM. Shared library refactored from one package into `pos_contracts` + `pos_events`. Frontend notes module with 3-panel layout, auto-save, color coding, pinning.

---

### Phase 3: Documents + Vault ✅ COMPLETE
**Documents**: Backend (nested folders, versioning, sharing, tagging). Frontend (folder tree, upload with progress, list/grid toggle, share dialog, folder picker for move, shared-with-me view, recents view).

**Vault**: Backend (Fernet encryption, field types, reveal endpoint). Frontend (3-column layout: sidebar / item list / detail with field management, reveal/copy).

---

### Phase 4: Knowledge Base + Feed Watcher
**Goal**: Content curation and external feed ingestion.

| # | Task |
|---|---|
| 4.1 | **KB service**: Item types, queue (inbox → done), categories, collections, highlights/annotations, commentary. Full-text search via PostgreSQL FTS. |
| 4.2 | **KB frontend**: Queue management, rich annotation view, collections. |
| 4.3 | **Feed watcher service**: feedparser + APScheduler, OPML import, read/unread tracking, auto-archive. |
| 4.4 | **Feed frontend**: Unified timeline, folder filtering, save-to-KB / create-todo actions. |
| 4.5 | **KB ↔ Todo integration**: RabbitMQ event — "Create Todo from KB item". |
| 4.6 | **Feed ↔ KB integration**: RabbitMQ event — "Save feed item to KB". |

---

### Phase 5: Photos
**Goal**: Unified photo library.

| # | Task |
|---|---|
| 5.1 | Photo service: upload, date-based auto-organization, albums, EXIF extraction |
| 5.2 | Photo frontend: grid view, timeline view, album management |
| 5.3 | Deduplication: hash-based on import, near-duplicate comparison UI |
| 5.4 | WhatsApp export import (zip file ingestion) |
| 5.5 | Google Photos API (OAuth app review required — may take time) |

---

### Phase 6: Containerization + Deployment
**Goal**: Production-ready on AWS.

| # | Task |
|---|---|
| 6.1 | Dockerize all services (multi-stage builds) |
| 6.2 | Docker Compose production profile |
| 6.3 | Kubernetes manifests (deployments, services, configmaps, secrets) |
| 6.4 | AWS: EKS cluster, RDS (PostgreSQL), S3 (file storage), ECR |
| 6.5 | CI/CD: GitHub Actions → test → build → push to ECR → deploy to EKS |
| 6.6 | MinIO for local S3-compatible file storage (replace local FS) |

---

### Phase 7: AI Agents
**Goal**: AI-powered automation layered on top of the platform.

| # | Task |
|---|---|
| 7.1 | Agent framework using Claude API. Event-driven triggers from RabbitMQ. |
| 7.2 | Feed summarizer: auto-summarize new items, suggest category/priority. |
| 7.3 | KB auto-tagger: categorize and tag based on content. |
| 7.4 | Photo organizer: auto-tag scenes, objects. Face grouping. |
| 7.5 | Search assistant: natural language search across all modules. |
| 7.6 | Smart notifications: personalized nudges ("5 unread KB items this week"). |

---

### Future (Phase 8+)
- MFA (TOTP)
- Stock watchlist and portfolio management
- Finance: bank statement sync, expense tagging, net worth dashboard
- Recurring todos with scheduling
- Calendar integration
- Mobile responsive / PWA
- Offline support (service workers)

---

## 10. Local Development

```bash
# One-time setup
make setup          # Python venv, Node deps, DB init

# Daily development
make dev            # Starts everything: PostgreSQL check, RabbitMQ,
                    # all services (ports 8001-8006), gateway (:8000),
                    # frontend dev server (:3001)

make stop           # Stops all services

# Logs
tail -f /tmp/pos-logs/gateway.log
tail -f /tmp/pos-logs/vault.log
# etc.

# Testing
make test           # All tests
make test-backend   # pytest
make test-frontend  # @web/test-runner
make test-ds        # Design system tests

# Database
make db-migrate     # Run pending Alembic migrations for all services
make db-seed        # Seed development data
make db-reset       # Drop and recreate (careful)
```

### Service Port Map

| Service | Port | URL |
|---|---|---|
| Frontend dev server | 3001 | http://localhost:3001 |
| API Gateway | 8000 | http://localhost:8000 |
| Auth | 8001 | http://localhost:8001/health |
| Todos | 8002 | http://localhost:8002/health |
| Attachments | 8003 | http://localhost:8003/health |
| Notes | 8004 | http://localhost:8004/health |
| Documents | 8005 | http://localhost:8005/health |
| Vault | 8006 | http://localhost:8006/health |

---

## 11. Design System Status

Current atom count: 17+. Anticipated additions as the app demands them (never upfront):

**In active use**: `ui-button`, `ui-input`, `ui-badge`, `ui-tag`, `ui-checkbox`, `ui-spinner`, `ui-icon`, `ui-dialog`, `ui-tooltip`

**Anticipated next**: `ui-file-upload`, `ui-date-picker`, `ui-avatar`, `ui-data-table`, `ui-skeleton`, `ui-empty-state`, `ui-toast`

Rule: atoms added when two or more modules need the same component, not speculatively.

---

## 12. Deferred / Reconsidered Decisions

| Original Decision | Revised Decision | Reason |
|---|---|---|
| Vault master password (1Password model) | Server-side Fernet per-user key | Master password adds UX complexity, blocks server features, overkill for personal use |
| JWT RS256 | JWT HS256 | RS256 key management unnecessary when all services on same server |
| passlib for bcrypt | bcrypt direct | passlib is an unnecessary abstraction |
| `pos_common` single shared library | `pos_contracts` + `pos_events` split | Cleaner separation of DB concerns from event bus concerns |
| Full atomic hierarchy in frontend modules | Flat `components/` + `pages/` | Atoms/molecules/organisms taxonomy adds friction for 3-5 component modules |
| Comments on todos (Phase 1) | Deferred | Adds comment service complexity before core loop is solid |
| Recurring todos (Phase 1) | Deferred to Phase 4+ | Nice-to-have, not in the critical path |
| MFA TOTP | Deferred to Phase 4+ | Not blocking any features |
