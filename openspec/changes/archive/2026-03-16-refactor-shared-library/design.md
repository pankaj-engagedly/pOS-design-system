## Context

`pos_common` is a single shared Python package (`backend/shared/pos_common/`) installed in editable mode into a shared venv. It provides 6 modules: database, auth, events, config, schemas, exceptions. All four backend apps (gateway, auth, todos, notes) import from it.

The problem: contracts (types, schemas, base models) and infrastructure (database engines, RabbitMQ connections, JWT validation) are bundled together. This creates coupling that prevents independent service deployment and evolution. Additionally, UUIDv4 primary keys cause B-tree index fragmentation.

Current dependency graph:
```
pos_common
├── database.py    → SQLAlchemy engine + session factory + Base + UserScopedBase
├── auth.py        → JWT create/validate (used by gateway + auth service ONLY)
├── events.py      → aio-pika connect + publish + subscribe
├── config.py      → Pydantic BaseSettings
├── schemas.py     → HealthResponse, PaginatedResponse, ErrorResponse
└── exceptions.py  → PosError hierarchy
```

## Goals / Non-Goals

**Goals:**
- Separate contracts (what things look like) from infrastructure (how things work)
- Each service owns its database lifecycle and event publishing
- Auth validation lives in the gateway, token creation lives in auth service
- Event system uses a pluggable transport pattern (proven in production Ruby stack)
- Migrate to UUIDv7 for time-ordered, index-friendly primary keys
- Preserve all existing functionality — this is a refactoring, not a feature change

**Non-Goals:**
- Splitting into separate databases per service (future Phase 5+)
- Moving to gRPC or protobuf (future consideration)
- Changing the REST API contracts — external behavior is unchanged
- Implementing new event subscribers or handlers
- Publishing packages to a registry — still local editable installs for now

## Decisions

### Decision 1: Two shared packages instead of one

**Choice**: Replace `pos_common` with `pos_contracts` + `pos_events`

**`pos_contracts`** — Pure types, zero runtime infrastructure:
```
backend/shared/pos_contracts/
├── __init__.py
├── models.py       # Base, UserScopedBase (column patterns only)
├── config.py       # BaseServiceConfig (Pydantic BaseSettings)
├── schemas.py      # HealthResponse, PaginatedResponse, ErrorResponse
└── exceptions.py   # PosError → AuthenticationError, NotFoundError, etc.
```

**`pos_events`** — Event bus with pluggable transport:
```
backend/shared/pos_events/
├── __init__.py
├── base.py         # BaseEvent dataclass (envelope)
├── transport.py    # Transport ABC
├── rabbitmq.py     # RabbitMqTransport (aio-pika implementation)
└── bus.py          # EventBus singleton
```

**Why two packages, not one**: `pos_contracts` has no heavy dependencies (just Pydantic, SQLAlchemy for column types). `pos_events` depends on aio-pika. Services that don't publish events (gateway) shouldn't need aio-pika installed.

**Alternative considered**: Keep one package, just reorganize internally. Rejected because it doesn't solve the coupling — a single `pip install` still pulls everything.

**Alternative considered**: No shared packages at all — copy types into each service. Rejected because the base model pattern (`UserScopedBase`) and exception hierarchy are genuine contracts that should stay consistent.

### Decision 2: Per-service database module

**Choice**: Each service gets its own `app/db.py` (~40 lines):

```python
# services/notes/app/db.py
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_engine = None
_session_factory = None

def init_db(database_url: str, echo: bool = False):
    global _engine, _session_factory
    _engine = create_async_engine(database_url, echo=echo)
    _session_factory = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncSession:
    async with _session_factory() as session:
        yield session

async def close_db():
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
```

**Why**: Each service owns its connection pool. Notes might need `pool_size=20` while auth only needs `pool_size=5`. When we split databases in Phase 5, each service already manages its own connection — zero shared code to untangle.

**Why not keep shared**: The code is ~40 lines of boilerplate. Sharing it saves almost nothing but creates coupling on a critical lifecycle concern.

### Decision 3: Auth moves to gateway + auth service

**Choice**: Delete `pos_common.auth` module entirely.

