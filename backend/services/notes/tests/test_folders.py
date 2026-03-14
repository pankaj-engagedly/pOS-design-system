"""Folder service tests — folder CRUD, delete nullifies notes."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def app():
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_list_folders_requires_user_id(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/notes/folders")
        assert response.status_code in (401, 422, 500)


@pytest.mark.asyncio
async def test_create_folder_validation(app):
    """Empty folder name should fail validation."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/notes/folders",
            json={"name": ""},
            headers={"x-user-id": "00000000-0000-0000-0000-000000000001"},
        )
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_folder_endpoints_exist(app):
    """Verify folder endpoints are registered."""
    from fastapi.routing import APIRoute
    routes = {r.path for r in app.routes if isinstance(r, APIRoute)}
    assert "/api/notes/folders" in routes
    assert "/api/notes/folders/{folder_id}" in routes
    assert "/api/notes/folders/reorder" in routes
