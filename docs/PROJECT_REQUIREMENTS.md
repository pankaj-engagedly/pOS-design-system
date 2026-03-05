# pOS — Personal Operating System

## Project Requirements Document & Execution Plan

**Version**: 1.0 (Draft)
**Date**: 2026-03-05
**Author**: Pankaj + Claude

---

## 1. Vision

pOS is a self-hosted personal hub that consolidates daily activities — notes, todos, knowledge management, document storage, photo consolidation, credential vault, and content feeds — into a single platform. Beyond the product, pOS serves as a learning vehicle for modern distributed systems: micro-frontends, microservices, event-driven architecture, containerized deployment, and AI-powered automation.

---

## 2. Feature Requirements

### 2.1 Todo List

**Core**: Task management with lists, priorities, and attachments.

| Requirement | Details |
|---|---|
| Fields | Title (required), Description (optional, rich text), Due Date, Owner (default: current user), Priority (none/low/medium/high/urgent), Status (todo/in-progress/done/archived) |
| Lists | Tasks belong to a list. Default "Inbox" list. User can create/rename/reorder/delete lists. |
| Ordering | Drag-and-drop reorder within a list. Sort by due date, priority, created date. |
| Important/Urgent | Flag any task as important (star) and/or urgent (fire). Quick filter by flagged items. |
| Subtasks | Optional checklist within a task (flat, not nested). |
| Comments | Threaded comments on any task. |
| Attachments | Attach files to any task (via common Attachment service). |
| Tags | Tag tasks for cross-list organization. |
| Views | List view (default), Board view (kanban by status). |
| Recurring | Optional: recurring tasks (daily/weekly/monthly). Defer to Phase 2. |

**Inspiration**: Todoist (lists + priorities), Google Tasks (simplicity), Things 3 (today/upcoming views).

### 2.2 Notes

**Core**: Quick-capture notes with organization.

| Requirement | Details |
|---|---|
| Fields | Title (auto-generated from first line if blank), Body (rich text / markdown), Color (optional, like sticky notes), Pinned flag |
| Organization | Notes can belong to a folder (one level). Notes can have multiple tags. |
| Editor | Lightweight rich text — bold, italic, links, code blocks, lists. Markdown input supported. |
| Quick capture | "New note" shortcut that opens a minimal editor immediately. Paste-friendly (URLs, text, images). |
| Search | Full-text search across all notes. |
| Archive | Soft-delete to archive. Restore from archive. |

**Inspiration**: Apple Notes (simplicity + folders), Google Keep (colors + pinning), Notion (rich content).

### 2.3 Knowledge Base

**Core**: Curated library of web content, articles, podcasts, videos, and personal excerpts.

