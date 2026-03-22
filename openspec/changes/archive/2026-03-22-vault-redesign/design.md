# Vault Redesign — Design

## Data Model

### Entity Relationship

```
VaultCategory (1) ──── (*) VaultFieldTemplate
      │                         │
      │                         │ (linked via template_id, nullable)
      │                         ▼
      └──── (*) VaultItem ──── (*) VaultFieldValue
```

### Tables

#### `vault_categories`
| Column     | Type         | Notes                          |
|------------|--------------|--------------------------------|
| id         | UUID PK      |                                |
| user_id    | UUID         | Indexed                        |
| name       | VARCHAR(100) | Required                       |
| icon       | VARCHAR(10)  | Emoji icon                     |
| position   | INTEGER      | Sidebar ordering               |
| created_at | TIMESTAMP    | Auto                           |
| updated_at | TIMESTAMP    | Auto                           |

- UNIQUE(user_id, name)

#### `vault_field_templates`
| Column      | Type         | Notes                          |
|-------------|--------------|--------------------------------|
| id          | UUID PK      |                                |
| user_id     | UUID         | Indexed                        |
| category_id | UUID FK      | → vault_categories (CASCADE)   |
| field_name  | VARCHAR(100) | Required                       |
| field_type  | VARCHAR(20)  | text/secret/url/email/phone/notes |
| section     | VARCHAR(50)  | Grouping label, default "General" |
| position    | INTEGER      | Ordering within section        |
| created_at  | TIMESTAMP    | Auto                           |

- INDEX(category_id)

#### `vault_items`
| Column      | Type         | Notes                          |
|-------------|--------------|--------------------------------|
| id          | UUID PK      |                                |
| user_id     | UUID         | Indexed                        |
| category_id | UUID FK      | → vault_categories (CASCADE)   |
| name        | VARCHAR(200) | Required (e.g., "HDFC", "SBI") |
| icon        | VARCHAR(10)  | Emoji icon                     |
| is_favorite | BOOLEAN      | Default false                  |
| created_at  | TIMESTAMP    | Auto                           |
| updated_at  | TIMESTAMP    | Auto                           |

- INDEX(user_id, category_id)

#### `vault_field_values`
| Column      | Type         | Notes                                    |
|-------------|--------------|------------------------------------------|
| id          | UUID PK      |                                          |
| user_id     | UUID         | Indexed                                  |
| item_id     | UUID FK      | → vault_items (CASCADE)                  |
| template_id | UUID FK      | → vault_field_templates (SET NULL), nullable |
| field_name  | VARCHAR(100) | Only for standalone (template_id = NULL) |
| field_type  | VARCHAR(20)  | Only for standalone (template_id = NULL) |
| section     | VARCHAR(50)  | Only for standalone (template_id = NULL) |
| field_value | TEXT         | Encrypted if type = secret               |
| position    | INTEGER      | Ordering (after template fields)         |
| created_at  | TIMESTAMP    | Auto                                     |
| updated_at  | TIMESTAMP    | Auto                                     |

- INDEX(item_id)
- When template_id is set: name, type, section are read from the template
- When template_id is NULL: name, type, section are stored on the value itself

### Template Linking Behavior

| Action                        | Effect                                                |
|-------------------------------|-------------------------------------------------------|
| Rename template field         | All items see the new name (read from template)       |
| Change template field type    | All items see the new type                            |
| Change template field section | All items see the new section grouping                |
| Add new template field        | Appears as empty in all existing items (no row needed)|
| Delete template field         | Values with that template_id get template_id set NULL, becoming standalone (ON DELETE SET NULL) |
| Reorder template fields       | All items reflect new ordering                        |

### Resolving Item Fields for Display

When rendering an item's detail view:

```
1. Fetch all FieldTemplates for the item's category, ordered by section → position
2. Fetch all FieldValues for this item
3. Build display list:
   a. For each template: show the linked value if exists, else show empty
   b. Append any standalone values (template_id = NULL) grouped into their own sections
4. Group everything by section string
```

