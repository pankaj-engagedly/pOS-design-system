#!/bin/bash
# Deploy or update pOS on the server.
# Usage: ./deploy.sh
#
# Prerequisites:
#   - docker compose installed
#   - .env file with secrets
#   - Caddyfile configured with your domain
#   - Logged into ghcr.io: echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

set -euo pipefail

echo "=== Pulling latest images ==="
docker compose pull

echo "=== Starting services ==="
docker compose up -d --remove-orphans

echo "=== Running migrations ==="
./migrate.sh

echo "=== Status ==="
docker compose ps

echo ""
echo "Deploy complete!"
