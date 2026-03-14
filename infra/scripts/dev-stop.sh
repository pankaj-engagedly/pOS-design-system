#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
DIM='\033[2m'
NC='\033[0m'

ok() { echo -e "${GREEN}✓${NC} $1"; }

echo ""
echo -e "${CYAN}═══ Stopping pOS ═══${NC}"
echo ""

# Stop Python services
if pkill -f "uvicorn app.main:app" 2>/dev/null; then
    ok "Stopped backend services (auth, todos, attachments, gateway)"
else
    ok "No backend services running"
fi

# Stop frontend + design system
if pkill -f "node.*frontend/server.js" 2>/dev/null; then
    ok "Stopped frontend server"
else
    ok "No frontend server running"
fi

if pkill -f "node.*design-system/server.js" 2>/dev/null; then
    ok "Stopped design system showcase"
else
    ok "No design system showcase running"
fi

# Stop Docker containers
if docker info > /dev/null 2>&1; then
    if docker compose -f "$ROOT_DIR/backend/docker-compose.yml" down 2>/dev/null; then
        ok "Stopped Docker containers (RabbitMQ)"
    fi
else
    ok "Docker not running"
fi

echo ""
echo -e "${GREEN}All services stopped.${NC}"
echo ""
