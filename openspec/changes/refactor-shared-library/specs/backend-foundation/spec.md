## MODIFIED Requirements

### Requirement: Shared Python library (pos_common)

The monolithic `pos_common` package SHALL be replaced by two focused packages: `pos_contracts` (`backend/shared/pos_contracts/`) for shared types and schemas, and `pos_events` (`backend/shared/pos_events/`) for the event bus system. The `backend/shared/pos_common/` directory SHALL be removed after migration. Both new packages SHALL be installable as local packages via `pip install -e`.

#### Scenario: Old package is removed
- **WHEN** the migration is complete
- **THEN** `backend/shared/pos_common/` no longer exists
- **AND** no service imports from `pos_common`

#### Scenario: New packages are importable
- **WHEN** a developer runs `pip install -e backend/shared/pos_contracts` and `pip install -e backend/shared/pos_events`
- **THEN** `from pos_contracts import ...` and `from pos_events import ...` succeed
- **AND** `from pos_common import ...` raises ImportError

### Requirement: Database module with user-scoped base model

The database base models (`Base`, `UserScopedBase`) SHALL move to `pos_contracts.models`. The database session management (`init_db`, `get_async_session`, `close_db`) SHALL move to each service's own `app/db.py`. `UserScopedBase` SHALL use UUIDv7 (via `uuid_utils.uuid7`) instead of UUIDv4 for the `id` primary key default.

#### Scenario: Model inheriting UserScopedBase has user_id column
- **WHEN** a service defines a model extending `UserScopedBase`
- **THEN** the model table has columns: `id` (UUID with UUIDv7 default, primary key), `user_id` (UUID, non-nullable, indexed), `created_at` (timestamp with timezone), `updated_at` (timestamp with timezone)

#### Scenario: Session factory is per-service
- **WHEN** the notes service needs a database session
- **THEN** it uses `get_session()` from its own `app/db.py`
- **AND** NOT from any shared package

### Requirement: JWT authentication utilities

The `pos_common.auth` module SHALL be removed entirely. Token validation SHALL live in the gateway (`gateway/app/auth.py`). Token creation SHALL live in the auth service (`services/auth/app/tokens.py`). No shared auth module SHALL exist.

#### Scenario: Valid token validated by gateway
- **WHEN** the gateway's `auth.py` calls `validate_token(token)` with a valid JWT
- **THEN** it returns the `user_id` from the `sub` claim

#### Scenario: Expired token rejected by gateway
- **WHEN** the gateway's `auth.py` calls `validate_token(token)` with an expired JWT
- **THEN** it raises an `AuthenticationError`

#### Scenario: No shared auth module exists
- **WHEN** a developer checks `pos_contracts` and `pos_events` packages
- **THEN** neither contains JWT creation or validation code

### Requirement: RabbitMQ event helpers

The `pos_common.events` module SHALL be replaced by the `pos_events` package with a pluggable `Transport` architecture. The `EventBus` singleton SHALL replace the bare `publish_event()` and `subscribe()` functions. The `pos.events` topic exchange and best-effort publishing behavior SHALL be preserved.

#### Scenario: Publish an event using EventBus
- **WHEN** a service calls `await event_bus.publish(NoteCreated(note_id="123", title="Test", folder_id=None))`
- **THEN** a message is published to the `pos.events` topic exchange with routing key `"note.created"`
- **AND** the message body contains the full event envelope (event_id, event_name, source_service, created_at, payload)

#### Scenario: Subscribe to events using EventBus
- **WHEN** a service calls `await event_bus.subscribe("note.*", handler)`
- **THEN** the handler is invoked for any message matching the `"note.*"` routing pattern

## REMOVED Requirements

### Requirement: Configuration module using Pydantic Settings
**Reason**: Moved to `pos_contracts.config` — same class, new package location.
**Migration**: Change `from pos_common.config import BaseServiceConfig` to `from pos_contracts.config import BaseServiceConfig`.

### Requirement: Service skeleton pattern
**Reason**: The skeleton will be updated to reflect the new package structure, but this is a documentation/template concern, not a spec-level requirement. Each service already follows the pattern.
**Migration**: Existing services serve as the template. New services copy the pattern from any existing service.
