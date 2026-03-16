## Context

pOS users need to store sensitive account credentials securely. Currently there's no vault service — just a frontend skeleton. The backend has an established pattern: FastAPI + async SQLAlchemy + Alembic per service, gateway proxy, shared pos_contracts for tags. Ports 8001–8005 are taken; vault gets :8006.

The key challenge is a flexible schema — accounts have no standard fields. A bank account has different fields than a SaaS login. The solution is a key-value field model where users define both field names and values.

## Goals / Non-Goals

**Goals:**
- Secure storage of account credentials with encryption at rest for sensitive fields
- Flexible key-value field system — users define their own fields per vault item
- Tag-based organization using shared tag_service (entity_type: `"vault_item"`)
- Full CRUD for vault items and their fields
- Frontend with two-panel layout: sidebar (tags/filters) + item list/detail

**Non-Goals:**
- End-to-end encryption (browser ↔ server) — server-side Fernet encryption is sufficient for v1
- Shared vaults / sharing vault items with other users
- Password generation or strength analysis
- Import/export from password managers
- Browser extension or autofill

## Decisions

### 1. Data Model: VaultItem + VaultField (one-to-many)

**Choice**: Two tables — `vault_items` (the named entity) and `vault_fields` (key-value pairs belonging to an item). Each field has a `field_type` enum: `text`, `secret`, `url`, `email`, `phone`, `notes`.

**Alternatives considered**:
- JSONB column for fields: simpler but loses queryability, harder to encrypt individual values, no field-level metadata
- EAV with shared field definitions: over-engineered for a personal tool

**Rationale**: Relational model is straightforward, enables per-field encryption, and lets us order fields with a `position` column.

### 2. Encryption: Fernet with app-secret-derived key

**Choice**: Use Python `cryptography.fernet.Fernet` for encrypting `secret`-type field values. Encryption key derived from `APP_SECRET_KEY` (env var) using HKDF with the user_id as salt. Only fields with `field_type = "secret"` are encrypted. Encrypted values stored as base64 strings in the same `value` column.

**Alternatives considered**:
- Per-user master password: better security but requires password on every session — too heavy for v1
- pgcrypto (database-level): ties encryption to PostgreSQL, harder to migrate
- Encrypt all fields: unnecessary overhead for non-sensitive data like "bank branch name"

**Rationale**: Fernet is authenticated encryption (AES-128-CBC + HMAC). Deriving per-user keys from app secret means compromising the database alone doesn't expose secrets. Simple, battle-tested, no extra dependencies beyond `cryptography` (already in the venv).

### 3. API Design: Nested fields in item responses

**Choice**: Item CRUD endpoints return fields inline. Fields can be added/updated/removed via dedicated sub-resource endpoints (`/items/{id}/fields`). Secret fields return `"********"` in list responses and require explicit `GET /items/{id}/fields/{field_id}/reveal` to decrypt.

**Rationale**: Keeps list views fast (no decryption), prevents accidental exposure in logs/network tools, gives frontend explicit control over when secrets are visible.

### 4. Frontend: Two-panel layout with inline editing

**Choice**: Left panel = tag sidebar + item list. Right panel = item detail with inline field editing. No separate "edit mode" — fields are directly editable in the detail view. Add field via a simple form row at the bottom.

**Rationale**: Matches the vault use case — users access and update individual fields frequently (e.g., copying a password). Inline editing reduces friction.

### 5. Tags: Shared tag_service with entity_type "vault_item"

**Choice**: Use `pos_contracts.tag_service` with `entity_type="vault_item"`, same as notes uses `"note"` and documents use `"document"`.

**Rationale**: Consistent cross-service pattern, no new tag infrastructure needed.

## Risks / Trade-offs

- **[App secret rotation breaks encryption]** → Document that APP_SECRET_KEY must not change once vault data exists. Future: add key versioning header to encrypted values.
- **[No master password]** → Anyone with a valid JWT can read vault data. Acceptable for v1 (single-user self-hosted). Future: add vault unlock with separate PIN/password.
- **[Field ordering lost on concurrent edits]** → Position column may conflict if two tabs reorder fields simultaneously. Acceptable for single-user app.
- **[No audit log]** → No tracking of who accessed which secret when. Future: add access logging for sensitive fields.
