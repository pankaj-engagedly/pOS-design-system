## ADDED Requirements

### Requirement: Shared contracts package with no runtime infrastructure

The `pos_contracts` package (`backend/shared/pos_contracts/`) SHALL provide base models, exception hierarchy, shared Pydantic schemas, and a configuration base class. It SHALL NOT contain any runtime infrastructure code (no database engines, no message broker connections, no HTTP clients). It SHALL be installable via `pip install -e backend/shared/pos_contracts`.

#### Scenario: Package is importable after install
- **WHEN** a developer runs `pip install -e backend/shared/pos_contracts` in the project venv
- **THEN** `from pos_contracts.models import Base, UserScopedBase` succeeds
- **AND** `from pos_contracts.schemas import HealthResponse, ErrorResponse, PaginatedResponse` succeeds
- **AND** `from pos_contracts.exceptions import PosError, NotFoundError, AuthenticationError` succeeds
- **AND** `from pos_contracts.config import BaseServiceConfig` succeeds

#### Scenario: Package has no infrastructure dependencies
- **WHEN** `pos_contracts` is imported
- **THEN** it does NOT import aio-pika, does NOT create database engines, does NOT open network connections
- **AND** its only dependencies are SQLAlchemy (for column type declarations), Pydantic, and uuid-utils

### Requirement: UserScopedBase uses UUIDv7 primary keys

The `UserScopedBase` model base class SHALL use UUIDv7 (RFC 9562) for primary key generation instead of UUIDv4. UUIDv7 embeds a 48-bit millisecond timestamp prefix, making IDs monotonically increasing and B-tree index-friendly while retaining all UUID benefits (globally unique, non-guessable, no coordination needed).

#### Scenario: New records get UUIDv7 primary keys
- **WHEN** a model extending `UserScopedBase` creates a new row
- **THEN** the `id` column defaults to a UUIDv7 value
- **AND** the UUID starts with a timestamp-derived prefix that increases over time

#### Scenario: UUIDv7 IDs are time-ordered
- **WHEN** two records are created 10ms apart
- **THEN** the second record's UUID is lexicographically greater than the first's
- **AND** `ORDER BY id` produces the same ordering as `ORDER BY created_at`

#### Scenario: Existing UUIDv4 data remains valid
- **WHEN** the database contains rows with UUIDv4 primary keys from before the migration
- **THEN** those rows are still readable and joinable
- **AND** the UUID column type is unchanged (still `UUID`)

### Requirement: Base declarative base for non-user-scoped models

The `pos_contracts.models` module SHALL provide a `Base` declarative base class for models that do not need automatic user scoping (e.g., the User model in the auth service).

#### Scenario: Auth service User model extends Base
- **WHEN** a model extends `Base` instead of `UserScopedBase`
- **THEN** the model does NOT automatically get `user_id`, `created_at`, or `updated_at` columns
- **AND** the model can define its own primary key and columns

### Requirement: Configuration base class

The `pos_contracts.config` module SHALL provide a `BaseServiceConfig` class extending Pydantic's `BaseSettings`. It SHALL define common settings that all services share: `SERVICE_NAME`, `DEBUG`, `DATABASE_URL`, `RABBITMQ_URL`, `JWT_SECRET_KEY`, `JWT_ALGORITHM`.

#### Scenario: Service subclasses BaseServiceConfig
- **WHEN** a service defines `class NotesConfig(BaseServiceConfig)` with `SERVICE_NAME = "pos-notes"`
- **THEN** `NotesConfig()` loads `DATABASE_URL` from environment variables
- **AND** `NotesConfig().SERVICE_NAME` returns `"pos-notes"`

#### Scenario: Config loads from environment and .env files
- **WHEN** a `.env` file contains `DATABASE_URL=postgresql+asyncpg://localhost/pos`
- **THEN** `BaseServiceConfig().DATABASE_URL` returns that value

### Requirement: Shared Pydantic schemas

The `pos_contracts.schemas` module SHALL provide `HealthResponse`, `ErrorResponse`, and `PaginatedResponse` Pydantic models used across all services for consistent API responses.

#### Scenario: Health check response
- **WHEN** a service returns `HealthResponse(service="pos-notes")`
- **THEN** the JSON output is `{"status": "ok", "service": "pos-notes"}`

#### Scenario: Paginated response with generic type
- **WHEN** a service returns `PaginatedResponse[NoteResponse](items=[...], total=50, page=1, page_size=20)`
- **THEN** the response includes `total_pages: 3` (calculated from total and page_size)

### Requirement: Exception hierarchy with HTTP status codes

The `pos_contracts.exceptions` module SHALL provide a hierarchy of domain exceptions, each carrying an HTTP status code. The base exception `PosError` SHALL map to 500. Subclasses: `AuthenticationError` (401), `AuthorizationError` (403), `NotFoundError` (404), `ValidationError` (422).

#### Scenario: NotFoundError carries 404 status
- **WHEN** code raises `NotFoundError("Note not found")`
- **THEN** the exception has `status_code = 404` and `detail = "Note not found"`

#### Scenario: Default detail messages
- **WHEN** code raises `AuthenticationError()` without a message
- **THEN** the exception has `detail = "Not authenticated"`
