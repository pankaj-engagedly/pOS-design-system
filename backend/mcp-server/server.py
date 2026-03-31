"""
pOS MCP Server — Exposes pOS functionality to AI agents via Model Context Protocol.

HOW MCP WORKS:
─────────────
MCP is a JSON-RPC based protocol with 3 primitives:

1. TOOLS — Actions the AI can take (like function calls)
   Example: "create_task", "save_to_kb", "search_notes"
   The AI sees tool names + descriptions + parameter schemas,
   decides when to call them, and gets structured results back.

2. RESOURCES — Data the AI can read (like GET endpoints)
   Example: "pos://todos/lists" returns all todo lists
   Resources are read-only and identified by URIs.

3. PROMPTS — Reusable prompt templates (not used here yet)

TRANSPORT:
──────────
- stdio: For local use (Claude Desktop, CLI tools). Server reads/writes JSON-RPC on stdin/stdout.
- SSE (Server-Sent Events): For remote use. HTTP-based, supports streaming.

This server supports both — stdio for local dev, SSE for production (Docker container on DO).

ARCHITECTURE:
─────────────
AI Agent (Claude/OpenClaw)
    ↓ MCP protocol (SSE over HTTP)
This MCP Server (translates to REST calls)
    ↓ HTTP + API Key
pOS Gateway → Microservices
"""

import os
import logging
from datetime import datetime

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, Resource

# ── Configuration ─────────────────────────────────────────────────────────────

