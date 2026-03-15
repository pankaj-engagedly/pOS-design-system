#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
VENV_DIR="$ROOT_DIR/backend/.venv"

echo "═══════════════════════════════════════"
echo "  pOS Development Environment Setup"
echo "═══════════════════════════════════════"
echo ""

# ─── Check prerequisites ────────────────────────────────

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "ERROR: $1 is required but not installed."
        echo "  $2"
        exit 1
    fi
}

echo "Checking prerequisites..."

check_command python3 "Install Python 3.12+: https://python.org"
check_command node "Install Node.js 18+: https://nodejs.org"
check_command docker "Install Docker: https://docker.com"

# Find best Python (prefer Homebrew 3.12, then 3.13, then system python3)
if command -v python3.12 &> /dev/null; then
    PYTHON_BIN="python3.12"
elif command -v python3.13 &> /dev/null; then
    PYTHON_BIN="python3.13"
elif [ -x /opt/homebrew/bin/python3.12 ]; then
    PYTHON_BIN="/opt/homebrew/bin/python3.12"
else
    PYTHON_BIN="python3"
fi

# Check Python version
PYTHON_VERSION=$($PYTHON_BIN -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)
if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 10 ]); then
    echo "ERROR: Python 3.10+ required, found $PYTHON_VERSION"
    echo "  Install via: brew install python@3.12"
    echo "  Or: https://python.org/downloads/"
    exit 1
fi
echo "  Python $PYTHON_VERSION ($PYTHON_BIN) ✓"

# Check Node version
NODE_VERSION=$(node -v | tr -d 'v' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "ERROR: Node.js 18+ required, found $(node -v)"
    exit 1
fi
echo "  Node $(node -v) ✓"

echo "  Docker ✓"
echo ""

# ─── Python virtual environment ─────────────────────────

echo "Setting up Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    $PYTHON_BIN -m venv "$VENV_DIR"
    echo "  Created venv at backend/.venv/"
else
    echo "  Venv already exists at backend/.venv/"
fi

# Install shared library and all service dependencies
echo "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install --quiet --upgrade pip

# Install shared packages (contracts first — pos_events depends on it)
# pos_contracts: shared types, schemas, base models — no runtime infrastructure
# pos_events: event bus with pluggable transport (RabbitMQ default)
"$VENV_DIR/bin/pip" install --quiet -e "$ROOT_DIR/backend/shared/pos_contracts"
"$VENV_DIR/bin/pip" install --quiet -e "$ROOT_DIR/backend/shared/pos_events"

# Install gateway deps
"$VENV_DIR/bin/pip" install --quiet -r "$ROOT_DIR/backend/gateway/requirements.txt"

# Install service deps
for svc_dir in "$ROOT_DIR"/backend/services/*/; do
    if [ -f "$svc_dir/requirements.txt" ]; then
        svc_name=$(basename "$svc_dir")
        echo "  Installing deps for $svc_name..."
        "$VENV_DIR/bin/pip" install --quiet -r "$svc_dir/requirements.txt"
    fi
done

# Install test tools
"$VENV_DIR/bin/pip" install --quiet pytest httpx

echo "  Python dependencies installed ✓"
echo ""

# ─── Node dependencies ──────────────────────────────────

echo "Installing Node dependencies..."

if [ -d "$ROOT_DIR/design-system/package.json" ] || [ -f "$ROOT_DIR/design-system/package.json" ]; then
    cd "$ROOT_DIR/design-system" && npm install --silent
    echo "  Design system deps installed ✓"
fi

if [ -f "$ROOT_DIR/frontend/package.json" ]; then
    cd "$ROOT_DIR/frontend" && npm install --silent 2>/dev/null || true
    echo "  Frontend deps installed ✓"
fi

echo ""

# ─── Docker images ───────────────────────────────────────

echo "Pulling Docker images..."
if docker compose -f "$ROOT_DIR/backend/docker-compose.yml" pull --quiet 2>/dev/null; then
    echo "  Docker images pulled ✓"
else
    echo "  Docker images skipped (Docker daemon not running — start Docker Desktop and run 'make dev-infra' later)"
fi
echo ""

# ─── Build design system ────────────────────────────────

echo "Building design system..."
cd "$ROOT_DIR/design-system" && npm run build --silent
echo "  Design system built ✓"
echo ""

# ─── Done ────────────────────────────────────────────────

echo "═══════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    make dev       — Start full dev stack"
echo "    make dev-ds    — Start design system only"
echo "    make test      — Run all tests"
echo "═══════════════════════════════════════"
