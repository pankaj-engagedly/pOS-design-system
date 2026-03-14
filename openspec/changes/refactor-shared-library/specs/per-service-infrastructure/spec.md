## ADDED Requirements

### Requirement: Each service owns its database lifecycle

Each backend service SHALL contain its own `app/db.py` module that manages async SQLAlchemy engine initialization, session factory creation, and cleanup. Services SHALL NOT import database connection management from any shared package.

#### Scenario: Service initializes its own database connection
- **WHEN** the notes service starts up
- **THEN** `app/db.py` calls `create_async_engine()` with the service's `DATABASE_URL`
- **AND** creates its own `async_sessionmaker`
- **AND** the engine and session factory are local to that service module

#### Scenario: Service configures its own connection pool
- **WHEN** the notes service needs a larger connection pool than auth
- **THEN** the notes service can pass `pool_size=20` to its `create_async_engine()` call
- **AND** this does not affect any other service's pool configuration

#### Scenario: Service cleans up its own database connection
- **WHEN** the notes service shuts down
- **THEN** `close_db()` in its `app/db.py` disposes the engine
- **AND** no shared global state is affected

#### Scenario: get_session dependency works per-service
- **WHEN** a FastAPI route in the notes service uses `Depends(get_session)`
- **THEN** the session comes from the notes service's own session factory
- **AND** the session is scoped to that request

### Requirement: Each service defines its own concrete events

Each service that publishes domain events SHALL define concrete event classes in its own `app/events.py` module. These classes SHALL extend `BaseEvent` from `pos_events` and provide `event_name`, `source_service`, and a structured `payload`.

#### Scenario: Notes service defines NoteCreated event
- **WHEN** the notes service creates a note
- **THEN** it publishes a `NoteCreated` event defined in `services/notes/app/events.py`
- **AND** the event has `event_name="note.created"`, `source_service="notes"`, and payload with `note_id`, `title`, `folder_id`

#### Scenario: Todos service defines TaskCompleted event
- **WHEN** a task is marked complete in the todos service
- **THEN** it publishes a `TaskCompleted` event defined in `services/todos/app/events.py`
- **AND** the event has `event_name="task.completed"`, `source_service="todos"`, and payload with `task_id`, `list_id`

#### Scenario: Services use EventBus singleton to publish
- **WHEN** a service publishes an event
- **THEN** it calls `await event_bus.publish(ConcreteEvent(...))` from `pos_events`
- **AND** it does NOT interact with the transport directly

### Requirement: Gateway owns token validation

The API gateway SHALL contain its own JWT token validation logic in `gateway/app/auth.py`. It SHALL NOT import auth utilities from any shared package. The gateway is the single trust boundary — services behind it read `X-User-Id` from headers.

#### Scenario: Gateway validates JWT tokens
- **WHEN** a request arrives with `Authorization: Bearer <token>`
- **THEN** the gateway's `auth.py` validates the token using `python-jose`
- **AND** extracts the `user_id` from the `sub` claim
- **AND** sets the `X-User-Id` header for downstream services

#### Scenario: Gateway rejects invalid tokens
- **WHEN** a request arrives with an expired or malformed JWT
- **THEN** the gateway returns HTTP 401
- **AND** no downstream service is called

#### Scenario: Services do not import JWT logic
- **WHEN** the todos or notes service processes a request
- **THEN** it reads `user_id` from `request.headers["x-user-id"]`
- **AND** it does NOT import `validate_token`, `python-jose`, or any JWT library

### Requirement: Auth service owns token creation

The auth service SHALL contain its own JWT token creation logic in `services/auth/app/tokens.py`. Functions `create_access_token()` and `create_refresh_token()` SHALL live in the auth service, NOT in any shared package.

#### Scenario: Auth service creates access tokens
- **WHEN** a user logs in successfully
- **THEN** the auth service's `tokens.py` creates a JWT with `sub=user_id`, `exp=15min`, `type=access`
- **AND** signs it with the configured secret key

#### Scenario: Auth service creates refresh tokens
- **WHEN** a user logs in successfully
- **THEN** the auth service's `tokens.py` creates a JWT with `sub=user_id`, `exp=7days`, `type=refresh`

#### Scenario: Auth service validates tokens for refresh flow
- **WHEN** a refresh token is presented to the auth service
- **THEN** the auth service's `tokens.py` validates and decodes it locally
- **AND** this validation does NOT use any shared auth module

### Requirement: Per-service configuration subclass

Each service SHALL define its own configuration class that extends `BaseServiceConfig` from `pos_contracts`. Service-specific settings (e.g., gateway's `AUTH_SERVICE_URL`) SHALL be defined in the service's own config class.

#### Scenario: Notes service has its own config
- **WHEN** the notes service starts
- **THEN** it uses `class NotesConfig(BaseServiceConfig)` with `SERVICE_NAME = "pos-notes"`
- **AND** any notes-specific settings are defined in this subclass

#### Scenario: Gateway has service URLs in its config
- **WHEN** the gateway starts
- **THEN** it uses `class GatewayConfig(BaseServiceConfig)` with `AUTH_SERVICE_URL`, `TODO_SERVICE_URL`, `NOTES_SERVICE_URL`
- **AND** these URLs are NOT in `BaseServiceConfig`
