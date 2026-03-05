## ADDED Requirements

### Requirement: Shared Python library (pos_common)

The `backend/shared/pos_common/` package SHALL provide reusable modules for all backend services: database session management, configuration loading, RabbitMQ event helpers, JWT authentication utilities, shared Pydantic schemas, and common exceptions. It SHALL be installable as a local package via `pip install -e backend/shared/`.

#### Scenario: Package is importable after install
- **WHEN** a developer runs `pip install -e backend/shared/` in the project venv
- **THEN** `from pos_common import database, config, events, auth, schemas, exceptions` succeeds

### Requirement: Database module with user-scoped base model

The `pos_common.database` module SHALL provide an async SQLAlchemy session factory and a `UserScopedBase` declarative base class. All models extending `UserScopedBase` SHALL automatically include a `user_id` column (UUID, non-nullable, indexed) and a `created_at` / `updated_at` timestamp pair.

#### Scenario: Model inheriting UserScopedBase has user_id column
- **WHEN** a service defines a model extending `UserScopedBase`
- **THEN** the model table has columns: `id` (UUID, primary key), `user_id` (UUID, non-nullable, indexed), `created_at` (timestamp with timezone), `updated_at` (timestamp with timezone)

#### Scenario: Session factory connects to PostgreSQL
- **WHEN** the database module is initialized with a valid `DATABASE_URL`
- **THEN** `get_async_session()` returns an `AsyncSession` connected to PostgreSQL

### Requirement: Configuration module using Pydantic Settings

The `pos_common.config` module SHALL provide a `BaseServiceConfig` class extending Pydantic's `BaseSettings`. It SHALL load configuration from environment variables and `.env` files. Common settings include: `DATABASE_URL`, `RABBITMQ_URL`, `JWT_SECRET_KEY`, `SERVICE_NAME`, `DEBUG`.

#### Scenario: Config loads from environment variables
- **WHEN** environment variable `DATABASE_URL` is set to `postgresql+asyncpg://localhost/pos`
- **THEN** `BaseServiceConfig().DATABASE_URL` returns that value

#### Scenario: Config loads from .env file
- **WHEN** a `.env` file exists in the service directory with `DEBUG=true`
- **AND** the `DEBUG` environment variable is not set
- **THEN** `BaseServiceConfig().DEBUG` returns `True`

### Requirement: RabbitMQ event helpers

The `pos_common.events` module SHALL provide async helpers for publishing and subscribing to RabbitMQ events using aio-pika. It SHALL support a topic exchange named `pos.events` with routing keys in dot-notation (e.g., `todo.created`, `note.updated`).

#### Scenario: Publish an event
- **WHEN** a service calls `await publish_event("todo.created", {"id": "123", "title": "Test"})`
- **THEN** a message is published to the `pos.events` topic exchange with routing key `todo.created` and JSON-encoded body

#### Scenario: Subscribe to events
- **WHEN** a service calls `await subscribe("todo.*", handler_callback)`
- **THEN** the handler is invoked for any message matching the `todo.*` routing pattern on the `pos.events` exchange

### Requirement: JWT authentication utilities

The `pos_common.auth` module SHALL provide functions to validate JWT tokens and extract the `user_id` claim. It SHALL support RS256-signed tokens with configurable public key.

#### Scenario: Valid token returns user_id
- **WHEN** `validate_token(token)` is called with a valid JWT containing `{"sub": "user-uuid-123"}`
- **THEN** it returns `"user-uuid-123"`

#### Scenario: Expired token raises exception
- **WHEN** `validate_token(token)` is called with an expired JWT
- **THEN** it raises an `AuthenticationError`

### Requirement: API gateway scaffold

The `backend/gateway/` SHALL contain a FastAPI application that serves as the API entry point. It SHALL include middleware for JWT authentication (extracting `user_id` and injecting it into request state), CORS handling, and route definitions that proxy to backend services.

#### Scenario: Gateway starts and serves health check
- **WHEN** the gateway is started with `uvicorn app.main:app`
- **THEN** `GET /health` returns `{"status": "ok"}` with HTTP 200

#### Scenario: Gateway rejects unauthenticated requests
- **WHEN** a request is made to a protected endpoint without a valid JWT in the `Authorization` header
- **THEN** the gateway returns HTTP 401 with `{"detail": "Not authenticated"}`

#### Scenario: Gateway injects user_id into request context
- **WHEN** a request with a valid JWT is processed by the auth middleware
- **THEN** `request.state.user_id` is set to the `user_id` extracted from the token

### Requirement: Service skeleton pattern

A sample service skeleton SHALL exist at `backend/services/sample/` demonstrating the standard service layout: `app/main.py` (FastAPI app factory), `app/models.py`, `app/schemas.py`, `app/routes.py`, `app/service.py`, `app/events.py`, `migrations/` (Alembic config), `tests/`, `requirements.txt`, and `Dockerfile`. This skeleton serves as a copy-paste template for new services.

#### Scenario: Sample service starts successfully
- **WHEN** the sample service is started with `uvicorn app.main:app`
- **THEN** `GET /health` returns `{"status": "ok"}` with HTTP 200
- **AND** the service connects to PostgreSQL and RabbitMQ

#### Scenario: Sample service has Alembic configured
- **WHEN** a developer runs `alembic -c backend/services/sample/alembic.ini revision --autogenerate -m "init"`
- **THEN** a migration file is generated in `backend/services/sample/migrations/versions/`

### Requirement: Docker Compose for development infrastructure

The `backend/docker-compose.yml` SHALL define services for PostgreSQL 16 and RabbitMQ 3.13 (with management plugin). Both SHALL use named volumes for data persistence across restarts.

#### Scenario: PostgreSQL starts and is accessible
- **WHEN** `docker compose -f backend/docker-compose.yml up -d` is run
- **THEN** PostgreSQL is accessible on `localhost:5432`
- **AND** a database named `pos` exists (created by init script or env var)

#### Scenario: RabbitMQ starts with management UI
- **WHEN** `docker compose -f backend/docker-compose.yml up -d` is run
- **THEN** RabbitMQ is accessible on `localhost:5672` (AMQP)
- **AND** the management UI is accessible on `localhost:15672`

#### Scenario: Data persists across container restarts
- **WHEN** a developer runs `docker compose down` followed by `docker compose up -d`
- **THEN** PostgreSQL data and RabbitMQ state are preserved via named volumes
