# Vault Redesign — Tasks

## Phase A: Backend — Models + Migration + Categories/Templates API

- [x] A1. Write migration 002: drop `vault_fields` and `vault_items`, clean up tag associations for entity_type="vault_item", create `vault_categories`, `vault_field_templates`, `vault_items` (new), `vault_field_values`
- [x] A2. Update `models.py`: VaultCategory, VaultFieldTemplate, VaultItem, VaultFieldValue with relationships
- [x] A3. Update `schemas.py`: Category and FieldTemplate request/response models
- [x] A4. Update `service.py`: Category CRUD (create, list with item counts, update, delete, reorder) + FieldTemplate CRUD (create, list for category, update, delete with SET NULL, reorder)
- [x] A5. Update `routes.py`: Category endpoints (`/categories`, `/categories/{id}`, `/categories/reorder`) + Template endpoints (`/categories/{id}/templates`, etc.)
- [x] A6. Verify: run migration, curl all category + template endpoints

## Phase B: Backend — Items + Field Values API

- [x] B1. Add item + field value schemas: ItemCreate (requires category_id), ItemResponse (summary with field_count), ItemDetailResponse (resolved sections with merged template+values), FieldValueCreate, FieldValueResponse
- [x] B2. Service: item CRUD — create, list (filters: category_id, search, is_favorite), get detail (resolve fields: merge templates with values, group by section), update, delete
- [x] B3. Service: field value operations — add (linked to template or standalone), update value, delete, reveal (decrypt)
- [x] B4. Routes: item endpoints + field value endpoints + reveal endpoint
- [x] B5. Update `events.py`: domain events for new entities (CategoryCreated, ItemCreated, etc.)
- [x] B6. Tags: wire up tag_service for vault_item entity_type (same pattern, reuse existing)
- [x] B7. Verify: curl full lifecycle — create category → add templates → create item → add values → get resolved detail → reveal secret

## Phase C: Frontend — Sidebar + Category Views

- [x] C1. Update `store.js`: new state shape (categories, selectedCategoryId, selectedView, items, selectedItemId, selectedItem, templates, searchQuery, loading)
- [x] C2. Update `vault-api.js`: new endpoints (categories, templates, items with new shapes, field values)
- [x] C3. Rewrite `pos-vault-sidebar.js`: pos-sidebar + SIDEBAR_NAV_SHEET pattern, smart views (All Items, Favourites), categories with counts + hover actions (rename, delete), "+ Category" footer
- [x] C4. Create `pos-vault-category-view.js`: header (category name + [+ Item] + [Template] button), item cards grid, empty state
- [x] C5. Create `pos-vault-item-card.js`: icon, name, field count, favourite star, hover actions
- [x] C6. Create `pos-vault-all-items-view.js`: search bar, flat list of all items with category badge
- [x] C7. Rewrite `pos-vault-app.js`: pos-module-layout, event routing, data loading, view switching (category view vs all-items view)

## Phase D: Frontend — Item Detail + Field Rows

- [x] D1. Rewrite `pos-vault-item-detail.js`: 380px flyout panel, header (icon + editable name + favourite + close), sectioned field groups from resolved API response, [+ Add Field] for extras, tags with KB-style search/suggest, delete button
- [x] D2. Rewrite `pos-vault-field-row.js`: view mode (type icon, name, value/masked, copy/reveal actions), edit mode (value input + save/cancel), standalone fields show editable name
- [x] D3. Wire flyout into app: item-select opens flyout, field-add/update/delete/reveal events, tag events
- [x] D4. Standalone field creation: "Add Field" form in flyout for extra fields (name, type, section, value)

## Phase E: Frontend — Template Editor

- [x] E1. Create `pos-vault-template-editor.js`: modal or slide-in panel for managing category field templates
- [x] E2. Template field rows: name input, type select dropdown, section input (free text), delete button
- [x] E3. Add new template field (with section defaulting to last used or "General")
- [x] E4. Reorder template fields (up/down buttons within section)
- [x] E5. Delete template field — warning when existing values reference it
- [x] E6. Wire into category view header button

## Phase F: Polish

- [x] F1. Favourites smart view: filter items across all categories by is_favorite
- [x] F2. Search: filter across all items by name
- [x] F3. Category delete: confirmation dialog, warn about items being deleted
- [x] F4. Sidebar counts: item count per category, total for All Items, count for Favourites
- [x] F5. Empty states: no categories yet, no items in category, no fields defined
- [x] F6. Icons: ensure vault-relevant icons exist (shield, key, lock, copy, eye, eye-off)
