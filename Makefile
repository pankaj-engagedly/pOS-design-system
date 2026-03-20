.PHONY: setup dev dev-ds dev-frontend dev-backend stop test test-ds test-frontend test-backend build build-ds db-migrate db-seed db-reset

# ─── Setup ───────────────────────────────────────────────

setup:
	@bash infra/scripts/setup-dev.sh

# ─── Development ─────────────────────────────────────────

# Log level control (default: INFO for all)
# Examples:
#   make dev                          — all INFO
#   make dev LOG_LEVEL=TRACE          — all services at TRACE
#   make dev notes=TRACE              — just notes at TRACE
#   make dev notes=TRACE todos=DEBUG  — mixed per-service levels
LOG_LEVEL  ?= INFO
auth       ?= $(LOG_LEVEL)
todos      ?= $(LOG_LEVEL)
notes      ?= $(LOG_LEVEL)
documents  ?= $(LOG_LEVEL)
vault      ?= $(LOG_LEVEL)
kb         ?= $(LOG_LEVEL)
photos     ?= $(LOG_LEVEL)
gateway    ?= $(LOG_LEVEL)

dev:
	@auth=$(auth) todos=$(todos) notes=$(notes) documents=$(documents) vault=$(vault) kb=$(kb) photos=$(photos) gateway=$(gateway) bash infra/scripts/dev-start.sh

dev-infra:
	docker compose -f backend/docker-compose.yml up -d

dev-ds:
	cd design-system && npm run preview

dev-frontend:
	node frontend/server.js

dev-backend:
	@bash infra/scripts/dev-start.sh

stop:
	@bash infra/scripts/dev-stop.sh

# ─── Testing ─────────────────────────────────────────────

test: test-ds test-backend
	@echo "All tests complete."

test-ds:
	cd design-system && npm test

test-frontend:
	@echo "Frontend tests not yet configured."

test-backend:
	cd backend && .venv/bin/python -m pytest services/*/tests/ -v

# ─── Build ───────────────────────────────────────────────

build: build-ds
	@echo "Build complete."

build-ds:
	cd design-system && npm run build

# ─── Database ────────────────────────────────────────────

db-migrate: dev-infra
	@echo "Running migrations for all services..."
	@for svc in backend/services/*/; do \
		if [ -f "$$svc/alembic.ini" ]; then \
			echo "Migrating $$(basename $$svc)..."; \
			cd "$$svc" && ../../.venv/bin/alembic upgrade head && cd ../../..; \
		fi; \
	done
	@echo "All migrations complete."

db-seed:
	@echo "Seeding development data..."
	@echo "No seed data configured yet."

db-reset: dev-infra
	@echo "Resetting database..."
	docker compose -f backend/docker-compose.yml exec postgres psql -U pos -c "DROP DATABASE IF EXISTS pos;"
	docker compose -f backend/docker-compose.yml exec postgres psql -U pos -d postgres -c "CREATE DATABASE pos;"
	$(MAKE) db-migrate
	@echo "Database reset complete."
