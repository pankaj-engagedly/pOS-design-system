# pOS Deployment Guide

> A learn-and-do guide for deploying pOS from local dev to production.
> Each section explains **what** we're doing, **why** we're doing it, and **how** — step by step.

## Table of Contents

1. [Strategy Overview](#1-strategy-overview)
2. [Phase 1: Dockerize Everything](#2-phase-1-dockerize-everything)
3. [Phase 2: CI Pipeline (GitHub Actions)](#3-phase-2-ci-pipeline-github-actions)
4. [Phase 3: Docker Compose Production Deploy](#4-phase-3-docker-compose-production-deploy)
5. [Phase 4: Kubernetes with k3s](#5-phase-4-kubernetes-with-k3s)
6. [Phase 5: Storage Abstraction (R2)](#6-phase-5-storage-abstraction-r2)
7. [Reference: Port Map & Services](#7-reference-port-map--services)

---

## 1. Strategy Overview

### What are we deploying?

pOS is a monorepo with 13 moving parts:
- **1 frontend** (static files + nginx)
- **1 API gateway** (FastAPI, port 8000)
- **11 microservices** (FastAPI, ports 8001-8011)
- **1 PostgreSQL** database (shared, user_id-scoped)
- **1 RabbitMQ** message broker

### Two strategies, shared foundation

| | Strategy A: K8s Learning | Strategy B: Docker Compose |
|---|---|---|
| **Goal** | Learn Kubernetes hands-on | Simple, cost-effective personal deploy |
| **Orchestration** | k3s (lightweight K8s) | Docker Compose |
| **Reverse proxy** | Traefik (built into k3s) | Caddy (auto-TLS) |
| **GitOps** | ArgoCD | Simple `docker compose pull && up` |
| **IaC** | Terraform | Manual or simple scripts |

Both strategies share the same Docker images — that's why we Dockerize first.

### Infrastructure

| Resource | Choice | Why | Cost |
|---|---|---|---|
| VPS | See VPS options below | 4+ vCPU, 8GB RAM, 80GB+ | ~$7-12/mo |
| Object storage | Cloudflare R2 | S3-compatible, zero egress fees | ~$0.015/GB/mo |
| DB backups | Backblaze B2 | Cheapest cold storage | ~$0.50/mo |
| DNS/CDN | Cloudflare (free tier) | DDoS protection, edge caching | Free |
| **Total** | | | **~$10-15/mo** |

#### VPS options (India-friendly — no passport verification)

| Provider | Plan | Specs | Cost | Sign-up | Notes |
|---|---|---|---|---|---|
| **DigitalOcean** | Premium AMD 4vCPU | 4 vCPU, 8GB RAM, 100GB NVMe | $48/mo | Card only, instant | Great docs, Mumbai datacenter |
| **DigitalOcean** | Regular 4vCPU | 4 vCPU, 8GB RAM, 160GB | $32/mo | Card only, instant | Shared CPU, fine for personal use |
| **Vultr** | Cloud Compute 8GB | 4 vCPU, 8GB RAM, 200GB | $48/mo | Card, instant | Mumbai + Bangalore DCs |
| **Vultr** | Cloud Compute 4GB | 2 vCPU, 4GB RAM, 100GB | $24/mo | Card, instant | Tight but workable for pOS |
| **Oracle Cloud** | Ampere A1.Flex | 4 ARM vCPU, 24GB RAM, 200GB | **Free** | Card (no charge) | Always-free tier, Mumbai DC, best value if it works |
| **Linode (Akamai)** | Shared 8GB | 4 vCPU, 8GB RAM, 160GB | $48/mo | Card only, instant | Mumbai DC |
| **Railway** | Pro plan | Usage-based | ~$5-20/mo | GitHub auth | No server to manage, but less learning |

**Recommendation**: Start with **Oracle Cloud free tier** (24GB RAM is absurd for free). If Oracle is flaky or you want something simpler, **DigitalOcean** or **Vultr** with a Mumbai datacenter gives low latency from India and simple card-only signup. Both have student/startup credits too.

**Oracle Cloud Always-Free setup note**: The free ARM instance is fantastic but has limited availability — you may need to retry creation a few times. Once running, it's genuinely free forever (not a trial).

### Build order

```
Phase 1: Dockerize ──→ Phase 2: CI ──→ Phase 3: Compose Deploy ──→ Phase 4: K8s
     │                      │                    │                        │
     └ Foundation            └ Automation         └ Working prod           └ Learning
```

---

## 2. Phase 1: Dockerize Everything

### 2.1 Why Docker?

**The problem**: Your local dev runs 13+ processes, a Homebrew PostgreSQL, and a Docker RabbitMQ. Deploying this to a server means installing Python, Node, PostgreSQL, configuring each service... on every machine. One OS update can break everything.

**The solution**: Docker packages each service with its exact dependencies into an image. The image runs identically everywhere — your Mac, a CI server, a Hetzner VPS. This is the foundation for everything else.

**Key concepts to understand**:
- **Image**: A read-only template (like a class). Built from a `Dockerfile`.
- **Container**: A running instance of an image (like an object).
- **Layer caching**: Docker caches each `RUN`/`COPY` step. If nothing changed, it reuses the cache. This makes rebuilds fast. Order matters — put things that change least (dependencies) before things that change most (your code).
- **Multi-stage builds**: Use one stage to build, another to run. Keeps final images small.

### 2.2 Understanding the Dockerfile pattern for our services

All our backend services follow the same pattern. Let's understand it piece by piece:

```dockerfile
# ── Base image ──────────────────────────────────────────────
FROM python:3.12-slim AS base
# Why python:3.12-slim?
#   - Matches our local Python version (3.12)
#   - "slim" variant is ~120MB vs ~900MB for full — no gcc, no dev headers
#   - If a pip package needs compilation, we'd use a multi-stage build
#     (compile in full image, copy wheel to slim)

WORKDIR /app
# All subsequent commands run from /app inside the container

# ── Layer 1: Shared library (changes rarely) ────────────────
COPY shared/ /shared/
RUN pip install --no-cache-dir /shared
# Why install shared first?
#   - pos_contracts and pos_events change infrequently
#   - Docker caches this layer — won't reinstall on every code change
#   - --no-cache-dir: don't store pip's download cache (saves ~50MB)

# ── Layer 2: Service dependencies (changes occasionally) ────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# Same caching strategy: requirements.txt changes less than app code

# ── Layer 3: Application code (changes frequently) ──────────
COPY app/ app/
# This layer rebuilds on every code change, but layers above are cached

# ── Layer 4: Migrations (for services that have them) ───────
COPY alembic.ini .
COPY migrations/ migrations/
# Alembic config + migration scripts — needed for db-migrate on deploy

# ── Runtime config ──────────────────────────────────────────
EXPOSE 8000
# Documentation only — doesn't actually open the port
# The actual port mapping happens in docker-compose or k8s

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
# Why 0.0.0.0?
#   - Locally, uvicorn binds to 127.0.0.1 (localhost only)
#   - In a container, 127.0.0.1 means "only inside this container"
#   - 0.0.0.0 means "accept connections from anywhere" — needed for
#     Docker networking to route traffic into the container
```

### 2.3 The Docker build context problem

**Important concept**: When you run `docker build`, Docker sends a "build context" (a directory) to the Docker daemon. `COPY` paths are relative to this context.

Our services need `../shared/` (the shared library), but Docker can't copy files outside the build context. Solutions:

| Approach | Pros | Cons |
|---|---|---|
| Build from repo root with `-f` flag | Simple, all files accessible | Sends entire repo as context (slow) |
| `.dockerignore` + root context | Fast after ignore | Need to maintain ignore file |
| **BuildKit with `--build-context`** | Clean, explicit | Requires BuildKit (default since Docker 23) |

**We'll use**: Root context + `.dockerignore`. It's the most compatible and straightforward.

```bash
# Build from repo root, point to service's Dockerfile
docker build -f backend/services/todos/Dockerfile -t pos-todos .
```

### 2.4 Step-by-step: Create the Dockerfiles

#### Step 1: Create the shared backend Dockerfile template

Every service Dockerfile follows the same pattern. The only differences are:
- The service directory path
- The port number
- Whether it has migrations

We'll create a `Dockerfile` inside each service directory.

#### Step 2: Create `.dockerignore` in repo root

```
# Why .dockerignore?
# Without it, `docker build .` sends EVERYTHING to the daemon:
#   - node_modules (~500MB)
#   - .git (~100MB+)
#   - Python venvs
#   - uploaded data files
# With it, builds are fast and images are clean.

# Version control
.git
.gitignore

# Node
**/node_modules

# Python
**/__pycache__
**/*.pyc
**/.venv
backend/.venv

# IDE
.vscode
.idea
**/.DS_Store

# Data & uploads (never bake user data into images)
**/data/
**/uploads/

# Docs & config
docs/
*.md
!requirements.txt
LICENSE

# Frontend build artifacts (handled separately)
design-system/node_modules

# Infrastructure (not needed in app images)
infra/k8s/
infra/docker/
```

#### Step 3: Create Dockerfiles for each service

Here's the concrete plan. Each service gets a `Dockerfile`:

**Gateway** (`backend/gateway/Dockerfile`) — already exists, needs update for build context:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Shared library
COPY backend/shared/ /shared/
RUN pip install --no-cache-dir /shared

# Dependencies
COPY backend/gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY backend/gateway/app/ app/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Service template** (e.g., `backend/services/todos/Dockerfile`):
```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Shared library
COPY backend/shared/ /shared/
RUN pip install --no-cache-dir /shared

# Dependencies
COPY backend/services/todos/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code + migrations
COPY backend/services/todos/app/ app/
COPY backend/services/todos/alembic.ini .
COPY backend/services/todos/migrations/ migrations/

EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
```

**Frontend** (`infra/docker/Dockerfile.frontend`):
```dockerfile
# ── Stage 1: Build design system ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /build

# Install design system dependencies
COPY design-system/package*.json design-system/
RUN cd design-system && npm ci
# Why npm ci instead of npm install?
#   - ci = "clean install" — deletes node_modules first
#   - Installs exactly what's in package-lock.json (reproducible)
#   - Faster in CI/Docker (no dependency resolution)

# Build design system bundle
COPY design-system/ design-system/
RUN cd design-system && npm run build

# ── Stage 2: Serve with nginx ──────────────────────────────
FROM nginx:alpine

# Why nginx:alpine?
#   - Alpine Linux is ~5MB (vs ~80MB for Debian)
#   - nginx serves static files with zero overhead
#   - We don't need Node.js at runtime — it was only for building

COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf

# Design system built assets
COPY --from=builder /build/design-system/dist/ /usr/share/nginx/html/design-system/dist/

# Frontend source (no build step — vanilla JS)
COPY frontend/ /usr/share/nginx/html/frontend/

EXPOSE 80
```

#### Step 4: Build and test locally

```bash
# Build one service to verify
docker build -f backend/services/todos/Dockerfile -t pos-todos .

# Test it runs (won't fully work without DB, but should start)
docker run --rm -p 8002:8002 \
  -e DATABASE_URL=postgresql+asyncpg://pos:pos@host.docker.internal:5432/pos \
  pos-todos

# host.docker.internal is a special DNS name that Docker Desktop provides
# It resolves to your Mac's localhost — so the container can reach your local PostgreSQL
```

#### Step 5: Create `docker-compose.dev.yml` for local Docker testing

```yaml
# This is NOT for production — it's for testing your Docker images locally
# It replaces `make dev` with containers to verify everything works containerized

version: "3.8"

x-common-env: &common-env
  DATABASE_URL: postgresql+asyncpg://pos:pos@postgres:5432/pos
  RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672/
  # Why different URLs than local dev?
  #   - "postgres" and "rabbitmq" are Docker service names
  #   - Docker Compose creates a network where services can reach
  #     each other by name (built-in DNS)

services:
  # ── Infrastructure ──────────────────────────────────────
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: pos
      POSTGRES_PASSWORD: pos
      POSTGRES_DB: pos
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Why a named volume?
    #   - Data persists across container restarts
    #   - Without it, you lose your DB every time you stop
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U pos"]
      interval: 5s
      retries: 5

  rabbitmq:
    image: rabbitmq:3.13-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 10s
      retries: 5

  # ── Gateway ─────────────────────────────────────────────
  gateway:
    build:
      context: .
      dockerfile: backend/gateway/Dockerfile
    ports:
      - "8000:8000"
    environment:
      <<: *common-env
      JWT_SECRET_KEY: dev-secret-key-change-in-production
      # Services the gateway proxies to — using Docker service names
      AUTH_SERVICE_URL: http://auth:8001
      TODOS_SERVICE_URL: http://todos:8002
      ATTACHMENTS_SERVICE_URL: http://attachments:8003
      NOTES_SERVICE_URL: http://notes:8004
      DOCUMENTS_SERVICE_URL: http://documents:8005
      VAULT_SERVICE_URL: http://vault:8006
      KB_SERVICE_URL: http://kb:8007
      PHOTOS_SERVICE_URL: http://photos:8008
      WATCHLIST_SERVICE_URL: http://watchlist:8009
      PORTFOLIO_SERVICE_URL: http://portfolio:8010
      EXPENSE_TRACKER_SERVICE_URL: http://expense-tracker:8011
    depends_on:
      postgres:
        condition: service_healthy

  # ── Services ────────────────────────────────────────────
  auth:
    build:
      context: .
      dockerfile: backend/services/auth/Dockerfile
    environment:
      <<: *common-env
      JWT_SECRET_KEY: dev-secret-key-change-in-production
      APP_SECRET_KEY: dev-app-secret-change-in-production
      SERVICE_PORT: "8001"
    depends_on:
      postgres:
        condition: service_healthy

  todos:
    build:
      context: .
      dockerfile: backend/services/todos/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8002"
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy

  attachments:
    build:
      context: .
      dockerfile: backend/services/attachments/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8003"
    volumes:
      - attachments-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy

  notes:
    build:
      context: .
      dockerfile: backend/services/notes/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8004"
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy

  documents:
    build:
      context: .
      dockerfile: backend/services/documents/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8005"
    volumes:
      - documents-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy

  vault:
    build:
      context: .
      dockerfile: backend/services/vault/Dockerfile
    environment:
      <<: *common-env
      APP_SECRET_KEY: dev-app-secret-change-in-production
      SERVICE_PORT: "8006"
    depends_on:
      postgres:
        condition: service_healthy

  kb:
    build:
      context: .
      dockerfile: backend/services/kb/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8007"
    volumes:
      - kb-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy

  photos:
    build:
      context: .
      dockerfile: backend/services/photos/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8008"
    volumes:
      - photos-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy

  watchlist:
    build:
      context: .
      dockerfile: backend/services/watchlist/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8009"
    depends_on:
      postgres:
        condition: service_healthy

  portfolio:
    build:
      context: .
      dockerfile: backend/services/portfolio/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8010"
    volumes:
      - portfolio-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy

  expense-tracker:
    build:
      context: .
      dockerfile: backend/services/expense_tracker/Dockerfile
    environment:
      <<: *common-env
      SERVICE_PORT: "8011"
    volumes:
      - expense-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy

  # ── Frontend ────────────────────────────────────────────
  frontend:
    build:
      context: .
      dockerfile: infra/docker/Dockerfile.frontend
    ports:
      - "3001:80"
    depends_on:
      - gateway

volumes:
  pgdata:
  attachments-data:
  documents-data:
  kb-data:
  photos-data:
  portfolio-data:
  expense-data:
```

### 2.5 Environment variables & secrets

**The principle**: Never bake secrets into Docker images. Images are stored in registries and can be inspected. Instead, inject secrets at runtime via environment variables.

| Variable | Where it comes from | Local dev | Production |
|---|---|---|---|
| `DATABASE_URL` | docker-compose env / K8s Secret | Hardcoded in compose | K8s Secret |
| `JWT_SECRET_KEY` | docker-compose env / K8s Secret | `dev-secret-key` | Generated, stored in Secret |
| `APP_SECRET_KEY` | docker-compose env / K8s Secret | `dev-app-secret` | Generated, stored in Secret |
| `RABBITMQ_URL` | docker-compose env / K8s Secret | Default guest/guest | Generated credentials |

**For production**, we'll generate strong secrets:
```bash
# Generate a secure random key
openssl rand -hex 32
```

### 2.6 Migrations strategy

**The question**: How do we run Alembic migrations in production?

**The answer**: As an init container (K8s) or a one-shot service (Compose). NOT inside the app startup.

**Why not run migrations on app start?**
- If you have 3 replicas of `todos`, all 3 would try to migrate simultaneously
- Alembic isn't designed for concurrent execution — you'll get lock conflicts
- A failed migration shouldn't prevent you from rolling back the app

```bash
# In Docker Compose, run migrations as a one-shot command:
docker compose run --rm todos alembic upgrade head

# In K8s, we'll use init containers (covered in Phase 4)
```

### 2.7 Checklist: Phase 1 complete when...

- [ ] Every service has a `Dockerfile`
- [ ] `.dockerignore` exists at repo root
- [ ] `docker-compose.dev.yml` starts the full stack
- [ ] All services pass health checks in containers
- [ ] Migrations run successfully against containerized PostgreSQL
- [ ] Frontend serves correctly through nginx
- [ ] You can log in, create a todo, and see it — all in containers

---

## 3. Phase 2: CI Pipeline (GitHub Actions)

### 3.1 Why CI?

**The problem**: You push code, SSH into the server, pull, rebuild, restart. Miss a step? Something's broken. Forget to run tests? Bug in production.

**The solution**: CI (Continuous Integration) automates: test → build → push images → (optionally) deploy. Every push triggers the same reliable pipeline.

**Why GitHub Actions?**
- Free for public repos, 2000 min/month for private
- Built into GitHub — no extra service to manage
- YAML config lives in your repo (`.github/workflows/`)
- Great marketplace of reusable actions

### 3.2 Container Registry: GitHub Container Registry (ghcr.io)

**Why ghcr.io?**
- Free for public images, generous limits for private
- Integrated with GitHub (same auth, same org)
- No separate account needed (vs Docker Hub, which has pull rate limits)

**How it works**:
```
Push code → GitHub Actions builds image → Pushes to ghcr.io/pankaj/pos-todos:latest
                                                          ↑
                                                Your GitHub username
```

### 3.3 The CI workflow

```yaml
# .github/workflows/ci.yml
name: CI

# ── When to run ─────────────────────────────────────────────
on:
  push:
    branches: [main]
    # Why only main?
    #   - Feature branches get tested on PR (below)
    #   - Only main pushes build and publish Docker images
    #   - Keeps your registry clean
  pull_request:
    branches: [main]

# ── Permissions ─────────────────────────────────────────────
permissions:
  contents: read
  packages: write  # Needed to push to ghcr.io

# ── Environment variables ───────────────────────────────────
env:
  REGISTRY: ghcr.io
  # Why lowercase? Docker image names must be lowercase
  IMAGE_PREFIX: ghcr.io/${{ github.repository_owner }}

jobs:
  # ── Job 1: Test ──────────────────────────────────────────
  test:
    runs-on: ubuntu-latest
    # Why ubuntu-latest?
    #   - GitHub's hosted runners are free
    #   - Ubuntu has Docker pre-installed
    #   - ARM builds need special handling (QEMU or ARM runners)

    services:
      # GitHub Actions can spin up service containers alongside your job
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: pos
          POSTGRES_PASSWORD: pos
          POSTGRES_DB: pos_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      # Design system tests
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: design-system/package-lock.json
      - run: cd design-system && npm ci && npm test

      # Backend tests
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: |
          cd backend
          python -m venv .venv
          source .venv/bin/activate
          pip install shared/
          # Install all service dependencies
          for svc in services/*/; do
            pip install -r "$svc/requirements.txt"
          done
          python -m pytest services/ -v
        env:
          DATABASE_URL: postgresql+asyncpg://pos:pos@localhost:5432/pos_test

  # ── Job 2: Build & Push Docker Images ────────────────────
  build:
    needs: test  # Only build if tests pass
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # Why this condition?
    #   - PRs run tests but don't publish images
    #   - Only merged-to-main code gets built and pushed
    runs-on: ubuntu-latest

    strategy:
      matrix:
        # Build all services in parallel
        # Why a matrix?
        #   - Each service builds independently
        #   - GitHub runs them in parallel (up to 20 concurrent)
        #   - A failing service build doesn't block others
        service:
          - { name: gateway, dockerfile: backend/gateway/Dockerfile }
          - { name: auth, dockerfile: backend/services/auth/Dockerfile }
          - { name: todos, dockerfile: backend/services/todos/Dockerfile }
          - { name: attachments, dockerfile: backend/services/attachments/Dockerfile }
          - { name: notes, dockerfile: backend/services/notes/Dockerfile }
          - { name: documents, dockerfile: backend/services/documents/Dockerfile }
          - { name: vault, dockerfile: backend/services/vault/Dockerfile }
          - { name: kb, dockerfile: backend/services/kb/Dockerfile }
          - { name: photos, dockerfile: backend/services/photos/Dockerfile }
          - { name: watchlist, dockerfile: backend/services/watchlist/Dockerfile }
          - { name: portfolio, dockerfile: backend/services/portfolio/Dockerfile }
          - { name: expense-tracker, dockerfile: backend/services/expense_tracker/Dockerfile }
          - { name: frontend, dockerfile: infra/docker/Dockerfile.frontend }

    steps:
      - uses: actions/checkout@v4

      # Docker Buildx gives us multi-platform builds + better caching
      - uses: docker/setup-buildx-action@v3

      # Authenticate to GitHub Container Registry
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          # GITHUB_TOKEN is automatically available — no manual secret setup!

      # Build and push
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ${{ matrix.service.dockerfile }}
          push: true
          tags: |
            ${{ env.IMAGE_PREFIX }}/pos-${{ matrix.service.name }}:latest
            ${{ env.IMAGE_PREFIX }}/pos-${{ matrix.service.name }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          # Why two tags?
          #   - :latest — always points to the newest build (for quick deploys)
          #   - :sha — immutable reference to this exact commit (for rollbacks)
          # Why GHA cache?
          #   - GitHub Actions cache stores Docker layers between builds
          #   - Dramatically speeds up builds when only app code changes
```

### 3.4 Multi-platform builds (ARM for Hetzner)

**The catch**: Your Mac has Apple Silicon (ARM). Hetzner CAX21 is also ARM. But GitHub Actions runners are x86.

**The solution**: QEMU emulation or native ARM runners.

```yaml
      # Add this step before build-push-action:
      - uses: docker/setup-qemu-action@v3
        # QEMU lets x86 runners build ARM images
        # It's slower (~2-3x) but works reliably

      - uses: docker/build-push-action@v5
        with:
          platforms: linux/arm64
          # Why only arm64?
          #   - Our Hetzner box is ARM
          #   - Building for both amd64+arm64 doubles build time
          #   - We only need ARM for production
          # ...rest of config
```

**Alternative**: GitHub now offers ARM runners (`ubuntu-latest-arm64`) — faster but may cost more.

### 3.5 Checklist: Phase 2 complete when...

- [ ] `.github/workflows/ci.yml` exists
- [ ] Push to main triggers: test → build → push to ghcr.io
- [ ] PR opens trigger: test only (no image push)
- [ ] All 13 images appear at `ghcr.io/<your-username>/pos-*`
- [ ] Images are tagged with both `:latest` and `:sha`

---

## 4. Phase 3: Docker Compose Production Deploy

### 4.1 Why Compose first (before K8s)?

**Pragmatic reasoning**:
- Docker Compose is one file, one command. K8s is dozens of files and concepts.
- You get a working production deploy in a day, not a week.
- If anything breaks with K8s later, you have a known-good fallback.
- The images are the same — switching orchestrators doesn't require rebuilding anything.

### 4.2 Provision a VPS

#### Step 1: Create the server

Pick your provider (see VPS options in Section 1) and create a server:

- **OS**: Ubuntu 24.04 LTS (5 years of security updates, most guides assume it)
- **Specs**: 4+ vCPU, 8GB RAM, 80GB+ disk
- **Region**: Mumbai (or closest to you for low latency)
- **Auth**: Add your SSH public key (`~/.ssh/id_ed25519.pub`)

**Example with DigitalOcean:**
```bash
# Via doctl CLI
brew install doctl
doctl auth init  # Enter your API token

doctl compute droplet create pos-prod \
  --image ubuntu-24-04-x64 \
  --size s-4vcpu-8gb \
  --region blr1 \
  --ssh-keys <your-key-fingerprint>
```

**Example with Oracle Cloud (free tier):**
```bash
# Via OCI CLI or web console
# Console: Compute → Instances → Create Instance
# - Image: Ubuntu 24.04
# - Shape: VM.Standard.A1.Flex (ARM) — 4 OCPU, 24GB RAM
# - Boot volume: 200GB (free up to 200GB)
# - Add your SSH key
```

#### Step 2: Initial server setup

```bash
# SSH into your new server
ssh root@<server-ip>

# ── Security basics ─────────────────────────────────────────

# Update system
apt update && apt upgrade -y

# Create a non-root user
# Why? Running everything as root is dangerous — one compromised service
# gets full system access. A regular user limits blast radius.
adduser pankaj
usermod -aG sudo pankaj

# Copy SSH key to new user
mkdir -p /home/pankaj/.ssh
cp ~/.ssh/authorized_keys /home/pankaj/.ssh/
chown -R pankaj:pankaj /home/pankaj/.ssh

# Disable root login & password auth
# Why? Bots constantly try root:password on every public server.
# Key-only auth is virtually unbreakable.
sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# ── Firewall ────────────────────────────────────────────────
# Why UFW? Simple firewall that blocks everything except what you allow.
ufw allow OpenSSH
ufw allow 80/tcp    # HTTP (for Let's Encrypt challenge)
ufw allow 443/tcp   # HTTPS
ufw enable

# ── Install Docker ──────────────────────────────────────────
# Why not snap or apt docker.io? Docker's official repo has the latest version
# and is the only one they support.
curl -fsSL https://get.docker.com | sh
usermod -aG docker pankaj
# Adding to docker group lets pankaj run docker without sudo

# Logout and back in as pankaj
exit
ssh pankaj@<server-ip>
docker --version  # Verify it works
```

#### Step 3: Set up DNS

```
# In Cloudflare DNS (or your registrar):
# A    pos.yourdomain.com    → <server-ip>
# AAAA pos.yourdomain.com    → <server-ipv6>    (optional)

# Why Cloudflare?
#   - Free DDoS protection
#   - Free SSL/TLS (even if you also use Let's Encrypt)
#   - Edge caching for static assets
#   - DNS propagates in seconds (vs hours for some registrars)
```

### 4.3 Production `docker-compose.yml`

```yaml
# docker-compose.prod.yml
# This file lives on your server at ~/pos/docker-compose.yml

version: "3.8"

x-common-env: &common-env
  DATABASE_URL: postgresql+asyncpg://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
  RABBITMQ_URL: amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672/
  JWT_SECRET_KEY: ${JWT_SECRET_KEY}
  APP_SECRET_KEY: ${APP_SECRET_KEY}
  # Why ${VARIABLES}?
  #   - Values come from a .env file (not checked into git)
  #   - docker compose automatically reads .env in the same directory
  #   - Secrets never appear in docker-compose.yml (which IS in git)

x-common-config: &common-config
  restart: unless-stopped
  # Why unless-stopped?
  #   - Restarts on crash (OOM, unhandled exception)
  #   - Stays stopped if you manually stop it (for maintenance)
  #   - "always" would restart even after manual stop — annoying
  logging:
    driver: json-file
    options:
      max-size: "10m"
      max-file: "3"
    # Why limit logs?
    #   - Docker logs grow unbounded by default
    #   - 10m × 3 files = 30MB per service max
    #   - Without this, your 80GB disk fills up in months

services:
  # ── Reverse Proxy ───────────────────────────────────────
  caddy:
    image: caddy:2-alpine
    # Why Caddy instead of nginx/Traefik?
    #   - Automatic HTTPS (Let's Encrypt) with zero config
    #   - Simple Caddyfile syntax
    #   - Perfect for single-server Docker Compose
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data      # TLS certificates
      - caddy-config:/config
    <<: *common-config

  # ── Infrastructure ──────────────────────────────────────
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      retries: 5
    <<: *common-config
    # No ports exposed! Only accessible from within Docker network.
    # Why? PostgreSQL should never be internet-accessible.

  rabbitmq:
    image: rabbitmq:3.13-alpine
    # Note: NOT management-alpine in prod — no need for the web UI
    # If you need to debug, you can temporarily switch to management
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASS}
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "check_port_connectivity"]
      interval: 30s
      retries: 3
    <<: *common-config

  # ── Gateway ─────────────────────────────────────────────
  gateway:
    image: ghcr.io/<your-username>/pos-gateway:latest
    environment:
      <<: *common-env
      AUTH_SERVICE_URL: http://auth:8001
      TODOS_SERVICE_URL: http://todos:8002
      ATTACHMENTS_SERVICE_URL: http://attachments:8003
      NOTES_SERVICE_URL: http://notes:8004
      DOCUMENTS_SERVICE_URL: http://documents:8005
      VAULT_SERVICE_URL: http://vault:8006
      KB_SERVICE_URL: http://kb:8007
      PHOTOS_SERVICE_URL: http://photos:8008
      WATCHLIST_SERVICE_URL: http://watchlist:8009
      PORTFOLIO_SERVICE_URL: http://portfolio:8010
      EXPENSE_TRACKER_SERVICE_URL: http://expense-tracker:8011
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  # ── Services (all follow same pattern) ──────────────────
  auth:
    image: ghcr.io/<your-username>/pos-auth:latest
    environment:
      <<: *common-env
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  todos:
    image: ghcr.io/<your-username>/pos-todos:latest
    environment:
      <<: *common-env
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    <<: *common-config

  attachments:
    image: ghcr.io/<your-username>/pos-attachments:latest
    environment:
      <<: *common-env
    volumes:
      - attachments-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  notes:
    image: ghcr.io/<your-username>/pos-notes:latest
    environment:
      <<: *common-env
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    <<: *common-config

  documents:
    image: ghcr.io/<your-username>/pos-documents:latest
    environment:
      <<: *common-env
    volumes:
      - documents-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  vault:
    image: ghcr.io/<your-username>/pos-vault:latest
    environment:
      <<: *common-env
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  kb:
    image: ghcr.io/<your-username>/pos-kb:latest
    environment:
      <<: *common-env
    volumes:
      - kb-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    <<: *common-config

  photos:
    image: ghcr.io/<your-username>/pos-photos:latest
    environment:
      <<: *common-env
    volumes:
      - photos-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  watchlist:
    image: ghcr.io/<your-username>/pos-watchlist:latest
    environment:
      <<: *common-env
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  portfolio:
    image: ghcr.io/<your-username>/pos-portfolio:latest
    environment:
      <<: *common-env
    volumes:
      - portfolio-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  expense-tracker:
    image: ghcr.io/<your-username>/pos-expense-tracker:latest
    environment:
      <<: *common-env
    volumes:
      - expense-data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
    <<: *common-config

  # ── Frontend ────────────────────────────────────────────
  frontend:
    image: ghcr.io/<your-username>/pos-frontend:latest
    # No exposed ports — Caddy proxies to it
    <<: *common-config

volumes:
  pgdata:
  rabbitmq-data:
  caddy-data:
  caddy-config:
  attachments-data:
  documents-data:
  kb-data:
  photos-data:
  portfolio-data:
  expense-data:
```

### 4.4 Caddy reverse proxy

```
# Caddyfile — lives alongside docker-compose.yml on the server

pos.yourdomain.com {
    # Caddy automatically:
    #   1. Gets a Let's Encrypt TLS certificate
    #   2. Redirects HTTP → HTTPS
    #   3. Renews the cert before expiry
    # Zero config needed. This is why we chose Caddy.

    # API requests → gateway
    handle /api/* {
        reverse_proxy gateway:8000
    }

    # Everything else → frontend (nginx serving static files)
    handle {
        reverse_proxy frontend:80
    }

    # Security headers
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        # Why these headers?
        #   - nosniff: prevents browser from guessing content types (XSS vector)
        #   - DENY frames: prevents clickjacking (someone embedding your app in an iframe)
        #   - Referrer: limits info leaked when navigating to external sites
    }
}
```

### 4.5 The `.env` file (on server only)

```bash
# ~/pos/.env — NEVER commit this file
# Generate secrets with: openssl rand -hex 32

DB_USER=pos
DB_PASS=<generated-strong-password>
DB_NAME=pos

RABBITMQ_USER=pos
RABBITMQ_PASS=<generated-strong-password>

JWT_SECRET_KEY=<generated-64-char-hex>
APP_SECRET_KEY=<generated-64-char-hex>
```

### 4.6 Deploy script

```bash
#!/bin/bash
# ~/pos/deploy.sh — run this to deploy or update

set -euo pipefail
# What does this do?
#   -e: exit immediately if any command fails
#   -u: treat unset variables as errors
#   -o pipefail: pipe fails if any command in the pipe fails
# These three flags catch 90% of bash scripting bugs

echo "=== Pulling latest images ==="
docker compose pull
# Downloads newest :latest images from ghcr.io

echo "=== Running migrations ==="
# Run migrations for each service that has them
# Why one at a time? Each service has its own Alembic version table.
# They don't conflict, but sequential is safer and easier to debug.
for service in auth todos attachments notes documents vault kb photos watchlist portfolio expense-tracker; do
  echo "  Migrating $service..."
  docker compose run --rm "$service" alembic upgrade head 2>/dev/null || true
done

echo "=== Deploying ==="
docker compose up -d --remove-orphans
# -d: detached (runs in background)
# --remove-orphans: removes containers for services removed from compose file

echo "=== Waiting for health checks ==="
sleep 10
docker compose ps

echo "=== Done! ==="
```

### 4.7 Backups

```bash
#!/bin/bash
# ~/pos/backup.sh — run via cron daily

set -euo pipefail

BACKUP_DIR="/tmp/pos-backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# ── Database backup ─────────────────────────────────────────
echo "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U pos pos | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"
# Why pg_dump (not filesystem copy)?
#   - pg_dump creates a logical backup (SQL statements)
#   - Works while the database is running (consistent snapshot)
#   - Can restore to a different PostgreSQL version
#   - Filesystem copies require stopping PostgreSQL or using pg_basebackup

# ── Upload to Backblaze B2 ─────────────────────────────────
# Install: pip install b2
b2 upload-file pos-backups "$BACKUP_DIR/db_$DATE.sql.gz" "db/$DATE.sql.gz"

# ── Cleanup old local backups (keep 7 days) ────────────────
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete

echo "Backup complete: db_$DATE.sql.gz"
```

**Cron setup**:
```bash
# Run daily at 3 AM server time
crontab -e
# Add: 0 3 * * * /home/pankaj/pos/backup.sh >> /home/pankaj/pos/backup.log 2>&1
```

### 4.8 Monitoring (simple)

For a personal app, full observability (Prometheus + Grafana) is overkill. Start simple:

```bash
# Check if everything is running
docker compose ps

# Check logs for a specific service
docker compose logs -f gateway --tail=100

# Check resource usage
docker stats --no-stream

# Simple uptime check (add to cron, every 5 min)
curl -sf https://pos.yourdomain.com/api/auth/health || echo "POS IS DOWN" | mail -s "Alert" you@email.com
```

### 4.9 Checklist: Phase 3 complete when...

- [ ] Hetzner VPS provisioned and secured
- [ ] DNS pointing to server
- [ ] `docker-compose.prod.yml` + `Caddyfile` + `.env` on server
- [ ] `docker compose up -d` brings up all services
- [ ] HTTPS works (Caddy auto-cert)
- [ ] Can log in and use the app from `https://pos.yourdomain.com`
- [ ] Backup script runs daily
- [ ] Deploy script works: push to main → CI builds → run `deploy.sh` on server

---

## 5. Phase 4: Kubernetes with k3s

### 5.1 Why Kubernetes? (And why learn it now?)

**What K8s gives you that Compose doesn't**:

| Feature | Docker Compose | Kubernetes |
|---|---|---|
| Self-healing | `restart: unless-stopped` | Full health-check + auto-replace |
| Rolling updates | Stop → pull → start (downtime) | Zero-downtime rolling deploys |
| Config management | `.env` file | Secrets, ConfigMaps (encrypted at rest) |
| Scaling | Manual (`replicas: 3`) | Auto-scaling based on CPU/memory |
| Declarative state | Mostly | Fully — "I want 3 replicas" and K8s maintains it |
| GitOps | Manual | ArgoCD watches git, auto-deploys |
| Service discovery | Docker DNS | Full DNS + load balancing |
| Resource limits | Optional | First-class (prevent one service eating all RAM) |

**For a personal app, you don't NEED K8s.** But the learning value is enormous — it's the industry standard for container orchestration.

### 5.2 k3s: Lightweight Kubernetes

**Why k3s instead of full K8s?**
- Full K8s needs 3+ nodes and 4GB+ RAM just for the control plane
- k3s runs on a single node with ~512MB RAM overhead
- It IS real Kubernetes — same API, same `kubectl`, same manifests
- Built-in Traefik (ingress), CoreDNS (service discovery), local-path storage
- Made by Rancher (now SUSE) — battle-tested, widely used

### 5.3 Key Kubernetes concepts (the mental model)

Before diving into config files, understand the building blocks:

```
┌─────────────────────────────────────────────────────────┐
│  Cluster (your k3s installation)                         │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Namespace: pos  (isolation boundary)               │ │
│  │                                                      │ │
│  │  ┌─── Deployment ──────────────────────────────┐    │ │
│  │  │  "I want 1 replica of pos-todos"             │    │ │
│  │  │                                              │    │ │
│  │  │  ┌─── Pod ─────────────────────────────┐    │    │ │
│  │  │  │  ┌─── Container ──────────────┐     │    │    │ │
│  │  │  │  │  pos-todos:abc123          │     │    │    │ │
│  │  │  │  │  (your Docker image)       │     │    │    │ │
│  │  │  │  └────────────────────────────┘     │    │    │ │
│  │  │  │  ┌─── Init Container ─────────┐    │    │    │ │
│  │  │  │  │  alembic upgrade head      │    │    │    │ │
│  │  │  │  └────────────────────────────┘    │    │    │ │
│  │  │  └─────────────────────────────────────┘    │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │                                                      │ │
│  │  ┌─── Service ─────────────────────────────────┐    │ │
│  │  │  "pos-todos on port 8002"                    │    │ │
│  │  │  (stable DNS name + load balancer)           │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │                                                      │ │
│  │  ┌─── Ingress ─────────────────────────────────┐    │ │
│  │  │  "pos.domain.com/api/* → gateway service"    │    │ │
│  │  │  (external traffic routing + TLS)            │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │                                                      │ │
│  │  ┌─── Secret ──────────────────────────────────┐    │ │
│  │  │  DATABASE_URL, JWT_SECRET_KEY, etc.          │    │ │
│  │  │  (base64 encoded, can be encrypted at rest)  │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  │                                                      │ │
│  │  ┌─── PersistentVolumeClaim ───────────────────┐    │ │
│  │  │  "10Gi for PostgreSQL data"                  │    │ │
│  │  │  (survives pod restarts)                     │    │ │
│  │  └─────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Analogy to things you know**:
| K8s Concept | Docker Compose Equivalent | Ruby/Rails Equivalent |
|---|---|---|
| Pod | Container | Process |
| Deployment | `services.todos` section | Puma config (desired workers) |
| Service | Docker network DNS | Internal load balancer |
| Ingress | Caddy/nginx reverse proxy | Rack routing |
| Secret | `.env` file | `credentials.yml.enc` |
| Namespace | — | Different environments |
| ConfigMap | — | `config/settings.yml` |

### 5.4 Install k3s on Hetzner

```bash
# SSH into your server
ssh pankaj@<server-ip>

# Install k3s (single command!)
curl -sfL https://get.k3s.io | sh -
# What this does:
#   1. Downloads k3s binary
#   2. Sets up systemd service (auto-starts on boot)
#   3. Installs kubectl (as k3s kubectl)
#   4. Starts the Kubernetes API server, scheduler, controller
#   5. Installs Traefik (ingress controller)
#   6. Installs CoreDNS (cluster DNS)
#   7. Installs local-path-provisioner (storage)

# Verify it's running
sudo k3s kubectl get nodes
# NAME       STATUS   ROLES                  AGE   VERSION
# pos-prod   Ready    control-plane,master   1m    v1.29.x+k3s1

# Set up kubectl for your user (so you don't need sudo)
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown pankaj:pankaj ~/.kube/config
export KUBECONFIG=~/.kube/config  # Add to ~/.bashrc

# Now you can use kubectl directly
kubectl get nodes
kubectl get pods -A  # -A = all namespaces (shows system pods)
```

**Access kubectl from your Mac** (optional but nice):
```bash
# On your Mac:
scp pankaj@<server-ip>:~/.kube/config ~/.kube/pos-prod-config

# Edit the file: change "server: https://127.0.0.1:6443" to
# "server: https://<server-ip>:6443"

# Then:
export KUBECONFIG=~/.kube/pos-prod-config
kubectl get nodes  # Works remotely!
```

### 5.5 Kubernetes manifests

We'll organize manifests in `infra/k8s/`:

```
infra/k8s/
├── namespace.yml          # Isolation boundary
├── secrets.yml            # Database URLs, JWT keys (not in git!)
├── postgres/
│   ├── pvc.yml            # Persistent storage
│   ├── deployment.yml     # PostgreSQL pod
│   └── service.yml        # Internal DNS name
├── rabbitmq/
│   ├── pvc.yml
│   ├── deployment.yml
│   └── service.yml
├── gateway/
│   ├── deployment.yml
│   └── service.yml
├── services/
│   ├── auth.yml           # Deployment + Service in one file
│   ├── todos.yml
│   ├── attachments.yml
│   ├── notes.yml
│   ├── documents.yml
│   ├── vault.yml
│   ├── kb.yml
│   ├── photos.yml
│   ├── watchlist.yml
│   ├── portfolio.yml
│   └── expense-tracker.yml
├── frontend/
│   ├── deployment.yml
│   └── service.yml
└── ingress.yml            # External traffic routing + TLS
```

#### Namespace

```yaml
# infra/k8s/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: pos
# Why a namespace?
#   - Isolates pOS resources from system pods (kube-system, traefik)
#   - You can set resource quotas per namespace
#   - `kubectl get pods -n pos` shows only your stuff
#   - Makes cleanup easy: `kubectl delete namespace pos` removes everything
```

#### Secrets

```yaml
# infra/k8s/secrets.yml — DO NOT commit this file!
# Create it manually on the server or use sealed-secrets
apiVersion: v1
kind: Secret
metadata:
  name: pos-secrets
  namespace: pos
type: Opaque
stringData:
  # stringData accepts plain text (K8s base64-encodes it for storage)
  DATABASE_URL: postgresql+asyncpg://pos:STRONG_PASSWORD@postgres:5432/pos
  RABBITMQ_URL: amqp://pos:STRONG_PASSWORD@rabbitmq:5672/
  JWT_SECRET_KEY: your-64-char-hex-here
  APP_SECRET_KEY: your-64-char-hex-here
```

#### PostgreSQL

```yaml
# infra/k8s/postgres/pvc.yml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: pos
spec:
  accessModes:
    - ReadWriteOnce
    # Why ReadWriteOnce?
    #   - Only one pod can mount this volume at a time
    #   - PostgreSQL can't share its data directory between instances
    #   - ReadWriteMany would be for shared file storage (NFS)
  resources:
    requests:
      storage: 10Gi
  # k3s local-path-provisioner automatically creates a directory on the host
  # For production with more data, you'd use Hetzner's block storage volumes

---
# infra/k8s/postgres/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: pos
spec:
  replicas: 1  # NEVER scale PostgreSQL this way — use a StatefulSet for multi-replica
  selector:
    matchLabels:
      app: postgres
  strategy:
    type: Recreate
    # Why Recreate instead of RollingUpdate?
    #   - PostgreSQL locks its data directory — two instances can't share it
    #   - Recreate: stop old pod → start new pod
    #   - RollingUpdate would try to run both simultaneously → data corruption
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:17-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: pos
            - name: POSTGRES_DB
              value: pos
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: pos-secrets
                  key: DB_PASSWORD
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
            # Why resource limits?
            #   - Without them, a runaway query could eat all 8GB RAM
            #   - K8s uses requests for scheduling (finding a node with room)
            #   - K8s uses limits to kill pods that exceed them (OOMKilled)
            #   - Start conservative, increase if needed
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "pos"]
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "pos"]
            initialDelaySeconds: 30
            periodSeconds: 10
            # Difference between readiness and liveness:
            #   - Readiness: "Can this pod serve traffic?" No → stop sending traffic
            #   - Liveness: "Is this pod alive?" No → restart it
            #   - A pod can be alive but not ready (e.g., still starting up)
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-data

---
# infra/k8s/postgres/service.yml
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: pos
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
  # Why a Service?
  #   - Pods get random IPs that change on restart
  #   - A Service gives a stable DNS name: "postgres.pos.svc.cluster.local"
  #   - Or just "postgres" within the same namespace
  #   - This is why our DATABASE_URL uses "postgres" as the hostname
```

#### Service template (example: todos)

```yaml
# infra/k8s/services/todos.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: todos
  namespace: pos
spec:
  replicas: 1
  selector:
    matchLabels:
      app: todos
  template:
    metadata:
      labels:
        app: todos
    spec:
      # ── Init container: run migrations before app starts ──
      initContainers:
        - name: migrate
          image: ghcr.io/<your-username>/pos-todos:latest
          command: ["alembic", "upgrade", "head"]
          envFrom:
            - secretRef:
                name: pos-secrets
          # Why an init container?
          #   - Runs BEFORE the main container starts
          #   - If migration fails, the pod doesn't start (safe!)
          #   - Only runs once per pod creation (not on every restart)
          #   - Solves the "multiple replicas all trying to migrate" problem:
          #     K8s creates pods sequentially for Deployments with init containers

      containers:
        - name: todos
          image: ghcr.io/<your-username>/pos-todos:latest
          ports:
            - containerPort: 8002
          envFrom:
            - secretRef:
                name: pos-secrets
            # envFrom loads ALL keys from the secret as environment variables
            # Much cleaner than listing each one individually
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /health
              port: 8002
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8002
            initialDelaySeconds: 10
            periodSeconds: 30

---
apiVersion: v1
kind: Service
metadata:
  name: todos
  namespace: pos
spec:
  selector:
    app: todos
  ports:
    - port: 8002
```

#### Ingress (external traffic routing)

```yaml
# infra/k8s/ingress.yml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pos-ingress
  namespace: pos
  annotations:
    # Traefik (k3s built-in) handles these annotations
    traefik.ingress.kubernetes.io/router.tls: "true"
    traefik.ingress.kubernetes.io/router.tls.certresolver: letsencrypt
    # Why annotations?
    #   - Ingress is a generic K8s resource
    #   - The actual implementation (Traefik, nginx, etc.) uses annotations
    #     for implementation-specific config
    #   - This is the K8s way: generic spec + controller-specific annotations
spec:
  tls:
    - hosts:
        - pos.yourdomain.com
      secretName: pos-tls
  rules:
    - host: pos.yourdomain.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: gateway
                port:
                  number: 8000
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend
                port:
                  number: 80
```

### 5.6 Deploy to k3s

```bash
# Apply everything (order matters for first deploy)
kubectl apply -f infra/k8s/namespace.yml
kubectl apply -f infra/k8s/secrets.yml        # Created manually on server
kubectl apply -f infra/k8s/postgres/
kubectl apply -f infra/k8s/rabbitmq/
# Wait for infra to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n pos --timeout=60s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n pos --timeout=60s

# Deploy app
kubectl apply -f infra/k8s/gateway/
kubectl apply -f infra/k8s/services/
kubectl apply -f infra/k8s/frontend/
kubectl apply -f infra/k8s/ingress.yml

# Watch everything come up
kubectl get pods -n pos -w
# -w = watch (streams updates as pods change state)
```

### 5.7 Useful kubectl commands

```bash
# ── Status ──────────────────────────────────────────────────
kubectl get pods -n pos                    # List all pods
kubectl get pods -n pos -o wide            # With node + IP info
kubectl get all -n pos                     # Pods + Services + Deployments
kubectl top pods -n pos                    # CPU/memory usage

# ── Debugging ───────────────────────────────────────────────
kubectl logs -n pos deployment/todos       # View logs
kubectl logs -n pos deployment/todos -f    # Stream logs (like tail -f)
kubectl logs -n pos deployment/todos --previous  # Logs from crashed pod
kubectl describe pod -n pos <pod-name>     # Detailed pod info (events, status)
kubectl exec -it -n pos <pod-name> -- sh   # Shell into a container

# ── Updates ─────────────────────────────────────────────────
kubectl rollout restart deployment/todos -n pos  # Restart (pull new image)
kubectl rollout status deployment/todos -n pos   # Watch rollout progress
kubectl rollout undo deployment/todos -n pos     # Rollback to previous version

# ── Scaling ─────────────────────────────────────────────────
kubectl scale deployment/todos -n pos --replicas=3
```

### 5.8 ArgoCD (GitOps)

**What is GitOps?** Your git repo is the source of truth. ArgoCD watches your repo and automatically applies changes to the cluster when you push.

```
You push K8s manifests to git
       ↓
ArgoCD detects the change
       ↓
ArgoCD applies the change to the cluster
       ↓
If it fails, ArgoCD shows the diff and alerts you
```

**Why ArgoCD?**
- No more SSH + `kubectl apply` — just push to git
- Visual dashboard showing what's deployed vs what's in git
- Automatic rollback if a deploy fails health checks
- Audit trail — every change is a git commit

```bash
# Install ArgoCD into k3s
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Get the admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Access the UI (port-forward from your Mac)
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open https://localhost:8080, login with admin/<password>

# Create an Application that watches your repo
# (Can also be done via UI)
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pos
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<your-username>/pOS-design-system.git
    targetRevision: main
    path: infra/k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: pos
  syncPolicy:
    automated:
      prune: true      # Delete resources removed from git
      selfHeal: true   # Revert manual kubectl changes
    syncOptions:
      - CreateNamespace=true
EOF
```

**The full flow with ArgoCD**:
```
Push code → GitHub Actions → Build images → Push to ghcr.io
                                                ↓
                                         Update image tag in K8s manifests
                                                ↓
                                         Push manifest change to git
                                                ↓
                                         ArgoCD detects change
                                                ↓
                                         ArgoCD applies to cluster
                                                ↓
                                         Zero-downtime rolling update
```

### 5.9 Helm (optional, for later)

**What is Helm?** Package manager for Kubernetes. Instead of 30+ YAML files, you create a template with variables.

**Why later?** Plain manifests are easier to understand while learning. Helm adds abstraction that can be confusing when you're still learning what the YAML means. Once you're comfortable with K8s, Helm makes managing many similar services much cleaner.

### 5.10 Checklist: Phase 4 complete when...

- [ ] k3s installed and running on Hetzner
- [ ] All manifests in `infra/k8s/`
- [ ] `kubectl get pods -n pos` shows all services running
- [ ] Ingress routes traffic correctly (HTTPS works)
- [ ] Can use the app at `https://pos.yourdomain.com`
- [ ] ArgoCD installed and watching your repo
- [ ] Push to main → images build → ArgoCD deploys → zero-downtime update

---

## 6. Phase 5: Storage Abstraction (R2)

### 6.1 Why abstract storage?

Several services store files locally: photos, documents, attachments, KB, portfolio. Locally means "on the container's filesystem" — which has problems:

1. **Data loss**: Container restarts lose non-volume data
2. **Scaling**: Two replicas can't share a local filesystem
3. **Backup**: You have to backup the server's disk
4. **Cost**: SSD storage on VPS is expensive ($0.05/GB). R2 is $0.015/GB with free egress.

### 6.2 The abstraction pattern

```python
# backend/shared/pos_contracts/storage.py

from abc import ABC, abstractmethod

class StorageBackend(ABC):
    """Interface for file storage — swap implementations without changing service code."""

    @abstractmethod
    async def put(self, key: str, data: bytes, content_type: str = None) -> str:
        """Store bytes, return the key."""
        ...

    @abstractmethod
    async def get(self, key: str) -> bytes:
        """Retrieve bytes by key."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete a stored object."""
        ...

    @abstractmethod
    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a temporary URL for direct download."""
        ...


class LocalStorage(StorageBackend):
    """For development — stores files on local disk."""

    def __init__(self, base_path: str):
        self.base_path = Path(base_path)

    async def put(self, key: str, data: bytes, content_type: str = None) -> str:
        path = self.base_path / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    async def get(self, key: str) -> bytes:
        return (self.base_path / key).read_bytes()

    async def delete(self, key: str) -> None:
        (self.base_path / key).unlink(missing_ok=True)

    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        # In dev, just return the local API path
        return f"/api/attachments/{key}"


class R2Storage(StorageBackend):
    """For production — Cloudflare R2 (S3-compatible)."""

    def __init__(self, bucket: str, account_id: str, access_key: str, secret_key: str):
        import boto3
        self.s3 = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        self.bucket = bucket

    async def put(self, key: str, data: bytes, content_type: str = None) -> str:
        # Run in thread pool since boto3 is synchronous
        import asyncio
        kwargs = {"Bucket": self.bucket, "Key": key, "Body": data}
        if content_type:
            kwargs["ContentType"] = content_type
        await asyncio.to_thread(self.s3.put_object, **kwargs)
        return key

    # ... get, delete, presigned_url follow same pattern


# Factory — reads config to pick implementation
def create_storage(config) -> StorageBackend:
    if config.STORAGE_BACKEND == "r2":
        return R2Storage(
            bucket=config.R2_BUCKET,
            account_id=config.R2_ACCOUNT_ID,
            access_key=config.R2_ACCESS_KEY,
            secret_key=config.R2_SECRET_KEY,
        )
    return LocalStorage(config.STORAGE_PATH)
```

**Why this pattern?**
- Service code calls `storage.put(key, data)` — doesn't care where it goes
- Switch between local and R2 with one env var (`STORAGE_BACKEND=r2`)
- Easy to test — inject `LocalStorage` in tests
- Could add S3, GCS, or any backend later

### 6.3 Cloudflare R2 setup

```bash
# 1. Create R2 bucket in Cloudflare dashboard
#    Dashboard → R2 → Create Bucket → "pos-storage"

# 2. Create API token
#    Dashboard → R2 → Manage R2 API Tokens → Create
#    Permissions: Object Read & Write
#    Specify bucket: pos-storage

# 3. Add to your secrets
#    R2_ACCOUNT_ID=<your-cloudflare-account-id>
#    R2_ACCESS_KEY=<from-token-creation>
#    R2_SECRET_KEY=<from-token-creation>
#    R2_BUCKET=pos-storage

# 4. Optional: Custom domain for public assets
#    Dashboard → R2 → pos-storage → Settings → Custom Domains
#    Add: files.pos.yourdomain.com
#    This serves files through Cloudflare's CDN — fast, cached, free egress
```

### 6.4 Checklist: Phase 5 complete when...

- [ ] `StorageBackend` abstraction in `pos_contracts`
- [ ] `LocalStorage` works for dev (drop-in replacement for current file I/O)
- [ ] `R2Storage` works with Cloudflare R2
- [ ] Photos, documents, attachments, KB use the abstraction
- [ ] `STORAGE_BACKEND=local` in dev, `STORAGE_BACKEND=r2` in prod
- [ ] Files accessible via presigned URLs (or custom domain)

---

## 7. Reference: Port Map & Services

| Service | Local Port | Container Port | Health Check | Has Migrations | Has File Storage |
|---|---|---|---|---|---|
| Frontend (nginx) | 3001 | 80 | — | No | No |
| Gateway | 8000 | 8000 | `/health` | No | No |
| Auth | 8001 | 8001 | `/health` | Yes | No |
| Todos | 8002 | 8002 | `/health` | Yes | No |
| Attachments | 8003 | 8003 | `/health` | Yes | Yes |
| Notes | 8004 | 8004 | `/health` | Yes | No |
| Documents | 8005 | 8005 | `/health` | Yes | Yes |
| Vault | 8006 | 8006 | `/health` | Yes | No |
| KB | 8007 | 8007 | `/health` | Yes | Yes |
| Photos | 8008 | 8008 | `/health` | Yes | Yes |
| Watchlist | 8009 | 8009 | `/health` | Yes | No |
| Portfolio | 8010 | 8010 | `/health` | Yes | Yes |
| Expense Tracker | 8011 | 8011 | `/health` | Yes | Yes |
| PostgreSQL | 5432 | 5432 | `pg_isready` | — | — |
| RabbitMQ | 5672 | 5672 | `check_port_connectivity` | — | — |

---

## Appendix: Troubleshooting

### Docker

```bash
# Image won't build — "COPY failed: file not found"
# → Check your build context. Are you running from repo root?
docker build -f backend/services/todos/Dockerfile .  # Note the "." at the end

# Container starts but can't reach PostgreSQL
# → Check the hostname. In compose it's "postgres", locally it's "localhost"
# → Check the port. Default is 5432, Docker might map to something else.
docker compose logs postgres  # Is it actually running?

# "no space left on device"
docker system prune -a  # Remove all unused images, containers, volumes
# WARNING: This deletes everything not currently running!
```

### Kubernetes

```bash
# Pod stuck in CrashLoopBackOff
kubectl logs -n pos <pod-name> --previous  # See why it crashed
kubectl describe pod -n pos <pod-name>     # Check events section

# Pod stuck in Pending
kubectl describe pod -n pos <pod-name>     # Usually: insufficient resources
# Check: requests vs available resources
kubectl top nodes

# Pod stuck in ImagePullBackOff
# → Wrong image name, or private registry without credentials
kubectl describe pod -n pos <pod-name>  # Check "Events" for the exact error

# Service not reachable
kubectl get endpoints -n pos  # Are there endpoints for the service?
kubectl get svc -n pos        # Is the service pointing to the right port?

# Ingress not working
kubectl get ingress -n pos    # Check ADDRESS column — should have your IP
kubectl logs -n kube-system -l app.kubernetes.io/name=traefik  # Traefik logs
```

### General

```bash
# "Connection refused" to a service
# 1. Is it running? (docker compose ps / kubectl get pods)
# 2. Is it healthy? (check logs)
# 3. Is the port right? (check compose/manifest)
# 4. Is the hostname right? (service name in compose, service name in K8s)
# 5. Are they on the same network? (compose network, K8s namespace)
```

---

*Last updated: 2026-03-27*
*This is a living document — update it as you learn and deploy.*
