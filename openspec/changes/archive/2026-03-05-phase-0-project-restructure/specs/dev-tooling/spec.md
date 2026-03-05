## ADDED Requirements

### Requirement: Makefile provides unified development interface

A root-level `Makefile` SHALL provide targets for all common development operations. All targets SHALL work from the repository root. Targets that depend on other targets (e.g., `dev` depends on Docker infrastructure) SHALL declare dependencies explicitly.

#### Scenario: make setup initializes the full development environment
- **WHEN** a developer clones the repo and runs `make setup`
- **THEN** the Python virtual environment is created at `backend/.venv/`
- **AND** Python dependencies are installed from all service `requirements.txt` files
- **AND** Node dependencies are installed in `design-system/` and `frontend/`
- **AND** Docker images for PostgreSQL and RabbitMQ are pulled
- **AND** the PostgreSQL database is initialized

#### Scenario: make dev starts the full development stack
- **WHEN** a developer runs `make dev`
- **THEN** Docker Compose starts PostgreSQL and RabbitMQ
- **AND** the backend API gateway starts
- **AND** the frontend dev server starts serving the app shell
- **AND** all processes output logs to the terminal

#### Scenario: make dev-ds starts only the design system
- **WHEN** a developer runs `make dev-ds`
- **THEN** only the design system dev server starts (`cd design-system && npm run preview`)
- **AND** no Docker containers or backend services are started

#### Scenario: make test runs all test suites
- **WHEN** a developer runs `make test`
- **THEN** design system tests run (`cd design-system && npm test`)
- **AND** frontend tests run (`cd frontend && npm test`)
- **AND** backend tests run (`cd backend && pytest`)
- **AND** the exit code is non-zero if any suite fails

#### Scenario: make stop stops all running services
- **WHEN** a developer runs `make stop`
- **THEN** all running dev server processes are stopped
- **AND** Docker Compose services are stopped

### Requirement: Setup script for one-command initialization

The `infra/scripts/setup-dev.sh` SHALL be an executable bash script that performs first-time environment setup. It SHALL be idempotent — running it twice produces the same result without errors.

#### Scenario: Script creates Python venv if not exists
- **WHEN** `setup-dev.sh` runs and `backend/.venv/` does not exist
- **THEN** a Python 3.12+ virtual environment is created at `backend/.venv/`

#### Scenario: Script is idempotent
- **WHEN** `setup-dev.sh` runs a second time with everything already set up
- **THEN** it completes successfully without errors (skips already-done steps or re-runs harmlessly)

#### Scenario: Script checks prerequisites
- **WHEN** `setup-dev.sh` runs and Python 3.12+, Node 18+, or Docker is not installed
- **THEN** it prints a clear error message listing missing prerequisites and exits with non-zero code

### Requirement: Database migration targets

The Makefile SHALL include `db-migrate` and `db-reset` targets for database management. `db-migrate` runs pending Alembic migrations for all services. `db-reset` drops and recreates the database.

#### Scenario: make db-migrate runs all pending migrations
- **WHEN** a developer runs `make db-migrate`
- **THEN** Alembic migrations for every service with a `migrations/` directory are executed in order

#### Scenario: make db-reset recreates the database
- **WHEN** a developer runs `make db-reset`
- **THEN** the `pos` database is dropped and recreated
- **AND** all migrations are re-run from scratch

### Requirement: Environment configuration via .env files

Each backend service SHALL load configuration from environment variables, with defaults suitable for local development. A `.env.example` file SHALL exist at `backend/` showing all required variables with placeholder values.

#### Scenario: Example env file documents all variables
- **WHEN** a developer reads `backend/.env.example`
- **THEN** it contains documented entries for: `DATABASE_URL`, `RABBITMQ_URL`, `JWT_SECRET_KEY`, `JWT_PUBLIC_KEY`, `DEBUG`

#### Scenario: Default values work for local development
- **WHEN** a developer runs a service without a `.env` file
- **THEN** it uses defaults that connect to `localhost` PostgreSQL (port 5432) and RabbitMQ (port 5672)
