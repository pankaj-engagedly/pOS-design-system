## Technical Approach

Build two backend services (auth, todos) following the existing sample service pattern, wire them through the gateway, and create frontend modules using Atomic Design. The auth flow uses JWT access + refresh tokens with HS256 (dev) as already scaffolded in `pos_common.auth`.

## Architecture

### Auth Flow

```
Browser                  Gateway (8000)           Auth Service (8001)
  │                         │                          │
  ├─ POST /api/auth/register ──► (public path) ───────► create user, hash pw
  │  ◄── { user, tokens } ──┤  ◄── { user, tokens } ──┤
  │                         │                          │
  ├─ POST /api/auth/login ────► (public path) ────────► verify pw, issue JWT
  │  ◄── { user, tokens } ──┤  ◄── { user, tokens } ──┤
  │                         │                          │
  ├─ GET /api/todos/lists ────► validate JWT ──────────► (proxy to Todo svc)
  │  (Authorization: Bearer) │  inject user_id         │
  │                         │                          │
  ├─ POST /api/auth/refresh ──► (public path) ────────► validate refresh token
  │  ◄── { access_token } ──┤  ◄── { access_token } ──┤
```

### Data Model

```
users
├── id (UUID, PK)
├── email (unique, indexed)
├── password_hash (bcrypt)
├── name
├── created_at
└── updated_at

todo_lists
├── id (UUID, PK)
├── user_id (UUID, FK → scoping)
├── name
├── position (integer, for ordering)
├── created_at
└── updated_at

tasks
├── id (UUID, PK)
├── user_id (UUID, FK → scoping)
├── list_id (UUID, FK → todo_lists)
├── title
├── description (text, nullable)
├── status (enum: todo, in_progress, done, archived)
├── priority (enum: none, low, medium, high, urgent)
├── due_date (date, nullable)
├── is_important (boolean, default false)
├── is_urgent (boolean, default false)
├── position (integer, for ordering within list)
├── created_at
└── updated_at

subtasks
├── id (UUID, PK)
├── user_id (UUID, FK → scoping)
├── task_id (UUID, FK → tasks, cascade delete)
├── title
├── is_completed (boolean, default false)
├── position (integer)
├── created_at
└── updated_at
```

### API Design

**Auth Service** (prefix: `/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /register | No | Create account |
| POST | /login | No | Get tokens |
| POST | /refresh | No | Refresh access token |
| POST | /logout | Yes | Invalidate refresh token |
| GET | /me | Yes | Get current user profile |
| PATCH | /me | Yes | Update profile |
| POST | /change-password | Yes | Change password |

**Todo Service** (prefix: `/api/todos`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /lists | Yes | Get all lists |
| POST | /lists | Yes | Create list |
| PATCH | /lists/:id | Yes | Update list |
| DELETE | /lists/:id | Yes | Delete list (cascade tasks) |
| PATCH | /lists/reorder | Yes | Reorder lists |
| GET | /lists/:id/tasks | Yes | Get tasks in list |
| POST | /tasks | Yes | Create task |
| GET | /tasks/:id | Yes | Get task detail |
| PATCH | /tasks/:id | Yes | Update task |
| DELETE | /tasks/:id | Yes | Delete task |
| PATCH | /tasks/reorder | Yes | Reorder tasks within list |
| POST | /tasks/:id/subtasks | Yes | Add subtask |
| PATCH | /subtasks/:id | Yes | Toggle/update subtask |
| DELETE | /subtasks/:id | Yes | Delete subtask |

### Frontend Component Hierarchy

Molecules and organisms live in `frontend/shared/` by default — they're reusable building blocks. Modules only contain pages, services, and store.

```
Shared Molecules (frontend/shared/molecules/):
  pos-task-item         — Single task row (checkbox + title + priority + due date)
  pos-task-form         — Create/edit task form (title, description, priority, due, flags)
  pos-subtask-list      — Checklist of subtasks within task detail
  pos-list-item         — Single list row in sidebar (name + count + actions)

Shared Organisms (frontend/shared/organisms/):
  pos-task-list         — Scrollable list of task items with header + filters
  pos-list-sidebar      — List of todo lists with add/edit/delete

Pages (module-specific):
  pos-auth-login        — Login form page (frontend/modules/auth/pages/)
  pos-auth-register     — Registration form page (frontend/modules/auth/pages/)
  pos-todos-app         — Main todos page (frontend/modules/todos/pages/)
```

As more modules are built (notes, KB, feeds), common patterns will emerge and these todo-specific components may evolve into more generic shared components (e.g., `pos-task-list` → generic `pos-data-list`).

### Gateway Proxying Strategy

Rather than running all services in one process, the gateway will use `httpx` to proxy requests to individual services. In dev, each service runs on its own port:
- Gateway: 8000
- Auth service: 8001
- Todo service: 8002

The gateway strips the service prefix and forwards. This keeps services independently deployable.

```python
# Gateway routes.py pattern
@router.api_route("/api/auth/{path:path}", methods=["GET","POST","PATCH","DELETE"])
async def proxy_auth(request: Request, path: str):
    return await proxy_request(request, "http://localhost:8001", f"/api/auth/{path}")
```

## Key Decisions

1. **HS256 for JWT (dev phase)**: Already scaffolded in `pos_common.auth`. RS256 planned for production (Phase 5). Simpler for dev — single secret key, no key pair management.

2. **Refresh tokens stored in DB**: Auth service tracks issued refresh tokens in a `refresh_tokens` table. This enables logout (revoke token) and session management. Token rotation: old refresh token invalidated on use.

3. **Gateway proxies via httpx**: Each service runs independently on its own port. Gateway forwards requests using async httpx. No in-process coupling — services can be deployed independently later.

4. **No tag/comment/attachment services yet**: PRD lists these for Phase 1, but they're independent capabilities. Focusing on auth + todos core first. Tags, comments, and attachments can be added as a follow-up change without blocking the vertical slice.

5. **User model extends Base, not UserScopedBase**: The `users` table is the identity table — it doesn't have a `user_id` FK. Uses the plain `Base` from `pos_common.database`.

6. **Frontend auth: localStorage for tokens**: Access token in memory, refresh token in localStorage. On page reload, attempt silent refresh. If refresh fails, redirect to login.

7. **No email verification in this phase**: Registration creates the user immediately. Email verification deferred to later (needs email service). Keeps scope manageable.

## Dependencies

**Python packages** (additions to existing):
- `httpx` — gateway proxying (add to gateway requirements.txt)
- `email-validator` — registration email validation (add to auth requirements.txt)
- `bcrypt` — already available via `passlib[bcrypt]` in pos_common

**No new frontend dependencies.** Design system atoms (`ui-button`, `ui-input`, `ui-card`, `ui-badge`, `ui-spinner`, `ui-checkbox`, `ui-dialog`) provide all needed UI primitives.

## Risks

- **Port management in dev**: Running 3+ services on different ports. Makefile needs to orchestrate startup/shutdown cleanly. Use background processes with PID files for `make dev`.
- **Token refresh timing**: Race condition if multiple API calls hit 401 simultaneously. Solution: queue refresh requests, only execute one, broadcast result.
- **Database migrations across services**: Multiple Alembic migration chains sharing one database. Need clear table ownership boundaries. Auth owns `users` + `refresh_tokens`. Todos owns `todo_lists` + `tasks` + `subtasks`.