---

## API Endpoints

### Categories (`/api/vault/categories`)

| Method | Endpoint                         | Purpose                    |
|--------|----------------------------------|----------------------------|
| GET    | /categories                      | List all with item counts  |
| POST   | /categories                      | Create category            |
| PATCH  | /categories/{id}                 | Update name/icon           |
| DELETE | /categories/{id}                 | Delete (cascade items)     |
| PATCH  | /categories/reorder              | Reorder sidebar position   |

### Field Templates (`/api/vault/categories/{id}/templates`)

| Method | Endpoint                                    | Purpose              |
|--------|---------------------------------------------|----------------------|
| GET    | /categories/{id}/templates                  | List all for category|
| POST   | /categories/{id}/templates                  | Add template field   |
| PATCH  | /categories/{id}/templates/{tid}            | Update name/type/section |
| DELETE | /categories/{id}/templates/{tid}            | Delete (SET NULL on values) |
| PATCH  | /categories/{id}/templates/reorder          | Reorder positions    |

### Items (`/api/vault/items`)

| Method | Endpoint                           | Purpose                         |
|--------|------------------------------------|---------------------------------|
| GET    | /items                             | List with filters: category_id, search, is_favorite |
| POST   | /items                             | Create (requires category_id)   |
| GET    | /items/{id}                        | Full detail: resolved fields (templates + values merged) |
| PATCH  | /items/{id}                        | Update name/icon/is_favorite/category_id |
| DELETE | /items/{id}                        | Delete item + values            |

### Field Values (`/api/vault/items/{id}/fields`)

| Method | Endpoint                                  | Purpose                    |
|--------|-------------------------------------------|----------------------------|
| POST   | /items/{id}/fields                        | Add value (template_id or standalone) |
| PATCH  | /items/{id}/fields/{fid}                  | Update value               |
| DELETE | /items/{id}/fields/{fid}                  | Delete value               |
| GET    | /items/{id}/fields/{fid}/reveal           | Decrypt secret value       |

### Tags (unchanged pattern)

| Method | Endpoint                           | Purpose              |
|--------|------------------------------------|-----------------------|
| GET    | /tags                              | List all with counts  |
| POST   | /items/{id}/tags                   | Add tag               |
| DELETE | /items/{id}/tags/{tag_id}          | Remove tag            |

### Item Detail Response Shape

The GET /items/{id} endpoint returns a **resolved** view:

```json
{
  "id": "...",
  "name": "HDFC",
  "icon": "🏦",
  "is_favorite": true,
  "category_id": "...",
  "category_name": "Banks",
  "tags": [{ "id": "...", "name": "important" }],
  "sections": [
    {
      "name": "General",
      "fields": [
        { "id": "val-1", "template_id": "tpl-1", "field_name": "CRN", "field_type": "text", "field_value": "9876543", "has_value": true },
        { "id": null, "template_id": "tpl-2", "field_name": "IFSC", "field_type": "text", "field_value": null, "has_value": false },
        { "id": "val-3", "template_id": "tpl-3", "field_name": "Email", "field_type": "email", "field_value": "p@hdfc.com", "has_value": true }
      ]
    },
    {
      "name": "Credentials",
      "fields": [
        { "id": "val-4", "template_id": "tpl-4", "field_name": "User ID", "field_type": "secret", "field_value": "••••••••", "has_value": true },
        { "id": "val-5", "template_id": "tpl-5", "field_name": "Password", "field_type": "secret", "field_value": "••••••••", "has_value": true }
      ]
    },
    {
      "name": "Other",
      "fields": [
        { "id": "val-6", "template_id": null, "field_name": "RM Phone", "field_type": "phone", "field_value": "+91 98765...", "has_value": true }
      ]
    }
  ]
}
```

This gives the frontend everything it needs in one call — no client-side template merging.

---

## Frontend Architecture

### Layout: 2-Panel (Sidebar + Content Area)

Uses `pos-module-layout` like other modules.