| Requirement | Details |
|---|---|
| Item types | Web link (article), YouTube video, Audio/Podcast link, Excerpt (rich text pasted in), Document (uploaded file) |
| Fields | Title, URL (for links), Source, Author (optional), Type, Summary/Notes (rich text — user's commentary), Created date, Rating (1-5 or favorite flag) |
| Queue system | Status: Inbox → To Read/Watch/Listen → In Progress → Done → Archived. This is the consumption pipeline. |
| Categories | Hierarchical categories: Architecture, Design, Science, Math, Finance, Tech, etc. An item can have one primary category + tags. |
| Tags | Flexible tagging (separate from categories). Used for cross-cutting concerns. |
| Highlights | For excerpts and articles: ability to highlight passages and add margin notes (like Medium). Store highlights as annotations linked to the item. |
| Collections | Curated collections (e.g., "Best Architecture Reads 2025", "Podcast Queue"). An item can be in multiple collections. |
| Commentary | Per-item rich text notes — "why I liked this", personal takeaways. |
| Rich text editor | For excerpts: full rich text editing with paste support. Format preservation when pasting from web. |
| Search | Full-text search across titles, notes, highlights, and excerpts. Filter by type, category, tag, status. |

**Inspiration**: Pocket (save for later), Raindrop.io (organization), Readwise (highlights), Notion (rich content).

### 2.4 Vault

**Core**: Secure storage for sensitive information — accounts, credentials, personal records.

| Requirement | Details |
|---|---|
| Structure | Groups → Entries → Fields. Group examples: Banks, Demat, Email, Websites, Insurance, etc. |
| Fields | Key-value pairs per entry. Fully dynamic — user defines keys. Predefined templates for common types (bank account, website login, etc.). |
| Field types | Text, Password (masked by default, reveal on click), URL, Email, Phone, Date, Number, Notes (multiline), File attachment |
| Templates | Pre-built field templates: Bank Account (bank name, account no, IFSC, branch, login URL, user ID, password), Website (URL, username, email, password, 2FA method), Insurance (provider, policy no, type, premium, renewal date, nominee), etc. User can create custom templates. |
| Security | Entries encrypted at rest. Session-level re-authentication to view vault (configurable timeout). Password fields masked by default. Copy-to-clipboard with auto-clear (30s). |
| Search | Search across groups and entry titles. Never search within password field values. |
| Import/Export | CSV import (to migrate from Excel). CSV/JSON export. |
| History | Field change history (who changed what, when). Critical for password rotation tracking. |

**Inspiration**: 1Password (structure), Bitwarden (self-hosted), a spreadsheet (flexibility).

### 2.5 Blog / Podcast Feed Watcher

**Core**: RSS/Atom feed aggregator with integration into Knowledge Base and Todos.

| Requirement | Details |
|---|---|
| Feed sources | RSS/Atom feeds, YouTube channel feeds, Podcast RSS feeds. Manual URL entry. OPML import for bulk. |
| Organization | Feeds grouped into folders (Tech Blogs, Podcasts, News, etc.). |
| Feed view | Unified timeline of new items across all feeds. Filter by folder or individual feed. |
| Item actions | Mark as read/unread, Star/favorite, "Save to Knowledge Base" (creates KB item with metadata pre-filled), "Create Todo" (creates task like "Read: [article title]"), Share (copy link) |
| Refresh | Background polling (configurable interval per feed, default 1 hour). Manual refresh button. |
| Read tracking | Track read/unread per item. "Mark all as read" per feed/folder. Unread count badges. |
| Retention | Auto-archive items older than N days (configurable). Keep starred items forever. |

**Inspiration**: Feedly (organization), Inoreader (actions), NetNewsWire (simplicity).

### 2.6 Document Repository

**Core**: File storage and organization with sharing.

| Requirement | Details |
|---|---|
| Structure | Folder hierarchy (nested). Root folders: Insurance, Banking, Tax, Medical, Legal, Personal, etc. |
| Upload | Drag-and-drop upload. Multi-file upload. Max file size configurable (default 50MB). |
| File types | PDF, images, spreadsheets, documents. Preview for PDF and images in-browser. |
| Metadata | Filename, description (optional), upload date, file size, mime type, tags, comments. |
| Comments | Threaded comments on any document (via common Comment service). |
| Versioning | Upload new version of a document. Keep version history. Download any version. |
| Sharing | Share a file or folder with another pOS user (family member). Permission levels: view, download, edit (re-upload). Share via link (optional, with expiry). |
| Search | Search by filename, description, tags. |
| Storage | Local filesystem initially (configurable path). S3-compatible later. |

**Inspiration**: Google Drive (folders + sharing), Dropbox (simplicity).

### 2.7 Photo Consolidation

**Core**: Unified photo library with multi-source sync.

| Requirement | Details |
|---|---|
| Sources | Apple Photos (via iCloud API or local library), Google Photos API, WhatsApp export, Manual upload |
| Sync | One-way sync: pull from sources into pOS. Configurable sync schedule. Incremental sync (only new photos). |
| Organization | Auto-organize by date (year/month). Albums (user-created). Smart albums (auto-generated by tag/date/location). |
| Deduplication | Hash-based duplicate detection on import. Side-by-side comparison for near-duplicates. Bulk action: keep best / delete duplicates. |
| Metadata | EXIF data extraction (date, location, camera). Face detection (future — AI agent). Auto-tagging (future — AI agent). |
| Browse | Grid view (thumbnails), Timeline view (by date), Album view. |
| Search | By date range, album, tags, location (if EXIF available). |
| Sharing | Share albums with other pOS users. |

**Note**: Photo consolidation is the most complex feature. Source API integrations (Google Photos, iCloud) are significant undertakings. Starting with manual upload + WhatsApp export, then adding API integrations incrementally.

### 2.8 Authentication & Multi-Tenancy

**Core**: User management, authentication, and user isolation.

| Requirement | Details |
|---|---|
| Registration | Email + password. Email verification. Invite-only option (admin generates invite link). |
| Login | Email + password. "Remember me" (long-lived refresh token). |
| MFA | TOTP-based (Google Authenticator, Authy). QR code setup flow. Recovery codes. |
| Session | JWT access tokens (short-lived, 15 min) + refresh tokens (long-lived, 7 days). Token rotation on refresh. |
| Profile | Name, email, profile picture, timezone, preferences. Password change (requires current password). |
| Multi-tenancy | User-based isolation: all entities carry a `user_id` foreign key. Every query is scoped to the authenticated user. No schema-level separation — isolation is enforced at the application layer via middleware that injects `user_id` into all queries. |
| Sharing | Cross-user access is explicit: sharing a document or album creates a permission record (resource_type, resource_id, shared_with_user_id, permission_level). |
| Roles | Owner (full access), Family (invited, access to shared items), Guest (view-only shared links). |

---

## 3. Architecture

### 3.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │  Design   │  │            App Shell                     │ │
│  │  System   │  │  (Router, Layout, Auth, Module Loader)   │ │
│  │ (Atoms)   │  ├──────────────────────────────────────────┤ │
│  │           │  │  Micro-Frontend Modules (Web Components) │ │
│  │           │  │  Todos│Notes│KB│Vault│Feeds│Docs│Photos  │ │
│  └──────────┘  └──────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS / REST + WebSocket
┌─────────────────────────┴───────────────────────────────────┐
│                      API GATEWAY                             │
│            (Routing, Auth middleware, Rate limiting)          │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┘
   │      │      │      │      │      │      │      │
┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐
│Auth ││Todo ││Note ││ KB  ││Vault││Feed ││Docs ││Photo│  Domain
│Svc  ││ Svc ││ Svc ││ Svc ││ Svc ││ Svc ││ Svc ││ Svc │  Services
└──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘└──┬──┘
   │      │      │      │      │      │      │      │
┌──┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──┐
│              Common Services                          │
│  Attachments │ Comments │ Tags │ Search │ Notifications│
│              │          │      │ Storage               │
└──────────────────────────┬────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │        Message Broker            │
          │         (RabbitMQ)               │
          └────────────────┬────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │         PostgreSQL               │
          │   (Single DB, user_id scoped)    │
          └─────────────────────────────────┘
```

### 3.2 Frontend Architecture — Atomic Design + Micro-Frontends

The frontend follows **Atomic Design** methodology, where the design system provides the foundational atoms and the application builds up through molecules, organisms, templates, and pages.

**Atomic Design Layers:**

| Layer | Scope | Examples |
|---|---|---|
| **Atoms** | Design system (`ui-*` components) | `ui-button`, `ui-input`, `ui-badge`, `ui-tag`, `ui-checkbox`, `ui-spinner`, `ui-icon`, `ui-dialog`, `ui-tooltip` |
| **Molecules** | Small functional units combining atoms | `<pos-task-item>` (checkbox + text + tag + due date), `<pos-note-card>` (title + preview + color + pin), `<pos-search-bar>` (input + icon + button) |
| **Organisms** | Complex UI sections composed of molecules | `<pos-task-list>` (header + filters + list of task-items), `<pos-note-grid>` (search + masonry grid of note-cards), `<pos-kb-queue>` (status tabs + sorted item list) |
| **Templates** | Reusable page layouts (content-agnostic) | `<pos-list-detail-layout>` (sidebar list + detail panel), `<pos-dashboard-layout>` (responsive grid of widgets), `<pos-single-column-layout>` (centered content) |
| **Pages** | Route-level entry points (content-specific) | `<pos-todos-app>`, `<pos-notes-app>`, `<pos-kb-app>`, `<pos-vault-app>` |

**Module structure (each micro-frontend):**

```
modules/todos/
├── molecules/          # pos-task-item, pos-task-form, pos-task-filters
├── organisms/          # pos-task-list, pos-task-board, pos-task-detail
├── templates/          # pos-todos-layout (if module-specific layout needed)
├── pages/              # pos-todos-app (entry point registered with router)
├── services/           # API calls for this module
└── store.js            # Module-local state
```

**Key rules:**
- Atoms live **only** in the design system. Modules never create atoms.
- Molecules and organisms are **module-scoped** by default. If two modules need the same molecule, promote it to `frontend/shared/molecules/`.
- Templates are always in `frontend/shared/templates/` — they're layout shells reused across modules.
- Pages are always module-specific — they're the micro-frontend entry points.

**App Shell responsibilities:**
- Client-side routing (History API)
- Sidebar navigation, header, content area layout
- Authentication state management
- Dynamic module loading (lazy import on route change)
- Global event bus (`CustomEvents` on a shared `EventTarget`)
- Theme management (design system theming via `data-pos-theme`)

**Shared Frontend Services** (thin JS modules):
- `api-client.js` — HTTP client with auth token injection, retry, error handling
- `auth-store.js` — Token management, login state, session refresh
- `event-bus.js` — Cross-module communication
- `router.js` — Client-side routing, lazy module loading
- `state-store.js` — Minimal reactive state primitives

### 3.3 Backend Architecture

**Python microservices with event-driven communication.**

- **Framework**: FastAPI (async, auto-generates OpenAPI docs)
- **ORM**: SQLAlchemy 2.0 (async mode) with Alembic for migrations
- **API Gateway**: Lightweight FastAPI service for routing + JWT validation + rate limiting

**Database Strategy:**
- **Single PostgreSQL instance, single schema**
- All entities carry a `user_id` foreign key
- Isolation enforced at application layer: a shared middleware/dependency injects the authenticated `user_id` into every query
- Each service still owns its own tables and Alembic migration chain
- No cross-service table joins — services communicate via REST or events

**Service Communication:**
- **Synchronous**: REST APIs between services (minimized — prefer events)
- **Asynchronous**: RabbitMQ topic exchange for event-driven patterns
- Events: `todo.created`, `note.updated`, `feed.item.new`, `kb.item.saved`, etc.
- Each service publishes domain events; interested services subscribe

**Common Services:**

| Service | Purpose | Used By |
|---|---|---|
| **Auth** | Registration, login, JWT, MFA, profile | All services (via gateway middleware) |
| **Attachment** | File upload/download/delete, storage abstraction | Todos, Notes, KB, Docs, Photos |
| **Comment** | Threaded comments on any entity (polymorphic: entity_type + entity_id) | Todos, KB, Docs |
| **Tag** | Polymorphic tagging (entity_type + entity_id → tags) | Todos, Notes, KB, Docs, Photos |
| **Search** | Full-text search index (PostgreSQL FTS via tsvector) | Notes, KB, Docs |
| **Notification** | In-app notifications, future: email/push | All services |
| **Storage** | File storage abstraction (local FS → S3-compatible) | Attachment, Docs, Photos |

### 3.4 Event-Driven Patterns

**RabbitMQ topology:**

```
Exchange: pos.events (topic exchange)
  Routing keys:
    todo.created, todo.updated, todo.completed
    note.created, note.updated
    kb.item.saved, kb.item.highlighted
    feed.item.new, feed.item.read
    doc.uploaded, doc.shared
    photo.imported, photo.deduplicated
    auth.user.registered, auth.user.login
```

**Example flows:**

1. **Feed → Knowledge Base**: User clicks "Save to KB" on a feed item → Feed service publishes `feed.item.saved_to_kb` → KB service subscribes, creates KB item with pre-filled metadata.

2. **Feed → Todo**: User clicks "Create Todo" on a feed item → Feed service publishes `feed.item.task_created` → Todo service subscribes, creates task "Read: [title]".

3. **Document shared**: User shares a document → Doc service publishes `doc.shared` → Notification service subscribes, notifies the recipient.

4. **Photo imported**: Sync job imports photos → Photo service publishes `photo.imported` → Dedup worker subscribes, checks for duplicates.

### 3.5 Security Architecture

- **Vault encryption**: AES-256-GCM encryption at field level for sensitive entries. Encryption key derived from user's master password (PBKDF2). The server never stores the master password — only a verification hash.
- **JWT**: RS256 signed tokens. Short-lived access (15 min), long-lived refresh (7 days).
- **User isolation**: All DB queries scoped by `user_id` via middleware. No query runs without user context except public endpoints (login, register).
- **API**: All endpoints require valid JWT except login/register. HTTPS only.
- **CORS**: Strict origin whitelist.
- **File uploads**: File type validation. Size limits. Virus scanning (ClamAV, optional, later).
- **Rate limiting**: Per-user, per-endpoint limits.

---

## 4. Project Structure

```
pOS-design-system/
│
├── design-system/                    # Extracted from current root (eventually its own package)
│   ├── src/
│   │   ├── components/               # Atoms: ui-* components (existing 17+)
│   │   ├── core/                     # PosBaseElement, define.js
│   │   ├── plugins/                  # Plugin runtime
│   │   └── styles/                   # Base CSS
│   ├── tokens/                       # Token system (raw + semantic)
│   ├── dist/                         # Built output
│   ├── test/                         # Component tests
│   ├── examples/                     # Showcase, demos
│   ├── esbuild.config.js
│   ├── web-test-runner.config.js
│   └── package.json
│
├── frontend/                         # Application frontend
│   ├── shell/                        # App shell
│   │   ├── index.html                # Entry point
│   │   ├── app-shell.js              # Router, layout, module loader
│   │   ├── styles/                   # Shell-level styles
│   │   └── components/               # Shell organisms: sidebar-nav, header, etc.
│   ├── shared/                       # Cross-module shared code
│   │   ├── services/                 # api-client, auth-store, event-bus, router
│   │   ├── molecules/                # Promoted shared molecules (pos-search-bar, etc.)
│   │   ├── organisms/                # Promoted shared organisms (pos-comment-thread, etc.)
│   │   └── templates/                # Reusable layouts (list-detail, dashboard, single-col)
│   ├── modules/                      # Micro-frontend modules
│   │   ├── todos/
│   │   │   ├── molecules/            # pos-task-item, pos-task-form
│   │   │   ├── organisms/            # pos-task-list, pos-task-board, pos-task-detail
│   │   │   ├── pages/               # pos-todos-app (entry)
│   │   │   ├── services/             # Todo API calls
│   │   │   └── store.js
│   │   ├── notes/                    # Same structure
│   │   ├── knowledge-base/
│   │   ├── vault/
│   │   ├── feed-watcher/
│   │   ├── documents/
│   │   ├── photos/
│   │   └── settings/                 # Profile, preferences, account
│   ├── esbuild.config.js
│   └── package.json
│
├── backend/                          # Python backend
│   ├── gateway/                      # API gateway service
│   │   ├── app/
│   │   │   ├── main.py               # FastAPI app
│   │   │   ├── middleware/            # Auth, CORS, rate limiting, user_id injection
│   │   │   └── routes.py             # Route proxying to services
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── services/                     # Domain + common services
│   │   ├── auth/
│   │   │   ├── app/
│   │   │   │   ├── main.py
│   │   │   │   ├── models.py         # SQLAlchemy models (all have user_id FK)
│   │   │   │   ├── schemas.py        # Pydantic request/response schemas
│   │   │   │   ├── routes.py         # API endpoints
│   │   │   │   ├── service.py        # Business logic
│   │   │   │   └── events.py         # RabbitMQ event publishers
│   │   │   ├── migrations/           # Alembic migrations
│   │   │   ├── tests/
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │   ├── todos/                    # Same structure as auth
│   │   ├── notes/
│   │   ├── knowledge-base/
│   │   ├── vault/
│   │   ├── feed-watcher/
│   │   ├── documents/
│   │   ├── photos/
│   │   ├── attachments/              # Common: file management
│   │   ├── comments/                 # Common: threaded comments
│   │   ├── tags/                     # Common: polymorphic tagging
│   │   ├── search/                   # Common: full-text search
│   │   └── notifications/            # Common: in-app notifications
│   ├── shared/                       # Shared Python library
│   │   ├── pos_common/
│   │   │   ├── __init__.py
│   │   │   ├── database.py           # DB session, base model (user_id mixin)
│   │   │   ├── events.py             # RabbitMQ publisher/subscriber helpers
│   │   │   ├── auth.py               # JWT validation, user_id extraction
│   │   │   ├── exceptions.py         # Common exceptions
│   │   │   ├── schemas.py            # Shared Pydantic schemas (pagination, errors)
│   │   │   └── config.py             # Environment config loader
│   │   └── pyproject.toml            # Installable as local package
│   └── docker-compose.yml            # Dev: all services + postgres + rabbitmq
│
├── infra/                            # Infrastructure & deployment
│   ├── docker/
│   │   ├── Dockerfile.frontend       # Nginx serving built frontend
│   │   └── nginx.conf
│   ├── k8s/                          # Kubernetes manifests (Phase 5)
│   └── scripts/
│       ├── setup-dev.sh              # One-command dev setup
│       └── seed-data.sh              # Dev seed data
│
├── openspec/                         # OpenSpec workflow (unchanged)
│   ├── config.yaml
│   ├── specs/
│   └── changes/
│
├── docs/                             # Project documentation
│   ├── PROJECT_REQUIREMENTS.md       # This document
│   └── ARCHITECTURE.md               # Architecture deep-dive (future)
│
├── .claude/                          # Claude config (unchanged)
├── docker-compose.yml                # Root-level: links to backend compose
├── Makefile                          # make dev, make test, make build, etc.
└── README.md
```

---

## 5. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Vanilla JS + Web Components | Project goal. No framework dependency. |
| **Design System** | pos-design-system (custom) | Already built. Provides atoms. Will evolve. |
| **Frontend Design** | Atomic Design (atoms → pages) | Scalable composition. Design system = atoms, app = molecules through pages. |
| **Frontend Build** | esbuild | Already in use. Fast, simple. |
| **Frontend Tests** | @web/test-runner + Playwright | Already in use for design system. |
| **Backend Framework** | FastAPI (Python 3.12+) | Async, auto OpenAPI docs, modern. Learning goal. |
| **ORM** | SQLAlchemy 2.0 (async) | Industry standard. Alembic for migrations. |
| **Database** | PostgreSQL 16 | Reliable. FTS, JSONB for vault flexibility. |
| **Message Broker** | RabbitMQ | Right complexity level. Good Python libs (aio-pika). Concepts transfer to AWS SQS/SNS. |
| **File Storage** | Local FS → MinIO (S3-compatible) | Start simple. MinIO for S3 compat without AWS cost. |
| **Containerization** | Docker + Docker Compose | Local dev. Foundation for K8s. |
| **Orchestration** | Kubernetes (EKS) | Learning goal. Later phase. |
| **Cloud** | AWS | Learning goal. EKS, RDS, S3. |
| **Rich Text** | Tiptap Core (MIT, open source) | Headless = works with Web Components. Only core/free extensions used. No paid Tiptap Cloud/Pro needed. |
| **Feed Parsing** | feedparser (Python) | Battle-tested RSS/Atom parser. |
| **Feed Scheduling** | APScheduler | Lightweight, in-process. Stores job state in PostgreSQL. Right scale for personal use (50-100 feeds). |
| **Monorepo Tooling** | Makefile | Language-agnostic (Python + JS), zero deps, transparent. Turborepo/Nx are JS-only and don't understand Python. |

---

## 6. Key Architectural Decisions

### 6.1 Monorepo

Single repo, restructured. Solo developer — polyrepo overhead not justified. Allows atomic changes across frontend + backend + design system. Can extract design system later.

### 6.2 Single DB, User-Scoped Isolation

One PostgreSQL instance, one schema. All entities carry `user_id` as foreign key. Isolation enforced at application layer — a shared middleware injects `user_id` into every query context. Simpler than schema-per-service, practical for personal project scale. Cross-user access (sharing) is explicit via permission records.

### 6.3 Atomic Design for Frontend Composition

Design system provides **atoms** (basic UI building blocks). The application frontend builds **molecules** (combining atoms into functional units), **organisms** (complex sections), **templates** (reusable layouts), and **pages** (route-level entries). This creates a clear dependency direction: pages → templates → organisms → molecules → atoms. Components at each level only depend on components from lower levels.

### 6.4 API Gateway: Custom FastAPI

A thin Python gateway handles routing + auth + rate limiting. Keeps things simple and educational. In K8s, an ingress controller (Traefik) can eventually replace or sit in front of it.

### 6.5 RabbitMQ for Events

Sweet spot between simplicity and capability. Redis Pub/Sub has no persistence. Kafka is overkill. PostgreSQL LISTEN/NOTIFY is too limited. RabbitMQ: mature, persistent, topic routing, good async Python support.

### 6.6 Rich Text: Tiptap Core (MIT, Free)

Only runtime frontend dependency. Tiptap Core and all basic extensions (bold, italic, lists, links, code blocks, headings) are MIT-licensed and free. The paid Tiptap Cloud/Pro features (collaboration, AI, comments-in-editor) are not needed. Headless architecture means no framework coupling — renders into Shadow DOM. TinyMCE was considered but has a more restrictive license model (GPL or paid for MIT).

### 6.7 Vault: Application-Level Encryption

AES-256-GCM at field level. Key derived from user's **master password** (separate from login password — industry standard, like 1Password). User logs in normally, then must enter the master password once per vault session (configurable timeout, default 15 min). Server never stores the master password — only a verification hash. Trade-off: can't search encrypted fields, acceptable for vault data.

### 6.8 Feed Scheduling: APScheduler

Lightweight, runs in-process inside the FastAPI feed-watcher service. Stores job state in PostgreSQL (which we already have). Perfect for personal scale (~50-100 feeds). Celery is industrial-grade (designed for millions of tasks across worker pools) and requires separate worker processes — overkill here. If we ever need distributed task processing (e.g., bulk photo processing), Celery can be added then.

### 6.9 Monorepo Tooling: Makefile

Simple, language-agnostic, zero dependencies (`make` is pre-installed on macOS/Linux). Our project mixes Python + JavaScript + Docker — Turborepo/Nx are JavaScript-ecosystem tools that don't understand Python services, Alembic migrations, or Docker Compose. A Makefile's transparency (each target is just shell commands) is a feature, not a limitation, for a multi-language project of this scale.

---

## 7. Execution Plan

### Phase 0: Project Restructure
**Goal**: Reorganize monorepo, set up dev infrastructure.

| # | Task |
|---|---|
| 0.1 | Move design system files into `design-system/` subdirectory. Update imports, configs, scripts. Verify all 101 tests still pass. |
| 0.2 | Create `frontend/`, `backend/`, `infra/`, `docs/` directory structure. |
| 0.3 | Set up `docker-compose.yml` with PostgreSQL 16 + RabbitMQ containers. |
| 0.4 | Create Python shared library (`backend/shared/pos_common/`): DB session factory with `user_id` mixin, config loader, event helpers. |
| 0.5 | Scaffold API gateway (`backend/gateway/`): FastAPI app with auth middleware stub, route proxying. |
| 0.6 | Scaffold frontend app shell (`frontend/shell/`): HTML entry, basic router, sidebar nav, module loader, design system integration. |
| 0.7 | Create `Makefile` with `dev`, `test`, `build`, `db-migrate` targets. |
| 0.8 | Create `setup-dev.sh` script for one-command environment setup. |

---

### Phase 1: Auth + Todos (First Vertical Slice)
**Goal**: End-to-end working feature. Login → create todos → persist. Proves the entire stack.

| # | Task |
|---|---|
| 1.1 | **Auth service**: Registration, login (JWT RS256), password hashing (bcrypt), profile CRUD. SQLAlchemy models with Alembic migration. REST API. |
| 1.2 | **Auth frontend**: Login page, registration page, `auth-store.js` (token management, auto-refresh). |
| 1.3 | **API gateway wiring**: JWT validation middleware, route proxying to auth + todo services, CORS, `user_id` injection into request context. |
| 1.4 | **Todo service**: Lists CRUD, Tasks CRUD (with priority, status, due date, important/urgent flags, subtasks). Alembic migrations. REST API. Domain events on RabbitMQ. |
| 1.5 | **Todo frontend module**: Atomic design — `pos-task-item` (molecule), `pos-task-list` / `pos-task-board` (organisms), `pos-todos-app` (page). List management, task CRUD UI, drag-and-drop reorder. |
| 1.6 | **Tag service** (common): Polymorphic tagging (entity_type + entity_id + user_id → tags). REST API. Wire into todos. |
| 1.7 | **Comment service** (common): Threaded comments (entity_type + entity_id + user_id). REST API. Wire into todos. |
| 1.8 | **Attachment service** (common): File upload to local FS, download, delete. Metadata in DB. REST API. Wire into todos. |
| 1.9 | **End-to-end integration**: Login → create list → add task → tag it → comment → attach file → mark done. |
| 1.10 | **Tests**: pytest for each backend service. @web/test-runner for todo frontend module. |

**Why Todos first**: Exercises every layer (auth, CRUD, 3 common services, events, full UI) while being well-understood functionally.

---

### Phase 2: Notes + Knowledge Base
**Goal**: Rich content features. Introduces the rich text editor.

| # | Task |
|---|---|
| 2.1 | **Rich text editor atom**: `<pos-editor>` Web Component wrapping Tiptap. Markdown shortcuts, formatting toolbar. Add to design system. |
| 2.2 | **Notes service + frontend**: CRUD, folders, pinning, colors, search (PostgreSQL FTS). Atomic design: `pos-note-card` (molecule), `pos-note-grid` (organism), `pos-notes-app` (page). |
| 2.3 | **KB service + frontend**: Item types, queue system (inbox → to-read → done), categories, collections, highlights/annotations, commentary. Full atomic hierarchy. |
| 2.4 | **Search service** (common): PostgreSQL tsvector-based FTS. Indexing for notes + KB. REST API. |
| 2.5 | **KB ↔ Todo integration**: "Create Todo from KB item" via RabbitMQ event. |
| 2.6 | **Tests**: Backend + frontend for notes and KB. |

---

### Phase 3: Vault + Feed Watcher
**Goal**: Secure storage and external content ingestion.

| # | Task |
|---|---|
| 3.1 | **Vault service**: Encrypted key-value store (AES-256-GCM, field-level). Groups, entries, dynamic fields. Templates. CSV import/export. Field change history. |
| 3.2 | **Vault frontend**: Master password flow, masked fields, reveal-on-click, copy-to-clipboard with auto-clear. Group/entry management UI. |
| 3.3 | **MFA**: Add TOTP to auth service. QR code setup, recovery codes. Frontend MFA enrollment + login flow. |
| 3.4 | **Feed watcher service**: Feed parsing (feedparser), background polling (APScheduler), OPML import. Read/unread tracking. Auto-archive old items. |
| 3.5 | **Feed watcher frontend**: Feed management, unified timeline, folder-based filtering, actions (save to KB, create todo). |
| 3.6 | **Feed ↔ KB integration**: Event-driven: save feed item to KB with metadata pre-filled. |
| 3.7 | **Feed ↔ Todo integration**: Event-driven: create task from feed item. |
| 3.8 | **Tests**: Backend + frontend. Security audit for vault encryption. |

---

### Phase 4: Documents + Photos
**Goal**: File management and photo consolidation.

| # | Task |
|---|---|
| 4.1 | **Storage service upgrade**: Abstract to support local FS and MinIO (S3-compatible). |
| 4.2 | **Document service + frontend**: Nested folders, upload (drag-drop), versioning, PDF/image preview, sharing (cross-user permissions). |
| 4.3 | **Sharing system**: Permission model (resource_type, resource_id, shared_with_user_id, level). UI for share management. |
| 4.4 | **Photo service + frontend**: Upload, auto-organize by date, albums, EXIF extraction, tagging. |
| 4.5 | **Photo dedup**: Hash-based dedup on import. Near-duplicate detection and comparison UI. |
| 4.6 | **Photo sync**: Start with manual upload + WhatsApp export import. Google Photos API integration (OAuth). iCloud deferred. |
| 4.7 | **Tests**: Backend + frontend. File handling edge cases. |

---

### Phase 5: Containerization + Deployment
**Goal**: Production-ready deployment on AWS.

| # | Task |
|---|---|
| 5.1 | Dockerize all services (multi-stage builds). |
| 5.2 | Docker Compose production profile (full stack). |
| 5.3 | Kubernetes manifests (deployments, services, configmaps, secrets). |
| 5.4 | AWS setup: EKS cluster, RDS (PostgreSQL), S3, ECR. |
| 5.5 | CI/CD: GitHub Actions → test → build → push → deploy. |
| 5.6 | Monitoring: health checks, logging (CloudWatch), alerting. |

---

### Phase 6: AI Agents
**Goal**: AI-powered automation on top of the platform.

| # | Task |
|---|---|
| 6.1 | Agent framework using Claude API. Event-driven triggers from RabbitMQ. |
| 6.2 | Feed summarizer: auto-summarize new items, suggest category/priority. |
| 6.3 | KB auto-tagger: categorize and tag items based on content analysis. |
| 6.4 | Photo organizer: auto-tag (scene, objects), face grouping. |
| 6.5 | Smart notifications: personalized nudges ("5 unread KB items this week"). |
| 6.6 | Search assistant: natural language search across all modules. |

---

### Future (Phase 7+)
- Stock watchlist and portfolio management
- Finance: bank statement sync, expense tagging, net worth dashboard
- Recurring todos with scheduling
- Calendar integration
- Mobile responsive / PWA
- Offline support

---

## 8. Design System Evolution

The existing 17 atoms will grow as the app demands. Anticipated new components:

**Navigation**: `ui-sidebar`, `ui-tabs`, `ui-breadcrumb`, `ui-dropdown-menu`, `ui-pagination`
**Data display**: `ui-avatar`, `ui-data-table`, `ui-skeleton`, `ui-empty-state`
**Feedback**: `ui-toast`
**Input**: `ui-file-upload`, `ui-search-input`, `ui-chip`, `ui-date-picker`, `ui-color-picker`
**Layout**: `ui-grid`, `ui-stack`, `ui-split-view`
**Rich content**: `ui-editor` (Tiptap wrapper)

Added incrementally as features need them — never upfront.

---

## 9. Development Workflow

1. **OpenSpec** for feature planning (proposal → design → specs → tasks → apply)
2. **Backend-first**: define API contracts (OpenAPI) → implement service → write tests
3. **Frontend second**: build module consuming the API → atomic design bottom-up → write tests
4. **Design system**: add new atoms as the frontend work reveals the need
5. **Docker**: each new service gets a Dockerfile immediately
6. **Git**: feature branches, PRs, conventional commits

---

## 10. Local Development (Target Experience)

```bash
# One-time setup
make setup          # Python venv, Node deps, Docker images, DB init

# Daily development
make dev            # Starts: PostgreSQL, RabbitMQ, all backend services,
                    # frontend dev server, design system watcher
                    # Hot-reload everywhere

# Targeted work
make dev-backend    # Just backend services + deps
make dev-frontend   # Just frontend dev server
make dev-ds         # Just design system with showcase

# Testing
make test           # All tests
make test-backend   # Python tests (pytest)
make test-frontend  # Frontend tests (@web/test-runner)
make test-ds        # Design system tests

# Database
make db-migrate     # Run pending Alembic migrations for all services
make db-seed        # Seed development data
make db-reset       # Drop and recreate (careful!)

# Build
make build          # Production build: frontend + design system
```

---

## 11. Resolved Decisions

| Question | Decision | Rationale |
|---|---|---|
| Rich text editor | **Tiptap Core (MIT, free)** | Open source, headless, works with Web Components. Only core extensions needed. Non-technical family users need WYSIWYG, not Markdown-only. |
| Photo sync | **Manual upload first** | API integrations (Google Photos, iCloud) are complex and require OAuth app review. Start simple, add sync in a later dedicated phase. |
| Vault master password | **Separate from login password** | Industry standard (1Password model). More secure — compromised login doesn't expose vault. Session-based unlock with configurable timeout. |
| Feed polling | **APScheduler** | Lightweight, in-process, stores state in PostgreSQL. Right scale for ~50-100 feeds. Celery is overkill. |
| Monorepo tooling | **Makefile** | Language-agnostic, zero deps, transparent. Turborepo/Nx don't understand Python projects. |
