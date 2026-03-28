#!/bin/bash
# Run all database migrations in order.
# Usage: ./migrate.sh
#
# Run this on first deploy and whenever migrations change.
# Safe to re-run — Alembic tracks what's already applied.

set -euo pipefail

COMPOSE="docker compose"

echo "=== Waiting for PostgreSQL ==="
until $COMPOSE exec -T postgres pg_isready -U "${DB_USER:-pos}" > /dev/null 2>&1; do
  echo "  Waiting..."
  sleep 2
done

echo "=== Running shared migrations ==="
$COMPOSE exec -T auth bash -c "cd /shared-migrations && alembic upgrade head" 2>&1 | grep -E "(Running upgrade|ERROR)" || true

echo "=== Running service migrations ==="
for svc in auth todos attachments notes documents vault kb photos watchlist portfolio expense-tracker; do
  echo "  Migrating $svc..."
  $COMPOSE exec -T "$svc" alembic upgrade head 2>&1 | grep -E "(Running upgrade|ERROR)" || true
done

echo "=== Done ==="
