## 1. Vault service scaffold

- [x] 1.1 Create `backend/services/vault/` directory structure: `app/__init__.py`, `app/main.py`, `app/db.py`, `app/models.py`, `app/schemas.py`, `app/routes.py`, `app/service.py`, `app/events.py`, `app/encryption.py`
- [x] 1.2 Create `app/main.py` — FastAPI app with VaultConfig(BaseServiceConfig), SERVICE_NAME="pos-vault", UserIdMiddleware, setup_logging, lifespan with db init/close + event_bus init/close, health check, APP_SECRET_KEY config field
- [x] 1.3 Create `app/db.py` — per-service database lifecycle (init_db, get_session, close_db) following existing pattern
- [x] 1.4 Create `requirements.txt` with dependencies (fastapi, uvicorn, sqlalchemy, asyncpg, pos-contracts, pos-events, loguru, cryptography)
- [x] 1.5 Set up Alembic: `alembic.ini`, `migrations/env.py` with `alembic_version_vault` version table, OWNED_TABLES = {"vault_items", "vault_fields"}

## 2. Encryption module

- [x] 2.1 Create `app/encryption.py` — Fernet encryption helpers: `derive_key(app_secret, user_id)` using HKDF with user_id as salt, `encrypt_value(plaintext, key)`, `decrypt_value(ciphertext, key)`
- [x] 2.2 Add `get_encryption_key(app_secret, user_id)` convenience function that returns a Fernet instance ready for encrypt/decrypt

## 3. Database models

- [x] 3.1 Create `app/models.py` — VaultItem model (UserScopedBase): name (String 200, required), description (Text, nullable), icon (String 10, nullable), is_favorite (Boolean, default False)
- [x] 3.2 Add VaultField model (UserScopedBase): vault_item_id (FK to vault_items, CASCADE), field_name (String 100, required), field_value (Text, required), field_type (String 20, default "text"), position (Integer, default 0). Relationship back to VaultItem.

## 4. Alembic migration

- [x] 4.1 Create migration `001_create_vault_tables.py` — creates `vault_items` and `vault_fields` tables with proper indexes and foreign keys

## 5. Pydantic schemas

- [x] 5.1 Create `app/schemas.py` — VaultItemCreate (name, description?, icon?), VaultItemUpdate (all optional + is_favorite), VaultItemResponse (all fields + field_count + tags list), VaultItemDetailResponse (includes fields list with masked secrets)
- [x] 5.2 Add field schemas: VaultFieldCreate (field_name, field_value, field_type?), VaultFieldUpdate (field_name?, field_value?, field_type?), VaultFieldResponse (all fields, value masked if secret), VaultFieldRevealResponse (plaintext value)
- [x] 5.3 Add TagCreate, TagResponse, ReorderRequest schemas

## 6. Service layer — vault items

- [x] 6.1 Create `app/service.py` — `create_item(session, user_id, data)`: create VaultItem, return with empty fields
- [x] 6.2 `get_items(session, user_id, tag?, search?, favorites?)`: list items ordered by is_favorite desc + updated_at desc, include field_count and tag names, support tag filter via tag_service.get_entities_by_tag, support search via ilike on name
- [x] 6.3 `get_item(session, user_id, item_id)`: get item with all fields (mask secrets) and tags
- [x] 6.4 `update_item(session, user_id, item_id, data)`: partial update
- [x] 6.5 `delete_item(session, user_id, item_id)`: delete item + cascade fields + remove tag associations

## 7. Service layer — vault fields

- [x] 7.1 `add_field(session, user_id, item_id, data, app_secret)`: create field, encrypt value if field_type is "secret", set position to max+1
- [x] 7.2 `update_field(session, user_id, item_id, field_id, data, app_secret)`: update field, re-encrypt if value changed and type is secret
- [x] 7.3 `delete_field(session, user_id, item_id, field_id)`: remove field
- [x] 7.4 `reorder_fields(session, user_id, item_id, ordered_ids)`: update position values
- [x] 7.5 `reveal_field(session, user_id, item_id, field_id, app_secret)`: decrypt and return plaintext for secret fields, return plain value for non-secret

