import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine

from app.fastapi_server import app
from app.db.session import get_async_session

from sqlalchemy.pool import StaticPool

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)


async def override_get_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine) as session:
        yield session


app.dependency_overrides[get_async_session] = override_get_session


@pytest.mark.anyio
async def test_root_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert response.json()["status"] == "online"


@pytest.mark.anyio
async def test_health_check_docs():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/docs")
        assert response.status_code == 200


@pytest.mark.anyio
async def test_register_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        payload = {
            "email": unique_email,
            "password": "Password123!",
            "full_name": "Test Register User",
            "role": "STUDENT",
        }
        response = await client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        assert data["user"]["subscription_tier"] == "FREE"


@pytest.mark.anyio
async def test_read_and_update_current_user():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        register_payload = {
            "email": unique_email,
            "password": "Password123!",
            "full_name": "Test Patch User",
            "role": "STUDENT",
        }
        reg_res = await client.post("/api/v1/auth/register", json=register_payload)
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Test GET /me
        get_res = await client.get("/api/v1/auth/me", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["email"] == unique_email

        # 2. Test PATCH /me successfully updates profile and language
        patch_res = await client.patch(
            "/api/v1/auth/me",
            headers=headers,
            json={"full_name": "Updated Name", "preferred_language": "Hindi"},
        )
        assert patch_res.status_code == 200
        data = patch_res.json()
        assert data["full_name"] == "Updated Name"
        assert data["preferred_language"] == "hi"

        # 3. Test PATCH /me with invalid language returns 400
        invalid_patch = await client.patch(
            "/api/v1/auth/me",
            headers=headers,
            json={"preferred_language": "invalid_fake_lang_xyz"},
        )
        assert invalid_patch.status_code == 400
        assert "Unsupported language" in invalid_patch.json()["detail"]


@pytest.mark.anyio
async def test_refresh_token_flow():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        unique_email = f"test_refresh_{uuid.uuid4().hex[:8]}@example.com"
        register_payload = {
            "email": unique_email,
            "password": "Password123!",
            "full_name": "Test Refresh User",
            "role": "STUDENT",
        }
        reg_res = await client.post("/api/v1/auth/register", json=register_payload)
        assert reg_res.status_code == 201
        old_access_token = reg_res.json()["access_token"]
        refresh_cookie = reg_res.cookies.get("refresh_token")
        assert refresh_cookie is not None

        # 1. Refresh via cookie
        refresh_res = await client.post("/api/v1/auth/refresh")
        assert refresh_res.status_code == 200
        new_access_token = refresh_res.json()["access_token"]
        assert new_access_token is not None
        assert new_access_token != old_access_token
        new_refresh_cookie = refresh_res.cookies.get("refresh_token")
        assert new_refresh_cookie is not None

        # 2. Use new access token to query /me
        me_res = await client.get(
            "/api/v1/auth/me", headers={"Authorization": f"Bearer {new_access_token}"}
        )
        assert me_res.status_code == 200
        assert me_res.json()["email"] == unique_email

        # 3. Old refresh token should now be revoked (rotation check)
        client.cookies.set("refresh_token", refresh_cookie)
        revoked_res = await client.post("/api/v1/auth/refresh")
        assert revoked_res.status_code == 401
        assert "revoked" in revoked_res.json()["detail"].lower() or "expired" in revoked_res.json()["detail"].lower()



