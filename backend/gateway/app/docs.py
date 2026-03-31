"""Unified API documentation — merges OpenAPI specs from all services."""

import httpx
from fastapi import APIRouter
from fastapi.responses import HTMLResponse, JSONResponse
from loguru import logger

router = APIRouter()

# Service registry: (name, url_module_attr, tag_label)
SERVICES = [
    ("auth", "AUTH_SERVICE_URL", "Auth"),
    ("todos", "TODO_SERVICE_URL", "Todos"),
    ("attachments", "ATTACHMENT_SERVICE_URL", "Attachments"),
    ("notes", "NOTES_SERVICE_URL", "Notes"),
    ("documents", "DOCUMENTS_SERVICE_URL", "Documents"),
    ("vault", "VAULT_SERVICE_URL", "Vault"),
    ("kb", "KB_SERVICE_URL", "Knowledge Base"),
    ("feeds", "KB_SERVICE_URL", "Feeds"),
    ("photos", "PHOTOS_SERVICE_URL", "Photos"),
    ("watchlist", "WATCHLIST_SERVICE_URL", "Watchlist"),
    ("portfolio", "PORTFOLIO_SERVICE_URL", "Portfolio"),
    ("expenses", "EXPENSE_TRACKER_SERVICE_URL", "Expense Tracker"),
]

_cached_spec: dict | None = None


async def _fetch_spec(service_url: str) -> dict | None:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{service_url}/openapi.json", timeout=5.0)
            if resp.status_code == 200:
                return resp.json()
    except Exception as e:
        logger.debug(f"Could not fetch spec from {service_url}: {e}")
    return None


async def _build_merged_spec() -> dict:
    from . import routes as routes_module

    merged = {
        "openapi": "3.1.0",
        "info": {
            "title": "pOS API",
            "description": "Personal Operating System — unified API documentation for all services.",
            "version": "1.0.0",
        },
        "paths": {},
        "components": {"schemas": {}, "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            },
            "ApiKeyAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "X-API-Key",
            },
        }},
        "security": [{"BearerAuth": []}, {"ApiKeyAuth": []}],
        "tags": [],
    }

    for name, url_attr, tag_label in SERVICES:
        service_url = getattr(routes_module, url_attr, None)
        if not service_url:
            continue

        spec = await _fetch_spec(service_url)
        if not spec:
            logger.warning(f"Skipping {name} — could not fetch OpenAPI spec")
            continue

        merged["tags"].append({"name": tag_label})

        # Merge paths — tag all operations with the service name
        for path, methods in spec.get("paths", {}).items():
            for method, operation in methods.items():
                if isinstance(operation, dict):
                    operation["tags"] = [tag_label]
                    # Prefix operationId to avoid collisions
                    if "operationId" in operation:
                        operation["operationId"] = f"{name}_{operation['operationId']}"

            if path in merged["paths"]:
                merged["paths"][path].update(methods)
            else:
                merged["paths"][path] = methods

        # Merge component schemas with service prefix to avoid collisions
        for schema_name, schema_def in spec.get("components", {}).get("schemas", {}).items():
            prefixed = f"{name}__{schema_name}"
            merged["components"]["schemas"][prefixed] = schema_def

        # Rewrite $ref pointers in paths to use prefixed schema names
        _rewrite_refs(merged["paths"], name)

    return merged


def _rewrite_refs(obj, prefix: str):
    """Recursively rewrite #/components/schemas/X refs to prefixed versions."""
    if isinstance(obj, dict):
        if "$ref" in obj:
            ref = obj["$ref"]
            if ref.startswith("#/components/schemas/"):
                schema_name = ref[len("#/components/schemas/"):]
                obj["$ref"] = f"#/components/schemas/{prefix}__{schema_name}"
        for v in obj.values():
            _rewrite_refs(v, prefix)
    elif isinstance(obj, list):
        for item in obj:
            _rewrite_refs(item, prefix)


@router.get("/api/docs/openapi.json", include_in_schema=False)
async def get_merged_openapi():
    global _cached_spec
    if _cached_spec is None:
        _cached_spec = await _build_merged_spec()
    return JSONResponse(_cached_spec)


@router.get("/api/docs/refresh", include_in_schema=False)
async def refresh_docs():
    """Force refresh the cached spec."""
    global _cached_spec
    _cached_spec = await _build_merged_spec()
    return {"status": "refreshed", "paths": len(_cached_spec.get("paths", {}))}


@router.get("/api/docs", include_in_schema=False)
async def swagger_ui():
    return HTMLResponse("""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pOS API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0 20px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      defaultModelsExpandDepth: -1,
    });
  </script>
</body>
</html>""")