POS_BASE_URL = os.environ.get("POS_BASE_URL", "https://pos.sinsquare.me")
POS_API_KEY = os.environ.get("POS_API_KEY", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pos-mcp")

# ── HTTP Client ───────────────────────────────────────────────────────────────
# All pOS API calls go through this client with the API key header.


async def pos_api(method: str, path: str, json: dict | None = None, params: dict | None = None) -> dict | list:
    """Make an authenticated request to the pOS API."""
    async with httpx.AsyncClient() as client:
        resp = await client.request(
            method,
            f"{POS_BASE_URL}{path}",
            headers={"X-API-Key": POS_API_KEY},
            json=json,
            params=params,
            timeout=30.0,
        )
        resp.raise_for_status()
        if resp.status_code == 204:
            return {"ok": True}
        return resp.json()


# ── MCP Server Setup ─────────────────────────────────────────────────────────
# The Server class is the core of MCP. We register tools and resources on it.

app = Server("pos-mcp")


# ══════════════════════════════════════════════════════════════════════════════
# TOOLS — Actions that AI agents can take
# ══════════════════════════════════════════════════════════════════════════════
#
# Each tool has:
#   - name: unique identifier (snake_case)
#   - description: what it does (AI reads this to decide when to use it)
#   - inputSchema: JSON Schema for parameters (AI validates input against this)
#
# When the AI calls a tool, our handler receives the arguments and translates
# them to pOS REST API calls.


@app.list_tools()
async def list_tools() -> list[Tool]:
    """Return all available tools. Called by the AI client on connection."""
    return [
        # ── Todos ─────────────────────────────────────────────
        Tool(
            name="list_todo_lists",
            description="List all todo lists (projects). Returns list name, task count, and ID.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
        Tool(
            name="get_tasks",
            description="Get all tasks in a todo list, including subtasks. Use list_todo_lists first to get the list ID.",
            inputSchema={
                "type": "object",
                "properties": {
                    "list_id": {"type": "string", "description": "UUID of the todo list"},
                },
                "required": ["list_id"],
            },
        ),
        Tool(
            name="get_task",
            description="Get a single task with full details including subtasks and comments.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task"},
                },
                "required": ["task_id"],
            },
        ),
        Tool(
            name="create_task",
            description="Create a new task in a todo list. Returns the created task.",
            inputSchema={
                "type": "object",
                "properties": {
                    "list_id": {"type": "string", "description": "UUID of the todo list"},
                    "title": {"type": "string", "description": "Task title"},
                    "description": {"type": "string", "description": "Optional task description"},
                    "priority": {"type": "string", "enum": ["none", "low", "medium", "high", "urgent"], "description": "Task priority (default: medium)"},
                    "due_date": {"type": "string", "description": "Due date in YYYY-MM-DD format"},
                },
                "required": ["list_id", "title"],
            },
        ),
        Tool(
            name="update_task",
            description="Update a task's title, description, status, priority, or due date.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task"},
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "status": {"type": "string", "enum": ["todo", "in_progress", "done", "archived"]},
                    "priority": {"type": "string", "enum": ["none", "low", "medium", "high", "urgent"]},
                    "due_date": {"type": "string", "description": "YYYY-MM-DD or null to clear"},
                },
                "required": ["task_id"],
            },
        ),
        Tool(
            name="add_subtask",
            description="Add a subtask (checklist item) to a task.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the parent task"},
                    "title": {"type": "string", "description": "Subtask title"},
                },
                "required": ["task_id", "title"],
            },
        ),
        Tool(
            name="complete_subtask",
            description="Mark a subtask as completed or uncompleted.",
            inputSchema={
                "type": "object",
                "properties": {
                    "subtask_id": {"type": "string", "description": "UUID of the subtask"},
                    "completed": {"type": "boolean", "description": "true to complete, false to uncomplete"},
                },
                "required": ["subtask_id", "completed"],
            },
        ),
        Tool(
            name="add_comment",
            description="Add a comment to a task. Use for status updates, notes, or completion logs.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "string", "description": "UUID of the task"},
                    "content": {"type": "string", "description": "Comment text"},
                },
                "required": ["task_id", "content"],
            },
        ),

        # ── Knowledge Base ────────────────────────────────────
        Tool(
            name="save_to_kb",
            description="Save a URL to the Knowledge Base. Automatically extracts title, description, and preview image.",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "URL to save"},
                    "title": {"type": "string", "description": "Optional custom title (auto-extracted if not provided)"},
                    "notes": {"type": "string", "description": "Optional notes about why this is saved"},
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="search_kb",
            description="Search the Knowledge Base by keyword. Returns matching items with titles and URLs.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword"},
                    "limit": {"type": "integer", "description": "Max results (default 20)"},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="list_kb_collections",
            description="List all KB collections (playlists/groups of saved items).",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),

        # ── Notes ─────────────────────────────────────────────
        Tool(
            name="create_note",
            description="Create a new note. Content is plain text (stored as Tiptap JSON internally).",
            inputSchema={
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Note title"},
                    "content": {"type": "string", "description": "Note content (plain text)"},
                    "folder_id": {"type": "string", "description": "Optional folder UUID"},
                },
                "required": ["title"],
            },
        ),
        Tool(
            name="search_notes",
            description="Search notes by keyword in title or content.",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword"},
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="list_note_folders",
            description="List all note folders.",
            inputSchema={"type": "object", "properties": {}, "required": []},
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """
    Handle a tool call from the AI agent.

    This is where MCP magic happens — the AI calls a tool by name with arguments,
    we translate it to a pOS REST API call, and return the result as text content.
    """
    try:
        result = await _dispatch_tool(name, arguments)
        # MCP returns content as a list of content blocks (text, image, etc.)
        # We return JSON as text — the AI parses it.
        import json
        return [TextContent(type="text", text=json.dumps(result, indent=2, default=str))]
    except httpx.HTTPStatusError as e:
        error_body = e.response.text if e.response else str(e)
        return [TextContent(type="text", text=f"Error {e.response.status_code}: {error_body}")]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]


