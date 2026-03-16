## Why

Users currently store sensitive account credentials (bank details, demat accounts, SaaS logins) in insecure formats like Excel sheets. pOS needs a dedicated, encrypted vault to manage these credentials with a flexible schema — accounts have no standard fields beyond basics like username/password, so a rigid schema won't work.

## What Changes

- New **Vault service** (`:8006`) — backend microservice for encrypted credential storage
- **Vault Items** — named entities representing one account/service (e.g., "Kotak Bank"), each containing user-defined key-value fields
- **Flexible fields** — users define their own field names and values per item; sensitive values encrypted at rest using Fernet symmetric encryption with a per-user derived key
- **Tagging** via shared `tag_service` from `pos_contracts` — categorize vault items (e.g., "banks", "demat", "saas")
- **Frontend vault module** — replacing the placeholder skeleton with a full UI: item list, item detail/editor, tag sidebar, field management
- **Gateway proxy** for `/api/vault/*` routes
- **Infrastructure** updates: dev-start.sh, Makefile, migrations

## Capabilities

### New Capabilities

- `vault-storage`: Core vault item CRUD, flexible key-value fields with encryption at rest, field types (text, secret, url, email, phone, notes), copy-to-clipboard for sensitive values
- `vault-organization`: Tag-based categorization via shared tag_service, search/filter by name or tag, favorites/pinning, list and card view modes
- `vault-frontend`: Frontend module with item list, item detail editor, inline field add/edit/delete, tag management, responsive two-panel layout

### Modified Capabilities

_(none — no existing spec-level requirements change)_

## Impact

- **New service**: `backend/services/vault/` with models, routes, service layer, events, migrations
- **Gateway**: add vault proxy route (`/api/vault/*`)
- **Infrastructure**: `dev-start.sh` starts vault on `:8006`, `Makefile` passes vault log level
- **Frontend**: `frontend/modules/vault/` — new API service, store, components, pages replacing skeleton
- **Shared**: uses existing `pos_contracts.tag_service` (entity_type `"vault_item"`)
- **Security**: Fernet encryption for secret field values; encryption key derived from app secret + user_id
