"""PYQ: same theme in other years (post-test review) and the paper-set filter for subject-wise tests."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.hierarchy import Exam
from app.db.models.question import Question
from app.db.models.enums import QuestionStatus, QuestionSourceType
from app.core.security import create_access_token, get_password_hash

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}


async def _override_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    async with AsyncSession(test_engine, expire_on_commit=False) as session:
        if not _state:
            await _seed(session)
        yield session


async def _add(session, obj):
    session.add(obj)
    await session.commit()
    await session.refresh(obj)
    return obj


async def _seed(session: AsyncSession):
    def paper(code, year, set_code):
        return Exam(code=code, name=f"UPSC ({year})", source_year=year, paper_set_code=set_code,
                    exam_type=QuestionSourceType.PYQ, is_active=True)
    a2022 = await _add(session, paper("U22A", 2022, "SET_A"))
    b2022 = await _add(session, paper("U22B", 2022, "SET_B"))
    a2019 = await _add(session, paper("U19A", 2019, "SET_A"))
    bank = await _add(session, Exam(code="BANK", name="Mixed bank", source_year=2000, is_mixed_bank=True, is_active=True))

    def q(exam, n, **kw):
        return Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED, **kw)
    target = await _add(session, q(a2022, 1, knowledge_tags_ai=["polity"]))
    same_paper = await _add(session, q(a2022, 2))
    same_year_other_set = await _add(session, q(b2022, 1))
    other_year = await _add(session, q(a2019, 1))
    bank_2022 = await _add(session, q(bank, 1, source_year=2022))
    bank_2015 = await _add(session, q(bank, 2, source_year=2015))
    for n in (3, 4):
        await _add(session, q(b2022, n))
    u = await _add(session, User(full_name="S", email="s@sets.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    _state.update(target=target.id, same_paper=same_paper.id, same_year=same_year_other_set.id, other_year=other_year.id,
                  bank_2022=bank_2022.id, bank_2015=bank_2015.id, user=u.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")
        yield c
    app.dependency_overrides.pop(get_async_session, None)


def _h() -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state['user'], role='STUDENT')}"}


@pytest.mark.anyio
async def test_same_theme_in_other_years_only(client, monkeypatch):
    s = _state
    candidates = [s["same_paper"], s["same_year"], s["other_year"], s["bank_2022"], s["bank_2015"]]

    async def fake_similar(self, qid, limit=5):
        return [{"question_id": str(c), "similarity_score": 90 - i} for i, c in enumerate(candidates)][:limit]

    monkeypatch.setattr("app.services.question_service.QuestionService.get_similar_questions", fake_similar)
    url = f"/api/v1/questions/{s['target']}/similar"
    every = (await client.get(url, params={"limit": 5})).json()["results"]
    assert len(every) == 5  # unchanged without the option
    other = (await client.get(url, params={"limit": 5, "other_years_only": "true"})).json()["results"]
    # Not the same paper, not 2022 (incl. a mixed-bank question tagged 2022); a bank question's own year counts
    assert [int(r["question_id"]) for r in other] == [s["other_year"], s["bank_2015"]]
    assert [r["source_year"] for r in other] == [2019, 2015]


@pytest.mark.anyio
async def test_subject_wise_paper_set_filter(client):
    url = "/api/v1/attempts/dynamic-question-count"
    all_sets = (await client.get(url, headers=_h())).json()["count"]
    set_b = (await client.get(url, params={"dynamic_sets": "SET_B"}, headers=_h())).json()["count"]
    both = (await client.get(url, params={"dynamic_sets": "set_a,SET_B"}, headers=_h())).json()["count"]
    assert (set_b, both) == (3, 6) and all_sets >= both  # set codes are case-insensitive; a mixed bank never matches a set
    assert (await client.get(url, params={"dynamic_sets": "SET A!"}, headers=_h())).status_code == 422
