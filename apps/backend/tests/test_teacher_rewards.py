import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.core.security import create_access_token, get_password_hash

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

_seeded = False
_users = {}


async def override_get_session():
    global _seeded
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _seeded:
            await _seed(session)
            _seeded = True
        yield session


app.dependency_overrides[get_async_session] = override_get_session


async def _seed(session: AsyncSession):
    global _users
    teacher_a = User(full_name="Teacher A", email="teacher_reward_a@example.com", role=UserRole.TEACHER, password_hash=get_password_hash("x"))
    teacher_b = User(full_name="Teacher B", email="teacher_reward_b@example.com", role=UserRole.TEACHER, password_hash=get_password_hash("x"))
    admin = User(full_name="Admin", email="admin_reward@example.com", role=UserRole.ADMIN, password_hash=get_password_hash("x"))
    student = User(full_name="Student", email="student_reward@example.com", role=UserRole.STUDENT, password_hash=get_password_hash("x"))
    for u in (teacher_a, teacher_b, admin, student):
        session.add(u)
    await session.commit()
    for u in (teacher_a, teacher_b, admin, student):
        await session.refresh(u)
    _users = {"teacher_a": teacher_a, "teacher_b": teacher_b, "admin": admin, "student": student}


def _auth_header(user: User) -> dict:
    token = create_access_token(subject=user.id, role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


async def _seed_trigger(client: AsyncClient):
    # Re-assert our override: app.dependency_overrides is a single global dict,
    # and whichever test module was imported last otherwise wins for every test
    # in the session. Reasserting per-test makes this file order-independent.
    app.dependency_overrides[get_async_session] = override_get_session
    # Any request to an endpoint using get_async_session triggers seeding,
    # even with no/invalid auth (the session dependency resolves before auth checks run).
    await client.get("/api/v1/admin/teachers")


@pytest.mark.anyio
async def test_admin_can_grant_reward_and_teacher_sees_only_their_own():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _seed_trigger(client)

        admin_header = _auth_header(_users["admin"])
        teacher_a_header = _auth_header(_users["teacher_a"])
        teacher_b_header = _auth_header(_users["teacher_b"])

        resp = await client.post(
            f"/api/v1/admin/teachers/{_users['teacher_a'].id}/rewards",
            json={"title": "Great work", "description": "5 questions reviewed accurately", "points_value": 50},
            headers=admin_header,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Great work"

        resp_a = await client.get("/api/v1/teacher/rewards", headers=teacher_a_header)
        assert resp_a.status_code == 200
        assert len(resp_a.json()) == 1

        resp_b = await client.get("/api/v1/teacher/rewards", headers=teacher_b_header)
        assert resp_b.status_code == 200
        assert len(resp_b.json()) == 0


@pytest.mark.anyio
async def test_leaderboard_and_grant_are_admin_only():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _seed_trigger(client)
        student_header = _auth_header(_users["student"])

        resp = await client.get("/api/v1/admin/teachers", headers=student_header)
        assert resp.status_code == 403

        resp2 = await client.post(
            f"/api/v1/admin/teachers/{_users['teacher_a'].id}/rewards",
            json={"title": "Nope"},
            headers=student_header,
        )
        assert resp2.status_code == 403


@pytest.mark.anyio
async def test_teacher_cannot_grant_reward_to_self():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _seed_trigger(client)
        teacher_header = _auth_header(_users["teacher_a"])

        resp = await client.post(
            f"/api/v1/admin/teachers/{_users['teacher_a'].id}/rewards",
            json={"title": "Self reward"},
            headers=teacher_header,
        )
        assert resp.status_code == 403