```
┌──────────────┬──────────────────────────────────────────────────┐
│  VAULT       │  Content area changes based on sidebar selection │
│              │                                                  │
│  ▸ All Items │  A) Category selected → item cards + template    │
│  ▸ Favourites│  B) Item selected → sectioned field detail       │
│  ───────────│  C) All Items → all items across categories      │
│  CATEGORIES  │                                                  │
│  ▸ Banks  (3)│                                                  │
│  ▸ Demats (2)│                                                  │
│  ▸ Office (4)│                                                  │
│  + Category  │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

### Component Tree

```
pages/
  pos-vault-app.js              # Orchestrator: pos-module-layout, data loading, event routing

components/
  # Sidebar
  pos-vault-sidebar.js          # pos-sidebar + SIDEBAR_NAV_SHEET
                                #   Smart views: All Items, Favourites
                                #   Categories list with counts + hover actions (rename, delete)
                                #   "+ Category" footer button

  # Content views
  pos-vault-category-view.js    # When a category is selected:
                                #   Header: category name + [+ Item] button + [⚙ Template] button
                                #   Item cards grid
                                #   When no items: empty state with "Create your first item"

  pos-vault-all-items-view.js   # When "All Items" selected:
                                #   Search bar
                                #   Item cards from all categories, each showing category badge
                                #   Grouped by category or flat list (simple flat for v1)

  pos-vault-item-card.js        # Card in grid: icon, name, field count, favourite star
                                #   Hover actions: favourite, delete

  pos-vault-item-detail.js      # Flyout panel (380px slide-in, like KB/Todos):
                                #   Header: icon + name (editable) + favourite toggle + close
                                #   Sections with fields (template fields + standalone)
                                #   Each field: name, value (masked if secret), copy/reveal actions
                                #   Empty template fields shown with placeholder
                                #   [+ Add Field] for extra standalone fields
                                #   Tags row (KB-style search/suggest)
                                #   Delete item button

  pos-vault-field-row.js        # Individual field in detail:
                                #   View mode: type icon, name, value, actions (copy, reveal, edit, delete)
                                #   Edit mode: value input + save/cancel
                                #   Standalone fields also show editable name

  pos-vault-template-editor.js  # Modal/panel for managing category field templates:
                                #   Section groups with field rows
                                #   Each row: name input, type select, section input
                                #   Drag to reorder (or up/down buttons for v1)
                                #   [+ Add Field] per section or at bottom
                                #   Delete field (with warning if values exist)

services/
  vault-api.js                  # Updated API client for new endpoints

store.js                        # categories, selectedCategoryId, items, selectedItemId,
                                #   selectedItem (resolved detail), templates, searchQuery,
                                #   selectedView ('all'|'favourites'|null), loading
```

### UI Flow: Creating a New Category + Items

```
1. User clicks "+ Category" in sidebar footer
   → Inline input appears (like notes folder creation)
   → Types "Banks", presses Enter
   → Category created, selected in sidebar

2. Content area shows empty "Banks" category view
   → "No items yet. Add items or set up field templates first."
   → [⚙ Set Up Fields] button prominent

3. User clicks [⚙ Set Up Fields]
   → Template editor panel opens
   → User adds fields:
     - "Account Number" (text, General)
     - "IFSC" (text, General)
     - "User ID" (secret, Credentials)
     - "Password" (secret, Credentials)
     - "Email" (email, General)
   → Saves, closes editor

4. User clicks [+ Item]
   → New item created, detail flyout opens
   → All template fields visible, grouped by section:
     ── General ──
     Account Number: (empty)
     IFSC: (empty)
     Email: (empty)
     ── Credentials ──
     User ID: (empty)
     Password: (empty)
   → User fills in name "HDFC" and field values
   → Each field saves on blur/enter

5. User creates "SBI" item
   → Same template fields appear, ready to fill
   → No re-creation of field structure needed
```

### UI Flow: Editing a Template After Items Exist

```
1. User opens template editor for "Banks"
   → Sees existing fields

