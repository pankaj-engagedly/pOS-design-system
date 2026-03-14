"""API Gateway route definitions — proxies to downstream services."""

from fastapi import APIRouter, Request

from .proxy import proxy_request

router = APIRouter()


# Service URLs — configured via environment, defaults for local dev
AUTH_SERVICE_URL = "http://localhost:8001"
TODO_SERVICE_URL = "http://localhost:8002"
ATTACHMENT_SERVICE_URL = "http://localhost:8003"
NOTES_SERVICE_URL = "http://localhost:8004"


@router.get("/api/")
async def api_root():
    return {
        "service": "pOS API Gateway",
        "version": "0.1.0",
        "routes": {
            "/api/auth": "Authentication service",
            "/api/todos": "Todo service",
            "/api/notes": "Notes service",
            "/api/kb": "Knowledge Base service (Phase 2)",
            "/api/vault": "Vault service (Phase 3)",
            "/api/feeds": "Feed Watcher service (Phase 3)",
            "/api/docs": "Documents service (Phase 4)",
            "/api/photos": "Photos service (Phase 4)",
        },
    }


# --- Auth service proxy ---

@router.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_auth(request: Request, path: str):
    return await proxy_request(request, AUTH_SERVICE_URL, f"/api/auth/{path}")


# --- Todo service proxy ---

@router.api_route("/api/todos/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_todos(request: Request, path: str):
    return await proxy_request(request, TODO_SERVICE_URL, f"/api/todos/{path}")


# --- Attachment service proxy ---

@router.api_route("/api/attachments/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_attachments(request: Request, path: str):
    return await proxy_request(request, ATTACHMENT_SERVICE_URL, f"/api/attachments/{path}")


# --- Notes service proxy ---

@router.api_route("/api/notes/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_notes(request: Request, path: str):
    return await proxy_request(request, NOTES_SERVICE_URL, f"/api/notes/{path}")
