.PHONY: setup dev dev-ds dev-frontend dev-backend stop test test-ds test-frontend test-backend build build-ds db-migrate db-seed db-reset

# ─── Setup ───────────────────────────────────────────────

setup:
	@bash infra/scripts/setup-dev.sh

# ─── Development ─────────────────────────────────────────

dev: dev-infra
	@echo "Starting pOS development stack..."
	@trap 'make stop' INT TERM; \
	cd backend/gateway && ../.venv/bin/uvicorn app.main:app --reload --port 8000 & \
	node frontend/server.js & \
	wait

dev-infra:
	docker compose -f backend/docker-compose.yml up -d

dev-ds:
	cd design-system && npm run preview

dev-frontend:
	node frontend/server.js

dev-backend: dev-infra
	cd backend/gateway && ../.venv/bin/uvicorn app.main:app --reload --port 8000

stop:
	@echo "Stopping all services..."
	-@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	-@pkill -f "node frontend/server.js" 2>/dev/null || true
	-@docker compose -f backend/docker-compose.yml down 2>/dev/null || true
	@echo "All services stopped."

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