2. Adds new field "Mobile Banking App" (text, General)
   → Saved to templates
   → Next time any Banks item is viewed, "Mobile Banking App"
     appears as an empty field under General

3. Renames "Account Number" to "A/C Number"
   → Template updated
   → All items now show "A/C Number" (name comes from template)

4. Deletes "Email" template
   → Warning: "3 items have values for this field. Values will
     become standalone fields."
   → On confirm: template deleted, existing values get
     template_id set to NULL, keep their data as standalone
```

---

## Backend Structure

No new files beyond the existing service structure. Updated files:

```
backend/services/vault/
  migrations/versions/
    002_vault_redesign.py         # Drop old tables, create new schema
  app/
    models.py                     # VaultCategory, VaultFieldTemplate, VaultItem, VaultFieldValue
    schemas.py                    # New request/response models
    routes.py                     # New endpoints (categories, templates, items, fields)
    service.py                    # Updated business logic
    events.py                     # Updated domain events
    encryption.py                 # Unchanged
    db.py                         # Unchanged
    main.py                       # Unchanged (maybe add template routes)
```

---

## Migration Strategy

Migration 002: Drop and recreate.

```python
def upgrade():
    # Drop old tables
    op.drop_table('vault_fields')
    op.drop_table('vault_items')
    # Also clean up any tag associations for vault_item entity_type

    # Create new tables
    # vault_categories
    # vault_field_templates
    # vault_items (new schema with category_id)
    # vault_field_values (with template_id FK)

def downgrade():
    # Reverse — drop new, recreate old
```

---

## Build Order

### Phase A: Backend — Models + Migration + Categories/Templates API
- Migration 002
- New models: VaultCategory, VaultFieldTemplate, VaultItem, VaultFieldValue
- Schemas for categories and templates
- Routes + service: category CRUD, template CRUD
- **Verify**: curl category and template endpoints

### Phase B: Backend — Items + Field Values API
- Schemas for items and field values
- Service: item CRUD with resolved field detail (template merge logic)
- Routes: items, field values, reveal
- Updated events
- Tags integration (unchanged pattern)
- **Verify**: curl full item lifecycle — create, add values, reveal, get resolved detail

### Phase C: Frontend — Sidebar + Category View
- Updated store with new state shape
- Updated vault-api.js
- Redesigned pos-vault-sidebar.js (pos-sidebar pattern, categories with counts)
- pos-vault-category-view.js (item cards grid)
- pos-vault-item-card.js
- pos-vault-all-items-view.js
- Wire up pos-vault-app.js

### Phase D: Frontend — Item Detail + Field Rows
- pos-vault-item-detail.js (flyout, sectioned fields, resolved view)
- pos-vault-field-row.js (view/edit modes, reveal/copy)
- Tag search/suggest (KB pattern)
- Extra standalone field creation

### Phase E: Frontend — Template Editor
- pos-vault-template-editor.js (modal/panel)
- Add/edit/delete/reorder template fields
- Section input (free text, grouped by string)
- Wire into category view header

### Phase F: Polish
- Favourites smart view
- Search across all items
- Category delete confirmation
- Template delete warning when values exist
- Sidebar counts
- Empty states

---

## Key Reference Files

| Pattern                    | File                                                    |
|----------------------------|---------------------------------------------------------|
| Sidebar composition        | `frontend/modules/notes/components/pos-folder-sidebar.js` |
| Flyout detail panel        | `frontend/modules/knowledge-base/components/pos-kb-item-detail.js` |
| Tag search/suggest         | `frontend/modules/knowledge-base/components/pos-kb-item-detail.js` |
| Item cards                 | `frontend/modules/knowledge-base/components/pos-kb-item-card.js` |
| Module layout              | `frontend/shared/components/pos-module-layout.js`       |
| Encryption (keep as-is)    | `backend/services/vault/app/encryption.py`              |
| Service pattern            | `backend/services/vault/app/service.py`                 |
| Tag integration            | `backend/shared/pos_contracts/pos_contracts/tag_service.py` |
