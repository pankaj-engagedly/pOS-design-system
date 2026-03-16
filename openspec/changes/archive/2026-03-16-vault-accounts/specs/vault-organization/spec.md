## ADDED Requirements

### Requirement: Tag vault items
The system SHALL allow users to tag vault items using the shared tag_service with entity_type `"vault_item"`. Users can add and remove tags from items, list all tags with vault item counts, and filter items by tag.

#### Scenario: Add tag to vault item
- **WHEN** user sends POST `/api/vault/items/{id}/tags` with `{"name": "banks"}`
- **THEN** system creates or reuses the tag and associates it with the vault item

#### Scenario: Remove tag from vault item
- **WHEN** user sends DELETE `/api/vault/items/{id}/tags/{tag_id}`
- **THEN** system removes the tag association (does not delete the tag itself)

#### Scenario: List all vault tags
- **WHEN** user sends GET `/api/vault/tags`
- **THEN** system returns all tags that have at least one vault_item association, with counts

#### Scenario: Filter items by tag
- **WHEN** user sends GET `/api/vault/items?tag=banks`
- **THEN** system returns only vault items tagged with "banks"

### Requirement: Search vault items
The system SHALL allow users to search vault items by name. Search is case-insensitive substring match.

#### Scenario: Search by name
- **WHEN** user sends GET `/api/vault/items?search=kotak`
- **THEN** system returns vault items whose name contains "kotak" (case-insensitive)

#### Scenario: Combined search and tag filter
- **WHEN** user sends GET `/api/vault/items?search=kotak&tag=banks`
- **THEN** system returns items matching both the name search and the tag filter

### Requirement: Favorites
The system SHALL support marking vault items as favorites. Favorited items appear first in list queries.

#### Scenario: List with favorites first
- **WHEN** user has 3 items: A (not favorite), B (favorite), C (not favorite)
- **THEN** GET `/api/vault/items` returns B first, then A and C by recency

#### Scenario: Filter favorites only
- **WHEN** user sends GET `/api/vault/items?favorites=true`
- **THEN** system returns only vault items where `is_favorite` is true
