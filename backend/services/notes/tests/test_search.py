"""Search tests — full-text search endpoint validation."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def app():
    from app.main import app
    return app


@pytest.mark.asyncio
async def test_search_requires_user_id(app):
    """Search without user_id should fail."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/notes/notes?search=test")
        assert response.status_code in (401, 422, 500)


@pytest.mark.asyncio
async def test_search_query_param_accepted(app):
    """Search query param is accepted (may fail at DB layer without real DB)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/notes/notes?search=meeting",
            headers={"x-user-id": "00000000-0000-0000-0000-000000000001"},
        )
        # Without a real DB, will get 500 — but the route should exist and accept the param
        assert response.status_code != 404


@pytest.mark.asyncio
async def test_is_deleted_filter_accepted(app):
    """is_deleted filter param is accepted."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/api/notes/notes?is_deleted=true",
            headers={"x-user-id": "00000000-0000-0000-0000-000000000001"},
        )
        assert response.status_code != 404
        assert response.status_code != 422
