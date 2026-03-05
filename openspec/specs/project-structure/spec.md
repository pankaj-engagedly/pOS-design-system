## ADDED Requirements

### Requirement: Monorepo directory layout

The repository SHALL be organized into four top-level directories: `design-system/`, `frontend/`, `backend/`, and `infra/`. Cross-cutting concerns (`openspec/`, `docs/`, `.claude/`, `Makefile`, `README.md`, `.gitignore`) SHALL remain at the repository root.

#### Scenario: Design system is self-contained
- **WHEN** a developer runs `cd design-system && npm install && npm test`
- **THEN** all 101 existing component tests pass without any dependency on files outside `design-system/`

#### Scenario: Design system directory contains all DS files
- **WHEN** a developer inspects `design-system/`
- **THEN** it contains `src/`, `tokens/`, `test/`, `dist/`, `examples/`, `esbuild.config.js`, `web-test-runner.config.js`, `server.js`, and its own `package.json`

#### Scenario: Root-level files stay at root
- **WHEN** a developer inspects the repository root
- **THEN** `openspec/`, `docs/`, `.claude/`, `Makefile`, `README.md`, `.gitignore`, and root `package.json` are present at the root level

### Requirement: Design system package isolation

The `design-system/` directory SHALL have its own `package.json` with all Node devDependencies (esbuild, @web/test-runner, @web/test-runner-playwright, @esm-bundle/chai, @open-wc/testing-helpers). The root `package.json` SHALL NOT contain these dependencies.

#### Scenario: Design system package.json is standalone
- **WHEN** a developer reads `design-system/package.json`
- **THEN** it contains `name: "pos-design-system"`, `type: "module"`, and all devDependencies currently in the root `package.json`
- **AND** scripts for `build:tokens`, `build:js`, `build`, `preview`, `test`, `test:watch` are present with paths relative to `design-system/`

#### Scenario: Root package.json is an orchestrator
- **WHEN** a developer reads the root `package.json`
- **THEN** it contains `name: "pos"`, `private: true`, and does NOT contain design system devDependencies
- **AND** it MAY contain convenience scripts that delegate to the Makefile

### Requirement: Frontend directory structure follows Atomic Design

The `frontend/` directory SHALL be organized with `shell/` (app shell), `shared/` (cross-module services, molecules, organisms, templates), and `modules/` (micro-frontend module slots). Each module directory SHALL follow the Atomic Design hierarchy: `molecules/`, `organisms/`, `pages/`, `services/`, and `store.js`.

#### Scenario: Frontend directory exists with correct structure
- **WHEN** a developer inspects `frontend/`
- **THEN** directories `shell/`, `shared/`, and `modules/` exist
- **AND** `shared/` contains `services/`, `molecules/`, `organisms/`, and `templates/` directories
- **AND** `modules/` contains placeholder directories for: `todos`, `notes`, `knowledge-base`, `vault`, `feed-watcher`, `documents`, `photos`, `settings`

#### Scenario: Module directory follows Atomic Design
- **WHEN** a developer inspects any module directory under `frontend/modules/<name>/`
- **THEN** it contains `molecules/`, `organisms/`, `pages/`, `services/` directories and a `store.js` placeholder

### Requirement: Backend directory structure follows microservice pattern

The `backend/` directory SHALL contain `gateway/`, `services/`, `shared/`, and a `docker-compose.yml`. Each service under `services/` SHALL follow a consistent layout: `app/` (main.py, models.py, schemas.py, routes.py, service.py, events.py), `migrations/`, `tests/`, `requirements.txt`, and `Dockerfile`.

#### Scenario: Backend directory exists with correct structure
- **WHEN** a developer inspects `backend/`
- **THEN** directories `gateway/`, `services/`, `shared/` exist and `docker-compose.yml` is present

#### Scenario: Shared library is an installable Python package
- **WHEN** a developer inspects `backend/shared/`
- **THEN** it contains `pos_common/` package directory with `__init__.py` and a `pyproject.toml`

### Requirement: Infrastructure directory exists

The `infra/` directory SHALL contain `docker/`, `k8s/`, and `scripts/` directories. In Phase 0, `k8s/` is an empty placeholder. `scripts/` contains the `setup-dev.sh` script.

#### Scenario: Infra directory exists with placeholders
- **WHEN** a developer inspects `infra/`
- **THEN** directories `docker/`, `k8s/`, and `scripts/` exist
- **AND** `scripts/setup-dev.sh` exists and is executable

### Requirement: Gitignore covers all project layers

The `.gitignore` SHALL include patterns for: Node (`node_modules/`, `dist/`), Python (`__pycache__/`, `*.pyc`, `.venv/`, `*.egg-info/`), Docker (volume data), IDE files (`.idea/`, `.vscode/`), OS files (`.DS_Store`), and environment files (`.env`, `.env.local`).

#### Scenario: Python artifacts are ignored
- **WHEN** a Python `__pycache__/` directory or `.pyc` file is created
- **THEN** it does not appear in `git status`

#### Scenario: Virtual environment is ignored
- **WHEN** a Python venv is created at `backend/.venv/`
- **THEN** it does not appear in `git status`

#### Scenario: Environment files are ignored
- **WHEN** a `.env` or `.env.local` file is created in any directory
- **THEN** it does not appear in `git status`
