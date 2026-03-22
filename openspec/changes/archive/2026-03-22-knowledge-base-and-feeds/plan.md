# Phase 4: Knowledge Base + Feed Watcher (Simplified)

## Context

Personal content curation system — save articles/videos/podcasts from the web, manage a reading queue, and subscribe to RSS/YouTube feeds. Think Pocket + RSS reader in one. This is Phase 4 of the pOS build.

## Simplification (v2)

Compared to the original design:
- **Removed categories** — use shared tags instead (items can have multiple tags)
- **Simplified status** — just `to_read` and `read` (not 5-status workflow)
- **Page-based UI** — GetPocket-style home dashboard with sections, not sidebar-based navigation
- **Kept collections** — items can belong to multiple collections

---

## Architecture

**One service** (`kb` at port `:8007`) handles both KB items and Feed subscriptions.
- Gateway proxies: `/api/kb/*` and `/api/feeds/*` → `:8007`
- Tags via shared `pos_contracts.tag_service` with `entity_type="kb_item"`

---

## Data Model

### kb_items
- id, user_id, title, url, source, author
- item_type: `article | video | podcast | excerpt | document`
- status: `to_read | read`
- content (JSONB), preview_text, thumbnail_url, site_name
- rating (1-5), is_favourite, reading_time_min, word_count
- published_at, feed_item_id
- search_vector (TSVECTOR, GIN indexed)

### kb_highlights, kb_collections, kb_collection_items
- Same as original design

### Feed tables (feed_folders, feed_sources, feed_items)
- Same as original design

---

## Frontend Layout

### Home Dashboard (default page)
- Header: "Knowledge Base" + [My Feeds] + [+ Save URL]
- Navigation pills: All Items, To Read, Read, Favourites
- Sections: Recently Added, To Read, Recently Read (with "View All" links)
- Collections grid with "+ New Collection" card

### List Pages (all, to-read, read, favourites, collection)
- Back button + title + Save URL button
- Tag filter chips + search bar
- Item card grid

### Item Card (GetPocket-style)
- Title, source domain link, status badge (colored), tag chips, star icon
- Optional note excerpt block

### Feed Timeline (accessible from home)
- Back button, source filter chips, unread toggle
- Feed item cards with quick actions

---

## Build Status

- [x] Backend service (models, schemas, service, routes, migrations, metadata, feeds, scheduler)
- [x] Frontend (home dashboard, list pages, item cards, detail flyout, feed timeline, dialogs)
- [x] Gateway proxy routes
- [x] dev-start.sh integration
