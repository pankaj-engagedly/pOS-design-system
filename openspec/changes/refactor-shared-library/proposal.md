## Why

`pos_common` currently bundles contracts (types, schemas, base models) together with infrastructure (database connections, RabbitMQ publishing, JWT auth). This creates a distributed monolith — services can't be deployed, scaled, or evolved independently because they all depend on the same runtime library. Additionally, all primary keys use UUIDv4 which causes B-tree index fragmentation at scale. This refactoring separates what things look like (contracts) from how things work (infrastructure), following the proven pattern: **share contracts, not infrastructure**.

## What Changes

- **Split `pos_common` into `pos-contracts` (shared) + per-service infrastructure**
  - `pos-contracts`: Only types, schemas, base models, exception hierarchy, event envelope — zero runtime dependencies on SQLAlchemy engines, aio-pika connections, or FastAPI
  - Each service gets its own `db.py` (engine init, session factory, close) and `publisher.py` (event bus connection and publishing)

- **Create `pos-events` package with pluggable transport**
  - `BaseEvent` dataclass envelope (event_id, event_name, source_service, created_at, payload)
  - `Transport` ABC with `RabbitMqTransport` default implementation
  - `EventBus` singleton — services call `event_bus.publish(event)`, never touch transport directly
  - Concrete event classes (e.g., `NoteCreated`, `TaskCompleted`) defined in each service, not in the shared package

- **Move auth to where it belongs**
  - Token validation (`validate_token`) → gateway code (edge authentication)
  - Token creation (`create_access_token`, `create_refresh_token`) → auth service code
  - Remove `pos_common.auth` module entirely — no service behind the gateway should touch JWT

- **Migrate UUIDv4 → UUIDv7 for all primary keys** **BREAKING** (data migration required)
  - UUIDv4 is fully random → random B-tree page splits, cache-hostile, write amplification
  - UUIDv7 has a millisecond timestamp prefix → time-ordered, sequential inserts, same index performance as bigint auto-increment while keeping UUID benefits (distributed generation, non-guessable, merge-friendly)

- **Per-service database lifecycle**
  - Each service owns its engine initialization, session factory, and connection pooling
  - Allows independent scaling (different pool sizes) and future database separation

## Capabilities

### New Capabilities
- `pos-contracts`: Shared contracts package — base models (UserScopedBase, Base), exception hierarchy, shared Pydantic schemas (HealthResponse, PaginatedResponse, ErrorResponse), and configuration base class. No runtime infrastructure.
- `pos-events`: Event system package — BaseEvent envelope, Transport ABC, RabbitMqTransport, EventBus singleton. Pluggable transport enables migration between backends (e.g., Redis → RabbitMQ → Kafka) by changing one class.
- `per-service-infrastructure`: Pattern for each service owning its database lifecycle (db.py) and event publishing (concrete events + EventBus usage). Template/skeleton for new services.

### Modified Capabilities
- `backend-foundation`: Requirements change — pos_common is replaced by pos-contracts + pos-events. Auth utilities removed from shared library. Database session management moves per-service. Gateway owns token validation directly.

## Impact

- **Backend services (auth, todos, notes, gateway)**: All imports from `pos_common` must be updated. Each service gets new local `db.py` and event files.
- **Shared library**: `backend/shared/pos_common/` replaced by `backend/shared/pos_contracts/` and `backend/shared/pos_events/`
- **Dependencies**: Add `uuid-utils` package for UUIDv7 generation
- **Database**: New Alembic migration to set UUIDv7 as default for new rows. Existing UUIDv4 rows remain valid (UUID column type unchanged).
- **Setup scripts**: `setup-dev.sh` updated to install new packages instead of pos_common
- **No API changes**: External REST API responses unchanged — UUIDs are still UUIDs to the client
- **No frontend changes**: Frontend doesn't import from or depend on backend shared code
