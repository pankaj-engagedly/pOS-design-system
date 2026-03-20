#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VENV="$ROOT_DIR/backend/.venv/bin"
LOG_DIR="/tmp/pos-logs"

# Ensure Homebrew PostgreSQL binaries are on PATH
for ver in 17 16 15 14; do
    pg_bin="/opt/homebrew/opt/postgresql@$ver/bin"
    [ -d "$pg_bin" ] && export PATH="$pg_bin:$PATH" && break
    pg_bin="/usr/local/opt/postgresql@$ver/bin"
    [ -d "$pg_bin" ] && export PATH="$pg_bin:$PATH" && break
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

info()  { echo -e "${CYAN}▸${NC} $1"; }
ok()    { echo -e "${GREEN}✓${NC} $1"; }
warn()  { echo -e "${YELLOW}!${NC} $1"; }
fail()  { echo -e "${RED}✗${NC} $1"; }

wait_for_port() {
    local port=$1 name=$2 timeout=${3:-15}
    local elapsed=0
    while ! curl -sf "http://127.0.0.1:$port/health" > /dev/null 2>&1; do
        sleep 1
        elapsed=$((elapsed + 1))
        if [ $elapsed -ge $timeout ]; then
            fail "$name failed to start on port $port (timeout ${timeout}s)"
            echo -e "  ${DIM}Check logs: $LOG_DIR/${name}.log${NC}"
            return 1
        fi
    done
    ok "$name ready on :$port"
}

# ─────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══ pOS Development Stack ═══${NC}"
echo ""

mkdir -p "$LOG_DIR"

# ─── 1. PostgreSQL ───────────────────────────────────────

info "Checking PostgreSQL..."

if pg_isready -q -h localhost -p 5432 2>/dev/null; then
    ok "PostgreSQL running on :5432"
else
    warn "PostgreSQL not running, attempting to start..."
    if command -v brew &>/dev/null; then
        # Try common Homebrew PostgreSQL versions
        for ver in 17 16 15 14; do
            if brew list "postgresql@$ver" &>/dev/null; then
                brew services restart "postgresql@$ver" 2>/dev/null || true
                sleep 3
                if pg_isready -q -h localhost -p 5432 2>/dev/null; then
                    ok "PostgreSQL @$ver started via Homebrew"
                    break
                fi
            fi
        done

        if ! pg_isready -q -h localhost -p 5432 2>/dev/null; then
            fail "Could not start PostgreSQL"
            echo "  Install: brew install postgresql@17 && brew services start postgresql@17"
            exit 1
        fi
    else
        fail "PostgreSQL not running and Homebrew not available"
        echo "  Start PostgreSQL manually, then retry"
        exit 1
    fi
fi

# Check pos database exists
if psql -h localhost -U pos -d pos -c '\q' 2>/dev/null; then
    ok "Database 'pos' accessible"
else
    warn "Database 'pos' not found, creating..."
    createdb -h localhost pos 2>/dev/null || createuser -h localhost pos 2>/dev/null && createdb -h localhost -O pos pos 2>/dev/null
    if psql -h localhost -U pos -d pos -c '\q' 2>/dev/null; then
        ok "Database 'pos' created"
    else
        fail "Could not create database — create manually:"
        echo "  createuser -h localhost pos"
        echo "  createdb -h localhost -O pos pos"
        exit 1
    fi
fi

# ─── 2. Docker / RabbitMQ ────────────────────────────────

info "Checking Docker & RabbitMQ..."

if ! docker info > /dev/null 2>&1; then
    warn "Docker not running — RabbitMQ will be unavailable (events disabled, non-fatal)"
else
    docker compose -f "$ROOT_DIR/backend/docker-compose.yml" up -d --quiet-pull 2>/dev/null
    # Wait for RabbitMQ health
    local_timeout=15
    elapsed=0
    while [ $elapsed -lt $local_timeout ]; do
        if docker exec pos-rabbitmq rabbitmq-diagnostics -q ping 2>/dev/null; then
            ok "RabbitMQ ready on :5672"
            break
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done
    if [ $elapsed -ge $local_timeout ]; then
        warn "RabbitMQ slow to start — events may be unavailable initially"
    fi
fi

# ─── 3. Migrations ───────────────────────────────────────

info "Running database migrations..."

# Shared migrations first (tags, taggables) — must run before service migrations
cd "$ROOT_DIR/backend/shared/migrations"
if "$VENV/alembic" -c alembic.ini upgrade head > "$LOG_DIR/migrate-shared.log" 2>&1; then
    ok "Migrations: shared (tags/taggables)"
else
    warn "Migration issue for shared tables (check $LOG_DIR/migrate-shared.log)"
fi

