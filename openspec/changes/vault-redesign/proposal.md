# Vault Redesign: Category-Based Structured Data with Field Templates

## Problem

The current vault is a flat list of items, each with manually-created ad-hoc fields. When storing multiple accounts of the same type (e.g., HDFC, SBI, ICICI under "Banks"), users must re-create identical field structures every time. There's no concept of categories, no field templates, and no field grouping.

The sidebar also doesn't follow the established module patterns (pos-sidebar + SIDEBAR_NAV_SHEET).

## Vision

Transform the vault into a **structured data manager** — think Excel workbook where:
- **Categories** = sheets (Banks, Demats, Hosting, Office, Personal, Investment)
- **Field templates** = column definitions per category, grouped into sections
- **Items** = rows that link to templates (not copy them)

Users define a category's field structure once. Every item in that category inherits that structure. Extra one-off fields are still supported.

## Key Design Decisions

1. **Linked, not copied**: Item field values reference templates by ID. Rename a template field → updates everywhere. Add a template field → appears in all items instantly.

2. **Sections are just strings**: No separate section entity. Each field template has a `section` string (e.g., "General", "Credentials", "Address"). The UI groups by this string. New sections emerge organically.

3. **Templates are a starting point, not a mandate**: When viewing an item, all template fields appear (filled or empty). Users fill what they have, leave the rest blank. Extra standalone fields beyond the template are supported.

4. **Clean slate migration**: Drop existing vault data (test data only), rebuild tables from scratch.

## Scope

- Backend: New migration (drop + recreate), new models, updated service/routes/schemas
- Frontend: Redesigned sidebar (pos-sidebar pattern), category management, template editor, item cards, item detail with sectioned fields
- No changes to: encryption system, gateway routing, tag integration pattern
