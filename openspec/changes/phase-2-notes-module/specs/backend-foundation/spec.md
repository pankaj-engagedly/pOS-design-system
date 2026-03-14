## MODIFIED Requirements

### Requirement: API gateway proxies to downstream services

The API gateway SHALL proxy requests to all backend services based on URL prefix. The gateway SHALL validate JWT tokens and inject `x-user-id` headers for authenticated routes.

#### Scenario: Notes service proxy
- **WHEN** a request is made to `/api/notes/{path}`
- **THEN** the gateway proxies it to `http://localhost:8004/api/notes/{path}`
- **AND** the `x-user-id` header is injected from the JWT token

#### Scenario: Auth routes remain public
- **WHEN** a request is made to `/api/auth/login` or `/api/auth/register`
- **THEN** no JWT validation is performed

#### Scenario: Gateway API root lists notes service
- **WHEN** `GET /api/` is called
- **THEN** the response includes `"/api/notes": "Notes service"` as an active route

## ADDED Requirements

### Requirement: Dev scripts start and stop the notes service

The dev infrastructure SHALL start the notes service on port 8004 alongside existing services. `make dev` SHALL start the notes service. `make stop` SHALL stop it. Logs SHALL go to `/tmp/pos-logs/notes.log`.

#### Scenario: Notes service starts with make dev
- **WHEN** `make dev` is run
- **THEN** the notes service starts on port 8004
- **AND** its logs are written to `/tmp/pos-logs/notes.log`

#### Scenario: Notes service stops with make stop
- **WHEN** `make stop` is run
- **THEN** the notes service process is terminated

### Requirement: Alembic migrations run for notes service

The Makefile `db-migrate` target SHALL run Alembic migrations for the notes service in addition to existing services. The notes service SHALL use `alembic_version_notes` as its version table.

#### Scenario: Migrations include notes service
- **WHEN** `make db-migrate` is run
- **THEN** Alembic migrations run for auth, todos, and notes services

#### Scenario: Notes uses separate version table
- **WHEN** notes migrations run
- **THEN** the version is tracked in `alembic_version_notes`