- `validate_token()` → `backend/gateway/app/auth.py` (it's already only used here)
- `create_access_token()`, `create_refresh_token()` → `backend/services/auth/app/tokens.py` (already only used here)

**Why**: This is **edge authentication**. The gateway is the single trust boundary. Services behind it operate in a trusted network and read `X-User-Id` from the header. No service should import JWT logic.

**Alternative considered**: Keep auth in a shared package for "future services that might need it." Rejected — YAGNI, and if a service needs to validate tokens, that's a design smell (should go through gateway).

### Decision 4: Event system with pluggable transport

**Choice**: `pos_events` package with Transport ABC and EventBus.

```python
# BaseEvent — the envelope contract
@dataclass
class BaseEvent:
    event_name: str          # e.g., "note.created"
    source_service: str      # e.g., "notes"
    payload: dict[str, Any]  # service-specific data
    event_id: str = field(default_factory=lambda: str(uuid7()))
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# Transport ABC — pluggable backend
class Transport(ABC):
    async def connect(self, url: str): ...
    async def publish(self, event: BaseEvent): ...
    async def subscribe(self, pattern: str, handler: Callable): ...
    async def close(self): ...

# EventBus — what services interact with
class EventBus:
    async def init(self, url: str, transport: Transport | None = None): ...
    async def publish(self, event: BaseEvent): ...
    async def subscribe(self, pattern: str, handler: Callable): ...
    async def close(self): ...

event_bus = EventBus()  # singleton
```

Concrete events live in each service:
```python
# services/notes/app/events.py
from pos_events import BaseEvent, event_bus

class NoteCreated(BaseEvent):
    def __init__(self, note_id: str, title: str, folder_id: str | None):
        super().__init__(
            event_name="note.created",
            source_service="notes",
            payload={"note_id": note_id, "title": title, "folder_id": folder_id},
        )

# Usage:
await event_bus.publish(NoteCreated(str(note.id), note.title, str(note.folder_id)))
```

**Why pluggable transport**: Proven pattern from production. When migrating from ResqueBus to RabbitMQ, the transport abstraction enabled dual-publish (FanoutTransport) with zero service code changes. Subscribers migrated one at a time. Same pattern enables future moves (RabbitMQ → Kafka, or adding a local/test transport).

**FanoutTransport** (for migrations — not built now, but the architecture supports it):
```python
class FanoutTransport(Transport):
    def __init__(self, *transports):
        self._transports = transports
    async def publish(self, event):
        for t in self._transports:
            await t.publish(event)
```

### Decision 5: UUIDv7 for primary keys

**Choice**: Replace `uuid.uuid4` with `uuid_utils.uuid7` in `UserScopedBase`.

```python
# UUIDv4 (current):  a7f3b2c1-4d5e-4f6a-8b9c-0d1e2f3a4b5c  ← fully random
# UUIDv7 (new):      019526a4-e8b0-7df2-a345-6789abcdef01  ← timestamp prefix
#                     ^^^^^^^^ ^^^^
#                     48-bit unix ms — time-ordered!
```

**Why UUIDv7 over UUIDv4**:
- UUIDv4 is fully random → inserts scatter across B-tree pages → page splits, cache misses, write amplification
- UUIDv7 has 48-bit millisecond timestamp prefix → inserts are monotonically increasing → sequential page appends, same performance as bigint auto-increment
- Still globally unique, still non-guessable (random suffix), still 16 bytes / standard UUID format
- No schema migration needed — column type is still `UUID`, only the default value generator changes

**Why not bigint PK + UUID external column**: Adds complexity (two ID columns, FK decisions). UUIDv7 gives us bigint-like index performance with UUID benefits. The dual-column pattern is for extreme scale where the 16-byte vs 8-byte index size matters.

**Dependency**: `uuid-utils` package (C-based, fast UUIDv7 generation).

### Decision 6: Package structure and installation

Both packages use `pyproject.toml` and editable installs:

```
backend/shared/
├── pos_contracts/      # pip install -e backend/shared/pos_contracts
│   ├── pyproject.toml
│   └── pos_contracts/
│       ├── __init__.py
│       ├── models.py
│       ├── config.py
│       ├── schemas.py
│       └── exceptions.py
├── pos_events/         # pip install -e backend/shared/pos_events
│   ├── pyproject.toml
│   └── pos_events/
│       ├── __init__.py
│       ├── base.py
│       ├── transport.py
│       ├── rabbitmq.py
│       └── bus.py
└── pos_common/         # DELETED after migration
```

`setup-dev.sh` updated to install both packages. Future Dockerfiles will `pip install` each as needed — gateway only needs `pos_contracts`, services need both.

## Risks / Trade-offs

**[More files per service]** → Each service gets ~40 lines of db.py that were previously shared. This is intentional duplication — the boilerplate is small and each service benefits from owning its lifecycle. Mitigated by providing a clear template in the service skeleton.

**[Migration of existing imports]** → Every `from pos_common.X import Y` must change. This is a mechanical find-and-replace. Mitigation: do all services in one pass, run tests after each.

**[Two packages to maintain instead of one]** → Slightly more overhead. Mitigated by the fact that `pos_contracts` changes very rarely (it's just types) and `pos_events` changes only when the event system evolves.

**[UUIDv7 dependency]** → Adds `uuid-utils` as a dependency. Risk is minimal — it's a well-maintained package with C bindings. If it ever becomes unmaintained, UUIDv7 generation is ~20 lines of Python to implement directly.

**[Existing UUIDv4 data]** → Existing rows keep their UUIDv4 IDs. New rows get UUIDv7. This is fine — both are valid UUIDs, the column type doesn't change. No data migration needed, only a default value change.

## Migration Plan

1. Create `pos_contracts` and `pos_events` packages with the new structure
2. Update `setup-dev.sh` to install both new packages
3. Add per-service `db.py` to each service
4. Move auth code: `validate_token` → gateway, `create/validate tokens` → auth service
5. Update all service imports from `pos_common` → `pos_contracts` / `pos_events` / local
6. Create concrete event classes in each service
7. Update `UserScopedBase` to use UUIDv7
8. Run all existing tests to verify no regressions
9. Remove `backend/shared/pos_common/` directory
10. Update Alembic migration env files if needed

**Rollback**: If issues arise, the old `pos_common` directory can be restored from git. Import changes are mechanical and reversible.

## Open Questions

- **Should `BaseServiceConfig` stay in `pos_contracts` or move per-service?** Current thinking: keep shared since all services need the same base settings (DATABASE_URL, RABBITMQ_URL, etc.), but each service subclasses it for service-specific settings. This is a contract, not infrastructure.
- **Should we add a `NullTransport` for testing?** Would allow unit tests to run without RabbitMQ. Low effort, can add during implementation if useful.