# Per-service migrations
for svc_dir in "$ROOT_DIR"/backend/services/*/; do
    if [ -f "$svc_dir/alembic.ini" ]; then
        svc_name=$(basename "$svc_dir")
        cd "$svc_dir"
        if "$VENV/alembic" upgrade head > "$LOG_DIR/migrate-$svc_name.log" 2>&1; then
            ok "Migrations: $svc_name"
        else
            warn "Migration issue for $svc_name (check $LOG_DIR/migrate-$svc_name.log)"
        fi
    fi
done

# ─── 4. Stop stale processes ────────────────────────────

pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "node.*frontend/server.js" 2>/dev/null || true
pkill -f "node.*design-system/server.js" 2>/dev/null || true
sleep 1

# ─── 5. Start services ──────────────────────────────────

# Per-service log levels — set by Makefile vars, default to INFO
# Usage: make dev notes=TRACE  or  make dev LOG_LEVEL=TRACE
AUTH_LOG="${auth:-INFO}"
TODOS_LOG="${todos:-INFO}"
NOTES_LOG="${notes:-INFO}"
DOCUMENTS_LOG="${documents:-INFO}"
VAULT_LOG="${vault:-INFO}"
KB_LOG="${kb:-INFO}"
PHOTOS_LOG="${photos:-INFO}"
GATEWAY_LOG="${gateway:-INFO}"

info "Starting services (auth=${AUTH_LOG} todos=${TODOS_LOG} notes=${NOTES_LOG} documents=${DOCUMENTS_LOG} vault=${VAULT_LOG} kb=${KB_LOG} photos=${PHOTOS_LOG} gateway=${GATEWAY_LOG})..."

cd "$ROOT_DIR/backend/services/auth"
LOG_LEVEL="$AUTH_LOG" "$VENV/uvicorn" app.main:app --reload --port 8001 > "$LOG_DIR/auth.log" 2>&1 &

cd "$ROOT_DIR/backend/services/todos"
LOG_LEVEL="$TODOS_LOG" "$VENV/uvicorn" app.main:app --reload --port 8002 > "$LOG_DIR/todos.log" 2>&1 &

cd "$ROOT_DIR/backend/services/attachments"
"$VENV/uvicorn" app.main:app --reload --port 8003 > "$LOG_DIR/attachments.log" 2>&1 &

cd "$ROOT_DIR/backend/services/notes"
LOG_LEVEL="$NOTES_LOG" "$VENV/uvicorn" app.main:app --reload --port 8004 > "$LOG_DIR/notes.log" 2>&1 &

cd "$ROOT_DIR/backend/services/documents"
LOG_LEVEL="$DOCUMENTS_LOG" "$VENV/uvicorn" app.main:app --reload --port 8005 > "$LOG_DIR/documents.log" 2>&1 &

cd "$ROOT_DIR/backend/services/vault"
LOG_LEVEL="$VAULT_LOG" "$VENV/uvicorn" app.main:app --reload --port 8006 > "$LOG_DIR/vault.log" 2>&1 &

cd "$ROOT_DIR/backend/services/kb"
LOG_LEVEL="$KB_LOG" "$VENV/uvicorn" app.main:app --reload --port 8007 > "$LOG_DIR/kb.log" 2>&1 &

cd "$ROOT_DIR/backend/services/photos"
LOG_LEVEL="$PHOTOS_LOG" "$VENV/uvicorn" app.main:app --reload --port 8008 > "$LOG_DIR/photos.log" 2>&1 &

cd "$ROOT_DIR/backend/gateway"
LOG_LEVEL="$GATEWAY_LOG" "$VENV/uvicorn" app.main:app --reload --port 8000 > "$LOG_DIR/gateway.log" 2>&1 &

cd "$ROOT_DIR"
node frontend/server.js > "$LOG_DIR/frontend.log" 2>&1 &

cd "$ROOT_DIR/design-system"
node server.js > "$LOG_DIR/design-system.log" 2>&1 &

# ─── 6. Wait for readiness ──────────────────────────────

info "Waiting for services..."

all_ok=true
wait_for_port 8001 "auth"        || all_ok=false
wait_for_port 8002 "todos"       || all_ok=false
wait_for_port 8003 "attachments" || all_ok=false
wait_for_port 8004 "notes"       || all_ok=false
wait_for_port 8005 "documents"   || all_ok=false
wait_for_port 8006 "vault"       || all_ok=false
wait_for_port 8007 "kb"          || all_ok=false
wait_for_port 8008 "photos"      || all_ok=false
wait_for_port 8000 "gateway"     || all_ok=false

# Frontend and design system don't have /health, just check the port
sleep 1
if curl -sf "http://127.0.0.1:3001/" > /dev/null 2>&1; then
    ok "frontend ready on :3001"
else
    warn "frontend may still be starting"
fi

if curl -sf "http://127.0.0.1:3000/" > /dev/null 2>&1; then
    ok "design system showcase ready on :3000"
else
    warn "design system showcase may still be starting"
fi

# ─── 7. Summary ─────────────────────────────────────────

echo ""
if [ "$all_ok" = true ]; then
    echo -e "${GREEN}═══ pOS is running ═══${NC}"
else
    echo -e "${YELLOW}═══ pOS started with warnings ═══${NC}"
fi
echo ""
echo -e "  ${CYAN}App${NC}            http://localhost:3001"
echo -e "  ${CYAN}Design System${NC}  http://localhost:3000"
echo -e "  ${DIM}Gateway        http://localhost:8000${NC}"
echo -e "  ${DIM}Auth API       http://localhost:8001${NC}"
echo -e "  ${DIM}Todo API       http://localhost:8002${NC}"
echo -e "  ${DIM}Attachment API http://localhost:8003${NC}"
echo -e "  ${DIM}Notes API      http://localhost:8004${NC}"
echo -e "  ${DIM}Documents API  http://localhost:8005${NC}"
echo -e "  ${DIM}Vault API      http://localhost:8006${NC}"
echo -e "  ${DIM}KB API         http://localhost:8007${NC}"
echo -e "  ${DIM}Photos API     http://localhost:8008${NC}"
echo -e "  ${DIM}RabbitMQ       http://localhost:15672${NC}"
echo ""
echo -e "  ${DIM}Logs       $LOG_DIR/*.log${NC}"
echo -e "  ${DIM}Stop       make stop${NC}"
echo ""
