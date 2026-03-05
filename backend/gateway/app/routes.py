"""API Gateway route definitions.

Each service gets a path prefix. In Phase 0, these are stubs.
In Phase 1+, they'll proxy to the actual service endpoints.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api")


@router.get("/")
async def api_root():
    return {
        "service": "pOS API Gateway",
        "version": "0.1.0",
        "routes": {
            "/api/auth": "Authentication service (Phase 1)",
            "/api/todos": "Todo service (Phase 1)",
            "/api/notes": "Notes service (Phase 2)",
            "/api/kb": "Knowledge Base service (Phase 2)",
            "/api/vault": "Vault service (Phase 3)",
            "/api/feeds": "Feed Watcher service (Phase 3)",
            "/api/docs": "Documents service (Phase 4)",
            "/api/photos": "Photos service (Phase 4)",
            "/api/tags": "Tags service (common)",
            "/api/comments": "Comments service (common)",
            "/api/attachments": "Attachments service (common)",
        },
    }
