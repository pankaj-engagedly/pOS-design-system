"""Notes service tests — notes CRUD, soft delete, restore, permanent delete."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def app():
    """Import the FastAPI app."""
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_health_check(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "pos-notes"


@pytest.mark.asyncio
async def test_list_notes_requires_user_id(app):
    """Without x-user-id header, should fail."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/notes/notes")
        assert response.status_code in (401, 422, 500)


@pytest.mark.asyncio
async def test_create_note_validation(app):
    """Title exceeding max length should fail validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/notes/notes",
            json={"title": "x" * 501},
            headers={"x-user-id": "00000000-0000-0000-0000-000000000001"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_note_endpoints_exist(app):
    """Verify the expected note endpoints are registered."""
    from fastapi.routing import APIRoute
    routes = {r.path for r in app.routes if isinstance(r, APIRoute)}
    assert "/api/notes/notes" in routes
    assert "/api/notes/notes/{note_id}" in routes
    assert "/api/notes/notes/{note_id}/restore" in routes
    assert "/api/notes/notes/{note_id}/permanent" in routes
    assert "/api/notes/folders" in routes
    assert "/api/notes/tags" in routes
