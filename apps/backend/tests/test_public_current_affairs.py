"""Unauthenticated current-affairs feed used by the public marketing site."""
import datetime as dt

import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.db.session import get_async_session
from app.db.models.current_affairs import CurrentAffair
from app.db.models.user import User, UserRole
from app.core.security import create_access_token, get_password_hash

BASE = "/api/v1/public/current-affairs"

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

_state: dict = {}


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _seed(session: AsyncSession):
    student = User(email="ca-student@example.com", full_name="Student", hashed_password=get_password_hash("x"), role=UserRole.STUDENT)
    session.add(student)
    rows = [
        CurrentAffair(title="Older economy item", content="**RBI** policy", topic="Economy", date=dt.date(2026, 9, 1)),
        CurrentAffair(title="Newer polity item", content="Bill passed", topic="Polity", date=dt.date(2026, 9, 2)),
        CurrentAffair(title="Hidden draft", content="draft", topic="Economy", is_published=False),
    ]
    session.add_all(rows)
    await session.commit()
    _state["student"] = student.id
    _state["older"], _state["newer"], _state["hidden"] = (r.id for r in rows)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get(BASE)  # triggers the seed
        yield c
    app.dependency_overrides.pop(get_async_session, None)


@pytest.mark.anyio
async def test_list_is_public_published_only_and_newest_first(client):
    res = await client.get(BASE)
    assert res.status_code == 200
    body = res.json()
    assert [i["id"] for i in body["items"]] == [_state["newer"], _state["older"]]
    assert body["total"] == 2 and body["page"] == 1 and body["size"] == 20
    # Internal fields never leak to the public feed
    assert "created_by_id" not in body["items"][0] and "is_published" not in body["items"][0]


@pytest.mark.anyio
async def test_list_paginates_and_filters_by_topic(client):
    page2 = (await client.get(BASE, params={"page": 2, "size": 1})).json()
    assert [i["id"] for i in page2["items"]] == [_state["older"]] and page2["total"] == 2

    economy = (await client.get(BASE, params={"topic": "Economy"})).json()
    assert [i["id"] for i in economy["items"]] == [_state["older"]]

    assert (await client.get(BASE, params={"size": 5000})).status_code == 422


@pytest.mark.anyio
async def test_detail_is_public_and_hides_unpublished(client):
    res = await client.get(f"{BASE}/{_state['newer']}")
    assert res.status_code == 200 and res.json()["title"] == "Newer polity item"

    assert (await client.get(f"{BASE}/{_state['hidden']}")).status_code == 404
    assert (await client.get(f"{BASE}/999999")).status_code == 404


@pytest.mark.anyio
async def test_authenticated_detail_no_longer_exposes_drafts_to_students(client):
    headers = {"Authorization": f"Bearer {create_access_token(subject=_state['student'], role='STUDENT')}"}
    res = await client.get(f"/api/v1/current-affairs/{_state['hidden']}", headers=headers)
    assert res.status_code == 404
