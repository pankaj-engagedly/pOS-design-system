"""
pOS MCP Server — SSE (Server-Sent Events) transport for remote access.

WHY SSE?
────────
stdio transport works for local use (piping stdin/stdout between processes).
For remote agents (OpenClaw on GCP, Claude via API), we need HTTP-based transport.

SSE transport exposes two HTTP endpoints:
  GET  /sse     — Client connects here for server→client messages (SSE stream)
  POST /messages — Client sends tool calls here (JSON-RPC requests)

The MCP client connects to GET /sse, receives a session ID, then sends
tool calls to POST /messages with that session ID. The server responds
via the SSE stream.

DEPLOYMENT:
───────────
This runs as a standalone HTTP server (default port 8020).
In Docker, it's its own container alongside the other pOS services.
Agents connect to: https://pos.sinsquare.me/mcp/sse (proxied via Caddy)
"""

import os
import logging

from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route, Mount

# Import the MCP server app with all tools/resources registered
from server import app as mcp_app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pos-mcp-sse")

PORT = int(os.environ.get("MCP_PORT", "8020"))

# SSE transport — bridges HTTP↔MCP protocol
# Use /mcp/messages as the advertised path since Caddy proxies /mcp/* and strips the prefix
MESSAGE_PATH = os.environ.get("MCP_MESSAGE_PATH", "/messages")
sse = SseServerTransport(MESSAGE_PATH)


async def handle_sse(request):
    """SSE endpoint — client connects here for streaming responses."""
    async with sse.connect_sse(request.scope, request.receive, request._send) as streams:
        await mcp_app.run(streams[0], streams[1], mcp_app.create_initialization_options())


# Starlette app with SSE + message endpoints
starlette_app = Starlette(
    debug=False,
    routes=[
        Route("/sse", endpoint=handle_sse),
        Mount("/", app=sse.handle_post_message),
    ],
)

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting pOS MCP SSE server on port {PORT}")
    uvicorn.run(starlette_app, host="0.0.0.0", port=PORT)
