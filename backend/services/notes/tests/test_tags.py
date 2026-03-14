"""Tag service tests — tag management, note association."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def app():
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_list_tags_requires_user_id(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/notes/tags")
        assert response.status_code in (401, 422, 500)


@pytest.mark.asyncio
async def test_add_tag_validation(app):
    """Empty tag name should fail validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/notes/notes/00000000-0000-0000-0000-000000000001/tags",
            json={"name": ""},
            headers={"x-user-id": "00000000-0000-0000-0000-000000000001"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_tag_endpoints_exist(app):
    """Verify tag endpoints are registered."""
    from fastapi.routing import APIRoute
    routes = {r.path for r in app.routes if isinstance(r, APIRoute)}
    assert "/api/notes/tags" in routes
    assert "/api/notes/notes/{note_id}/tags" in routes
    assert "/api/notes/notes/{note_id}/tags/{tag_id}" in routes
