## 1. Create pos_contracts package

- [x] 1.1 Create `backend/shared/pos_contracts/` directory structure with `pyproject.toml` (dependencies: sqlalchemy, pydantic, uuid-utils)
- [x] 1.2 Create `pos_contracts/models.py` — move `Base` and `UserScopedBase` from pos_common. Change `uuid.uuid4` → `uuid_utils.uuid7` with inline comment explaining UUIDv7 rationale (timestamp prefix → B-tree friendly, RFC 9562)
- [x] 1.3 Create `pos_contracts/config.py` — move `BaseServiceConfig` from pos_common
- [x] 1.4 Create `pos_contracts/schemas.py` — move `HealthResponse`, `ErrorResponse`, `PaginatedResponse` from pos_common
- [x] 1.5 Create `pos_contracts/exceptions.py` — move exception hierarchy from pos_common
- [x] 1.6 Create `pos_contracts/__init__.py` with clean public API exports

## 2. Create pos_events package

- [x] 2.1 Create `backend/shared/pos_events/` directory structure with `pyproject.toml` (dependencies: aio-pika, pos_contracts)
- [x] 2.2 Create `pos_events/base.py` — `BaseEvent` dataclass with envelope fields (event_id via uuid7, event_name, source_service, created_at, payload) and `to_dict()` method. Add inline comment explaining the envelope pattern and why concrete events live in services
- [x] 2.3 Create `pos_events/transport.py` — `Transport` ABC with `connect`, `publish`, `subscribe`, `close` methods. Add inline comment explaining pluggable transport pattern (swap backend without changing service code)
- [x] 2.4 Create `pos_events/rabbitmq.py` — `RabbitMqTransport` implementing Transport ABC using aio-pika. Durable topic exchange `pos.events`, persistent messages, routing key from event_name
- [x] 2.5 Create `pos_events/bus.py` — `EventBus` class + module-level `event_bus` singleton. Best-effort publish (log warning on failure). Default to RabbitMqTransport. Add comment explaining why services use the bus not the transport directly
- [x] 2.6 Create `pos_events/__init__.py` with public API: `BaseEvent`, `Transport`, `RabbitMqTransport`, `EventBus`, `event_bus`

## 3. Per-service database modules

- [x] 3.1 Create `backend/services/auth/app/db.py` — own engine init, session factory, close. Add inline comment: "Each service owns its DB lifecycle for independent scaling and future DB separation"
- [x] 3.2 Create `backend/services/todos/app/db.py` — same pattern as auth
- [x] 3.3 Create `backend/services/notes/app/db.py` — same pattern as notes
- [x] 3.4 Create `backend/gateway/app/db.py` if gateway needs DB access, otherwise skip (gateway currently has no DB)

## 4. Move auth to gateway and auth service

- [x] 4.1 Create `backend/gateway/app/auth.py` — move `validate_token()` from pos_common. Add inline comment: "Edge authentication — gateway is the single trust boundary, services read X-User-Id"
- [x] 4.2 Create `backend/services/auth/app/tokens.py` — move `create_access_token()`, `create_refresh_token()`, `validate_token()` from pos_common. Add comment: "Token lifecycle lives in auth service — the only service that creates and validates tokens"
- [x] 4.3 Update gateway's `AuthMiddleware` to import from local `app.auth` instead of `pos_common.auth`

## 5. Create concrete events per service

- [x] 5.1 Rewrite `backend/services/todos/app/events.py` — define concrete event classes (TaskCreated, TaskUpdated, TaskCompleted, etc.) extending BaseEvent. Replace bare `publish_event()` calls with `event_bus.publish(ConcreteEvent(...))`
- [x] 5.2 Rewrite `backend/services/notes/app/events.py` — define concrete event classes (NoteCreated, NoteUpdated, NoteDeleted, etc.) extending BaseEvent. Replace bare `publish_event()` calls with `event_bus.publish(ConcreteEvent(...))`

## 6. Update service imports and main.py

- [x] 6.1 Update `backend/services/auth/app/main.py` — import from pos_contracts + local db.py + local tokens.py. Update lifespan to use local db init/close
- [x] 6.2 Update `backend/services/auth/app/models.py` — import Base from pos_contracts.models
- [x] 6.3 Update `backend/services/auth/app/service.py` — import from local tokens.py and pos_contracts.exceptions
- [x] 6.4 Update `backend/services/auth/app/routes.py` — import from pos_contracts.schemas, local tokens
- [x] 6.5 Update `backend/services/todos/app/main.py` — import from pos_contracts + local db.py + pos_events. Update lifespan to use local db init/close and event_bus.init/close
- [x] 6.6 Update `backend/services/todos/app/models.py` — import UserScopedBase from pos_contracts.models
- [x] 6.7 Update `backend/services/todos/app/service.py` — import from pos_contracts.exceptions, use concrete events
- [x] 6.8 Update `backend/services/todos/app/routes.py` — import from pos_contracts.schemas
- [x] 6.9 Update `backend/services/notes/app/main.py` — import from pos_contracts + local db.py + pos_events. Update lifespan to use local db init/close and event_bus.init/close
- [x] 6.10 Update `backend/services/notes/app/models.py` — import UserScopedBase from pos_contracts.models
- [x] 6.11 Update `backend/services/notes/app/service.py` — import from pos_contracts.exceptions, use concrete events
- [x] 6.12 Update `backend/services/notes/app/routes.py` — import from pos_contracts.schemas
- [x] 6.13 Update `backend/gateway/app/main.py` — import from pos_contracts + local auth.py
- [x] 6.14 Update `backend/gateway/app/routes.py` — import from pos_contracts.schemas

## 7. Update infrastructure and cleanup

- [x] 7.1 Update `infra/scripts/setup-dev.sh` — replace `pip install -e backend/shared` with installing both `pos_contracts` and `pos_events`
- [x] 7.2 Update Alembic `env.py` files for auth, todos, notes — change model imports to use `pos_contracts.models`
- [x] 7.3 Remove `backend/shared/pos_common/` directory entirely
- [x] 7.4 Update any remaining requirements.txt files if needed

## 8. Verification

- [x] 8.1 Run all existing tests for auth service — verify no regressions
- [x] 8.2 Run all existing tests for todos service — verify no regressions
- [x] 8.3 Run all existing tests for notes service — verify no regressions
- [x] 8.4 Start full stack with `make dev` — verify all services start, health checks pass
- [x] 8.5 Manual smoke test — login, create a todo, create a note, verify events publish (check logs)
