"""API Gateway route definitions — proxies to downstream services."""

from fastapi import APIRouter, Request

from .proxy import proxy_request

router = APIRouter()


# Service URLs — configured via environment, defaults for local dev
AUTH_SERVICE_URL = "http://localhost:8001"
TODO_SERVICE_URL = "http://localhost:8002"
ATTACHMENT_SERVICE_URL = "http://localhost:8003"
NOTES_SERVICE_URL = "http://localhost:8004"
DOCUMENTS_SERVICE_URL = "http://localhost:8005"
VAULT_SERVICE_URL = "http://localhost:8006"
KB_SERVICE_URL = "http://localhost:8007"


@router.get("/api/")
async def api_root():
    return {
        "service": "pOS API Gateway",
        "version": "0.1.0",
        "routes": {
            "/api/auth": "Authentication service",
            "/api/todos": "Todo service",
            "/api/notes": "Notes service",
            "/api/kb": "Knowledge Base service",
            "/api/feeds": "Feed service",
            "/api/vault": "Vault service",
            "/api/docs": "Documents service",
            "/api/photos": "Photos service (Phase 5)",
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


# --- Documents service proxy ---

@router.api_route("/api/documents/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_documents(request: Request, path: str):
    return await proxy_request(request, DOCUMENTS_SERVICE_URL, f"/api/documents/{path}")


# --- Vault service proxy ---

@router.api_route("/api/vault/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_vault(request: Request, path: str):
    return await proxy_request(request, VAULT_SERVICE_URL, f"/api/vault/{path}")


# --- KB service proxy ---

@router.api_route("/api/kb/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_kb(request: Request, path: str):
    return await proxy_request(request, KB_SERVICE_URL, f"/api/kb/{path}")


# --- Feed service proxy (same backend as KB) ---

@router.api_route("/api/feeds/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
async def proxy_feeds(request: Request, path: str):
    return await proxy_request(request, KB_SERVICE_URL, f"/api/feeds/{path}")
