## ADDED Requirements

### Requirement: Vault item CRUD
The system SHALL provide full CRUD operations for vault items. Each vault item has a `name` (required, max 200 chars), optional `description`, optional `icon` (emoji or short string), and an `is_favorite` boolean (default false). Items are scoped to the authenticated user.

#### Scenario: Create vault item
- **WHEN** user sends POST `/api/vault/items` with `{"name": "Kotak Bank", "description": "Savings account", "icon": "🏦"}`
- **THEN** system creates a new vault item and returns it with id, timestamps, and empty fields list

#### Scenario: List vault items
- **WHEN** user sends GET `/api/vault/items`
- **THEN** system returns all vault items for the user, ordered by `is_favorite` desc then `updated_at` desc, each including field count and tag names (but not field values)

#### Scenario: Get vault item detail
- **WHEN** user sends GET `/api/vault/items/{id}`
- **THEN** system returns the vault item with all its fields (secret fields masked as `"********"`) and tags

#### Scenario: Update vault item
- **WHEN** user sends PATCH `/api/vault/items/{id}` with `{"name": "Kotak Mahindra Bank"}`
- **THEN** system updates the specified fields and returns the updated item

#### Scenario: Delete vault item
- **WHEN** user sends DELETE `/api/vault/items/{id}`
- **THEN** system deletes the item, all its fields, and all tag associations

#### Scenario: Toggle favorite
- **WHEN** user sends PATCH `/api/vault/items/{id}` with `{"is_favorite": true}`
- **THEN** system marks the item as favorite, and it appears first in list queries

### Requirement: Flexible key-value fields
The system SHALL allow users to add, update, reorder, and remove fields on a vault item. Each field has: `field_name` (required, max 100 chars), `field_value` (required, text), `field_type` (enum: `text`, `secret`, `url`, `email`, `phone`, `notes`; default `text`), and `position` (integer for ordering).

#### Scenario: Add field to vault item
- **WHEN** user sends POST `/api/vault/items/{id}/fields` with `{"field_name": "Account Number", "field_value": "1234567890", "field_type": "text"}`
- **THEN** system creates the field with position set to max existing position + 1

#### Scenario: Add secret field
- **WHEN** user sends POST `/api/vault/items/{id}/fields` with `{"field_name": "Net Banking Password", "field_value": "s3cret!", "field_type": "secret"}`
- **THEN** system encrypts the value before storing and returns the field with value masked as `"********"`

#### Scenario: Update field
- **WHEN** user sends PATCH `/api/vault/items/{id}/fields/{field_id}` with `{"field_value": "new-password"}`
- **THEN** system updates the field (encrypting if field_type is secret) and returns the updated field

#### Scenario: Delete field
- **WHEN** user sends DELETE `/api/vault/items/{id}/fields/{field_id}`
- **THEN** system removes the field from the item

#### Scenario: Reorder fields
- **WHEN** user sends PATCH `/api/vault/items/{id}/fields/reorder` with `{"ordered_ids": ["field-uuid-3", "field-uuid-1", "field-uuid-2"]}`
- **THEN** system updates position values to match the new order

### Requirement: Secret field reveal
The system SHALL require an explicit request to decrypt and return a secret field's plaintext value. List and detail endpoints always mask secret values.

#### Scenario: Reveal secret field
- **WHEN** user sends GET `/api/vault/items/{id}/fields/{field_id}/reveal`
- **THEN** system decrypts and returns the plaintext value of the secret field

#### Scenario: Reveal non-secret field
- **WHEN** user sends GET `/api/vault/items/{id}/fields/{field_id}/reveal` for a `text`-type field
- **THEN** system returns the plain value (no decryption needed)

### Requirement: Encryption at rest for secret fields
The system SHALL encrypt vault field values of type `secret` using Fernet symmetric encryption. The encryption key SHALL be derived from the application's `APP_SECRET_KEY` environment variable using HKDF with the user_id as salt. Only `secret`-type fields are encrypted; other field types are stored as plaintext.

#### Scenario: Secret value stored encrypted
- **WHEN** a field with `field_type: "secret"` is created or updated
- **THEN** the `field_value` column in the database contains a Fernet-encrypted token, not the plaintext

#### Scenario: Decryption with correct key
- **WHEN** a reveal request is made for a secret field
- **THEN** the system derives the user's encryption key and decrypts the stored value to return plaintext
