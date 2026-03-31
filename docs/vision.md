# pOS — Product Vision

> A personal operating system that consolidates your digital life into one secure hub, with AI agents that scan, filter, and surface what matters.

## The Problem

Modern knowledge workers drown in fragmented information:

- **Email** — newsletters pile up unread, action items get buried
- **Calendar** — meetings with no prep, follow-ups forgotten
- **Chat** — decisions made in threads that nobody can find later
- **Task tools** — scattered across JIRA, personal todo apps, sticky notes
- **Documents** — spread across Google Drive, Confluence, local folders
- **Finances** — portfolio across brokers, bank statements in email, no unified view
- **Learning** — articles bookmarked and never read, AI chat insights lost

The information exists. The problem is that it's scattered across dozens of tools with no single place to collect, prioritize, and act on it.

## The Solution

**pOS** is a personal operating system built around two core ideas:

1. **One place for everything** — todos, notes, documents, bookmarks, photos, vault (passwords/secrets), watchlist, portfolio, expense tracking. All searchable, all tagged, all in one UI.

2. **AI agents as your staff** — autonomous agents scan your external systems (email, calendar, chat, JIRA, news), filter out noise, and feed structured, actionable information into pOS. You consume digests and act — the agents do the legwork.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     You (consume + act)                   │
│                                                           │
│   Morning Brief    pOS Web/PWA    Chrome Extension        │
│   (WhatsApp/Email)                                        │
└───────────┬───────────────┬───────────────┬───────────────┘
            │               │               │
            ▼               ▼               ▼
┌─────────────────────────────────────────────────────────┐
│                          pOS                              │
│                  (source of truth)                         │
│                                                           │
│   Todos · Notes · KB · Documents · Photos · Vault         │
│   Watchlist · Portfolio · Expenses                         │
│                                                           │
│   REST APIs · JWT Auth · Encrypted Storage                │
└───────────┬───────────────────────────────┬───────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────┐     ┌─────────────────────────────┐
│    AI Agents         │     │    Data Sources              │
│                      │     │                              │
│  Morning Brief Agent │────▶│  Gmail / Outlook             │
│  EOD Summary Agent   │     │  Google Calendar             │
│  Finance Agent       │     │  Google Chat / Slack         │
│  Music Agent         │     │  JIRA / Confluence           │
│  Learning Agent      │     │  YouTube / RSS               │
│                      │     │  Financial news              │
└──────────────────────┘     └─────────────────────────────┘
```

**pOS is the centre.** Agents write to it. You read from it. Extensions push to it. The API connects everything.

## Agent Workflows

### 1. Morning Brief

**Schedule**: Daily, early morning
**Delivery**: WhatsApp message + email

The morning brief agent scans overnight activity and produces a prioritized digest:

**Sources scanned**:
- Email (office + personal) — new messages, flagged items
- Calendar — today's meetings with context
- Google Chat — unread threads, @mentions
- JIRA — assigned tickets, status changes, blockers
- Confluence — documents shared with you, pages to review
- pOS Todos — items due today, overdue items

**Output**:
- Tasks to complete today (ranked by priority)
- Meetings with prep notes (linked docs, attendee context)
- Documents awaiting review
- Follow-ups needed with specific people
- Curated reading list from newsletters (deduplicated, only novel content)

**Your actions**:
- Read articles inline, or save to pOS KB as "To Read"
- Add action items as pOS todos with one tap
- Dismiss items that don't need attention

### 2. End of Day Summary

**Schedule**: Daily, late evening
**Delivery**: WhatsApp message + email

The EOD agent reflects on the day and helps you close loops:

**Output**:
- Summary of what was accomplished (commits, tickets closed, emails sent)
- Prompt to mark completed todos as done in pOS
- New todos captured from the day's activity
- Learnings or notes worth recording for future reference

### 3. Finance Watch

**Schedule**: Periodic (market hours + daily digest)

The finance agent monitors your watchlist and portfolio:

**Sources**: Financial news, price feeds, analyst reports
**Cross-references**: Investment plans and target prices stored in pOS watchlist

**Output**:
- Price trigger alerts (stock hits your buy/sell target)
- Relevant news about companies you're tracking
- Portfolio rebalancing suggestions based on your investment plans

**Philosophy**: Long-term portfolio building, not day trading. The agent watches so you don't have to.

### 4. Music Discovery

**Schedule**: Weekly

**Source**: YouTube play history
**Output**: List of tracks played during the week, grouped by mood/genre
**Your action**: Add to pOS KB collections (which serve as playlists)

Over time, this builds a curated music library from your actual listening habits.

### 5. Learning Capture

**Challenge**: Insights from AI chats (Claude, ChatGPT, Gemini) are ephemeral — valuable conversations disappear into chat history.

**Approach** (TBD): Capture key insights and save to pOS Notes with source attribution. May involve browser extension hooks, API integrations, or periodic export processing.

## What pOS Provides Today

| Module | Purpose | Status |
|---|---|---|
| **Auth** | JWT authentication, multi-user | Complete |
| **Todos** | Tasks, subtasks, smart views, lists | Complete |
| **Notes** | Rich text (Tiptap), folders, tags, search | Complete |
| **Documents** | File storage, folders, preview, comments | Complete |
| **Knowledge Base** | Bookmarks, articles, media, RSS feeds, collections | Complete |
| **Photos** | Upload, albums, people tagging, EXIF, timeline | Complete |
| **Vault** | Encrypted secrets, categories, field templates | Complete |
| **Watchlist** | Multi-asset tracker, market data, financials, kanban | Complete |
| **Portfolio** | Mutual fund + stock holdings, XIRR, investment plans | Complete |
| **Expense Tracker** | Bank statement import, auto-categorization, dashboard | Complete |

## What Needs to Be Built

### For Agent Integration
- **API keys / service tokens** — agents need machine-to-machine auth (not JWT sessions)
- **Webhook endpoints** — agents push data into pOS via structured API calls
- **Bulk create APIs** — morning brief may create 10+ todos at once

### For Daily Use
- **PWA / Mobile** — act on morning briefs from your phone
- **Chrome extension v2** — save to notes, add todos (currently KB-only)
- **Notifications** — push notifications for agent alerts

### For Security
- **Audit logging** — track every API call, especially from agents
- **API rate limiting** — protect against runaway agents
- **mTLS for agent communication** — encrypted, authenticated agent-to-pOS channel
- **Data classification** — tag sensitive data, restrict agent access accordingly

### For Scale
- **Domain + HTTPS** — Caddy auto-TLS, ready to configure
- **Backups** — automated daily PostgreSQL dumps
- **Kubernetes** — learning goal, not urgent (Docker Compose handles current needs)

## Current Infrastructure

- **Production**: DigitalOcean Singapore, 16 Docker containers
- **CI/CD**: GitHub Actions — test, build 13 images, push to ghcr.io
- **Stack**: Python 3.12, FastAPI, PostgreSQL 17, RabbitMQ, vanilla JS Web Components
- **External**: OpenClaw agent on GCP (email + calendar scanning, morning briefs)

## Design Principles

1. **pOS is the source of truth** — everything flows into pOS, decisions are made from pOS
2. **Agents scan, you decide** — agents surface information, never take irreversible action
3. **One piece at a time** — ship working software incrementally, polish continuously
4. **Security is non-negotiable** — encrypted vault, JWT auth, no shortcuts on sensitive data
5. **Build to learn** — microservices, Docker, K8s, AI agents — the project is the curriculum

---

*Last updated: 2026-03-28*
