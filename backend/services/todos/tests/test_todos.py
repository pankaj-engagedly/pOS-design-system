"""Todo service tests — lists, tasks, subtasks CRUD."""

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
        assert data["service"] == "pos-todos"


@pytest.mark.asyncio
async def test_list_lists_requires_user_id(app):
    """Test that list endpoint requires user_id in request state."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/todos/lists")
        # Without user_id in request.state, should fail
        assert response.status_code in (401, 422, 500)


@pytest.mark.asyncio
async def test_create_task_validation(app):
    """Test task creation with invalid data."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing required fields
        response = await client.post("/api/todos/tasks", json={})
        assert response.status_code in (422, 500)
