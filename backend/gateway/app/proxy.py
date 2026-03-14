"""HTTP proxy utility for forwarding requests to downstream services."""

import httpx
from fastapi import Request
from starlette.responses import Response


async def proxy_request(
    request: Request,
    service_url: str,
    path: str,
) -> Response:
    """Forward a request to a downstream service.

    Preserves method, headers, body, and query params.
    Injects X-User-Id header from request state if available.
    """
    # Build target URL
    url = f"{service_url}{path}"
    if request.url.query:
        url = f"{url}?{request.url.query}"

    # Forward headers (excluding host)
    headers = dict(request.headers)
    headers.pop("host", None)

    # Inject user_id if available
    if hasattr(request.state, "user_id"):
        headers["x-user-id"] = str(request.state.user_id)

    body = await request.body()

    async with httpx.AsyncClient() as client:
        try:
            response = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                content=body,
                timeout=30.0,
            )
        except httpx.ConnectError:
            return Response(
                content='{"detail": "Service unavailable"}',
                status_code=502,
                media_type="application/json",
            )

    return Response(
        content=response.content,
        status_code=response.status_code,
        headers=dict(response.headers),
        media_type=response.headers.get("content-type"),
    )