## 8. Service layer — tags

- [x] 8.1 `add_tag(session, user_id, item_id, tag_name)`: use tag_service.add_tag with entity_type "vault_item"
- [x] 8.2 `remove_tag(session, user_id, item_id, tag_id)`: use tag_service.remove_tag
- [x] 8.3 `get_tags(session, user_id)`: use tag_service.get_all_tags, filter to vault_item counts

## 9. Domain events

- [x] 9.1 Create `app/events.py` — VaultEvent(DomainEvent) with source_service="vault". Events: ItemCreated, ItemUpdated, ItemDeleted, FieldAdded, FieldUpdated, FieldDeleted. Publish helpers.

## 10. API routes

- [x] 10.1 Create `app/routes.py` — Item CRUD: GET /items, POST /items, GET /items/{id}, PATCH /items/{id}, DELETE /items/{id}
- [x] 10.2 Field routes: POST /items/{id}/fields, PATCH /items/{id}/fields/{field_id}, DELETE /items/{id}/fields/{field_id}, PATCH /items/{id}/fields/reorder
- [x] 10.3 Reveal route: GET /items/{id}/fields/{field_id}/reveal
- [x] 10.4 Tag routes: GET /tags, POST /items/{id}/tags, DELETE /items/{id}/tags/{tag_id}

## 11. Infrastructure — gateway and dev scripts

- [x] 11.1 Add vault proxy route to gateway: `/api/vault/{path:path}` → VAULT_SERVICE_URL (http://localhost:8006)
- [x] 11.2 Add VAULT_SERVICE_URL config to GatewayConfig and wire in lifespan
- [x] 11.3 Update `infra/scripts/dev-start.sh`: start vault service on :8006, add wait_for_port, add VAULT_LOG variable
- [x] 11.4 Update `Makefile`: add `vault ?= $(LOG_LEVEL)` and pass to dev-start.sh

## 12. Frontend — API service

- [x] 12.1 Create `frontend/modules/vault/services/vault-api.js` — full API client: getItems(params), getItem(id), createItem(data), updateItem(id, data), deleteItem(id), addField(itemId, data), updateField(itemId, fieldId, data), deleteField(itemId, fieldId), reorderFields(itemId, orderedIds), revealField(itemId, fieldId), getTags(), addTag(itemId, name), removeTag(itemId, tagId)

## 13. Frontend — store

- [x] 13.1 Update `frontend/modules/vault/store.js` — createStore with: items[], selectedItemId, selectedItem (detail), tags[], activeTag, searchQuery, loading, error

## 14. Frontend — components

- [x] 14.1 Create `pos-vault-sidebar.js` — tag list sidebar: "All Items" link, "Favorites" filter, tag list with counts, each tag clickable to filter
- [x] 14.2 Create `pos-vault-item-list.js` — scrollable item list: search input, "+" create button, item rows showing icon + name + tag badges + field count, active item highlighted
- [x] 14.3 Create `pos-vault-item-detail.js` — item detail panel: editable name/description/icon, tag management (add/remove), field list with inline editing, "Add Field" form, delete item button
- [x] 14.4 Create `pos-vault-field-row.js` — single field row component: field name (editable), value display (masked for secrets), type indicator, reveal/copy/edit/delete buttons

## 15. Frontend — pages and routing

- [x] 15.1 Rewrite `frontend/modules/vault/pages/pos-vault-app.js` — main page composing sidebar + item list + detail panel in a three-column layout, wires events between components and store
- [x] 15.2 Register vault route in router.js (already exists as `/vault` — verify it works with new page)

## 16. Verification

- [x] 16.1 Start full stack with `make dev` — verify vault service starts on :8006, health check passes
- [x] 16.2 Test backend API: create vault item, add fields (text + secret), reveal secret, add tags, search, filter by tag, delete
- [x] 16.3 Test frontend: navigate to vault, create item, add fields, reveal/copy secret, tag items, search, delete