async def _dispatch_tool(name: str, args: dict) -> dict | list:
    """Route tool calls to the appropriate pOS API endpoint."""

    # ── Todos ─────────────────────────────────────────────────────────────────

    if name == "list_todo_lists":
        return await pos_api("GET", "/api/todos/lists")

    if name == "get_tasks":
        return await pos_api("GET", f"/api/todos/lists/{args['list_id']}/tasks")

    if name == "get_task":
        return await pos_api("GET", f"/api/todos/tasks/{args['task_id']}")

    if name == "create_task":
        body = {"list_id": args["list_id"], "title": args["title"]}
        if args.get("description"):
            body["description"] = args["description"]
        if args.get("priority"):
            body["priority"] = args["priority"]
        if args.get("due_date"):
            body["due_date"] = args["due_date"]
        return await pos_api("POST", "/api/todos/tasks", json=body)

    if name == "update_task":
        task_id = args.pop("task_id")
        body = {k: v for k, v in args.items() if v is not None}
        return await pos_api("PATCH", f"/api/todos/tasks/{task_id}", json=body)

    if name == "add_subtask":
        return await pos_api("POST", f"/api/todos/tasks/{args['task_id']}/subtasks", json={"title": args["title"]})

    if name == "complete_subtask":
        return await pos_api("PATCH", f"/api/todos/subtasks/{args['subtask_id']}", json={"is_completed": args["completed"]})

    if name == "add_comment":
        return await pos_api("POST", f"/api/todos/tasks/{args['task_id']}/comments", json={"content": args["content"]})

    # ── Knowledge Base ────────────────────────────────────────────────────────

    if name == "save_to_kb":
        body = {"url": args["url"], "item_type": "url"}
        if args.get("title"):
            body["title"] = args["title"]
        return await pos_api("POST", "/api/kb/items/save-url", json=body)

    if name == "search_kb":
        params = {"q": args["query"], "limit": args.get("limit", 20)}
        return await pos_api("GET", "/api/kb/items", params=params)

    if name == "list_kb_collections":
        return await pos_api("GET", "/api/kb/collections")

    # ── Notes ─────────────────────────────────────────────────────────────────

    if name == "create_note":
        body = {"title": args["title"]}
        if args.get("content"):
            # Convert plain text to minimal Tiptap JSON
            body["content"] = {
                "type": "doc",
                "content": [{"type": "paragraph", "content": [{"type": "text", "text": args["content"]}]}]
            }
            body["preview_text"] = args["content"][:200]
        if args.get("folder_id"):
            body["folder_id"] = args["folder_id"]
        return await pos_api("POST", "/api/notes/notes", json=body)

    if name == "search_notes":
        return await pos_api("GET", "/api/notes/notes", params={"search": args["query"]})

    if name == "list_note_folders":
        return await pos_api("GET", "/api/notes/folders")

    raise ValueError(f"Unknown tool: {name}")


# ══════════════════════════════════════════════════════════════════════════════
# RESOURCES — Read-only data the AI can access
# ══════════════════════════════════════════════════════════════════════════════
#
# Resources are like GET endpoints — identified by URIs.
# The AI can list available resources and read them.
# Useful for providing context without the AI needing to call a tool.


@app.list_resources()
async def list_resources() -> list[Resource]:
    """List available resources."""
    return [
        Resource(
            uri="pos://todos/overview",
            name="Todo Overview",
            description="All todo lists with task counts — gives the AI a high-level view of what's being tracked",
            mimeType="application/json",
        ),
    ]


@app.read_resource()
async def read_resource(uri: str) -> str:
    """Read a resource by URI."""
    import json

    if uri == "pos://todos/overview":
        lists = await pos_api("GET", "/api/todos/lists")
        overview = []
        for lst in lists:
            tasks = await pos_api("GET", f"/api/todos/lists/{lst['id']}/tasks")
            overview.append({
                "list": lst["name"],
                "list_id": lst["id"],
                "total_tasks": len(tasks),
                "pending": sum(1 for t in tasks if t["status"] != "done"),
                "tasks": [
                    {
                        "title": t["title"],
                        "status": t["status"],
                        "subtasks_done": t.get("subtask_done", 0),
                        "subtasks_total": t.get("subtask_total", 0),
                    }
                    for t in tasks
                ],
            })
        return json.dumps(overview, indent=2)

    raise ValueError(f"Unknown resource: {uri}")


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

async def main():
    """Run the MCP server on stdio transport (for local/CLI use)."""
    logger.info(f"Starting pOS MCP server (API: {POS_BASE_URL})")
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
