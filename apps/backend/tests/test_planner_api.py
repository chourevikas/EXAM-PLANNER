"""Study Planner v2 API: generate a plan from a syllabus, follow it, coverage, tracker, gating and sharing."""
from datetime import timedelta

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile, SubscriptionTier
from app.db.models.planner import PlannerExam, PlannerSubject, PlannerTopic, PlannerSubtopic, UserSyllabusCoverage
from app.db.models.study_plan import StudyTask
from app.core.security import create_access_token, get_password_hash
from app.db.models.exam_type import ExamType
from app.db.models.hierarchy import Exam, Subject, Topic, Subtopic, SyllabusVersion
from app.db.models.question import Question
from app.db.models.enums import ExamStatus, QuestionSourceType, QuestionStatus
from app.services.planner_service import today_ist

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}
API = "/api/v1/planner"


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
    upsc = await _add(session, ExamType(type="upsc", name="UPSC CSE", total_duration=120, number_of_questions=100,
                                        total_marks=200, negative_marks=0.66, positive_marks=2))
    paper = await _add(session, Exam(code="UPSC-2024", name="UPSC 2024", source_year=2024, exam_type_id=upsc.id,
                                     exam_type=QuestionSourceType.PYQ, status=ExamStatus.PUBLISHED, is_active=True))
    version = await _add(session, SyllabusVersion(exam_id=paper.id, version_code="v1"))
    bsub = await _add(session, Subject(name="Indian Polity & Governance", code="IPG", version_id=version.id))
    btop = await _add(session, Topic(name="Salient Features of Indian Constitution", code="SF", subject_id=bsub.id))
    bst = await _add(session, Subtopic(name="Constitution and Types", code="CT", topic_id=btop.id))
    await _add(session, Question(exam_id=paper.id, question_number_in_paper=1, status=QuestionStatus.PUBLISHED,
                                 subtopic_id=bst.id, source_year=2024))
    exam = await _add(session, PlannerExam(code="prelims", label="UPSC Prelims", exam_type_id=upsc.id))
    mains = await _add(session, PlannerExam(code="mains", label="UPSC Mains", answer_writing=True, sort_order=1))
    await _add(session, PlannerExam(code="hidden", label="Hidden", is_active=False, sort_order=2))
    subtopics = {}
    for si, (sname, topics) in enumerate({"Polity": {"Constitution": ["Preamble", "Fundamental Rights", "DPSP"],
                                                     "Parliament": ["Lok Sabha", "Rajya Sabha"]},
                                          "Economy": {"Banking": ["RBI", "NPAs", "SEBI"]}}.items()):
        s = await _add(session, PlannerSubject(exam_id=exam.id, name=sname, sort_order=si))
        for ti, (tname, subs) in enumerate(topics.items()):
            t = await _add(session, PlannerTopic(subject_id=s.id, name=tname, sort_order=ti))
            for i, n in enumerate(subs):
                subtopics[n] = (await _add(session, PlannerSubtopic(topic_id=t.id, name=n, sort_order=i))).id
    ms = await _add(session, PlannerSubject(exam_id=mains.id, name="GS-2"))
    mt = await _add(session, PlannerTopic(subject_id=ms.id, name="Polity"))
    await _add(session, PlannerSubtopic(topic_id=mt.id, name="Federalism"))

    def student(name):
        return User(full_name=name, email=f"{name.lower()}@pl.test", role=UserRole.STUDENT, password_hash=get_password_hash("x"))

    pro, free, other = await _add(session, student("Pro")), await _add(session, student("Free")), await _add(session, student("Other"))
    session.add_all([StudentProfile(user_id=pro.id, subscription_tier=SubscriptionTier.PREMIUM),
                     StudentProfile(user_id=free.id, subscription_tier=SubscriptionTier.FREE),
                     StudentProfile(user_id=other.id, subscription_tier=SubscriptionTier.PREMIUM)])
    await session.commit()
    _state.update(pro=pro.id, free=free.id, other=other.id, sub=subtopics)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async for _ in _override_session():
        pass
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")  # cached users (by id) must not leak into the next test file


def _h(who: str = "pro") -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state[who], role='STUDENT')}"}


def _db() -> AsyncSession:
    return AsyncSession(test_engine, expire_on_commit=False)


PLAN = {"exam": "prelims", "days": 5, "mock": None, "hours": 4}


@pytest.mark.anyio
async def test_exams_syllabus_and_estimate(client):
    exams = (await client.get(f"{API}/exams", headers=_h())).json()
    assert [e["code"] for e in exams] == ["prelims", "mains"]
    syl = (await client.get(f"{API}/syllabus/prelims", headers=_h())).json()
    assert syl["total"] == 8 and syl["percent"] == 0 and [s["name"] for s in syl["subjects"]] == ["Polity", "Economy"]
    assert (await client.get(f"{API}/syllabus/hidden", headers=_h())).status_code == 404
    est = (await client.post(f"{API}/estimate", json={**PLAN, "subjects": ["Polity"]}, headers=_h())).json()
    assert est["text"].startswith("1 subject(s), 5 topics → about 1 topic per day over 5 study day(s)")
    bad = await client.post(f"{API}/estimate", json={**PLAN, "exam_date": str(today_ist())}, headers=_h())
    assert bad.status_code == 422 and "future" in bad.json()["detail"]


@pytest.mark.anyio
async def test_free_plan_limits(client):
    res = await client.post(f"{API}/generate", json={**PLAN, "days": 30}, headers=_h("free"))
    assert res.status_code == 403 and res.json()["detail"]["code"] == "PRO_STUDY_PLANNER"
    assert (await client.post(f"{API}/generate", json={**PLAN, "weak_first": True}, headers=_h("free"))).status_code == 403
    assert (await client.post(f"{API}/generate", json=PLAN, headers=_h("free"))).status_code == 200
    for path in ("/share", "/revision-plan/add"):
        assert (await client.post(f"{API}{path}", headers=_h("free"))).status_code == 403
    assert (await client.get(f"{API}/plan-tasks", headers=_h("free"))).status_code == 403
    settings = (await client.get(f"{API}/settings", headers=_h("free"))).json()
    assert settings["pro"] is False and settings["prefs"]["days"] == 5


@pytest.mark.anyio
async def test_generate_follow_and_rebuild(client):
    today = today_ist()
    s = _db()
    s.add(StudyTask(user_id=_state["pro"], title="My own task", scheduled_date=today))
    await s.commit()

    res = (await client.post(f"{API}/generate", json={**PLAN, "custom_title": "Revise notes"}, headers=_h())).json()
    assert res["topics"] == 8 and res["days"] == 5 and "Scheduled 8 topic(s) over 5 study day(s)" in res["message"]
    day = (await client.get(f"{API}/tasks", params={"start": str(today), "end": str(today)}, headers=_h())).json()
    # 8 topics over 5 days: one topic today (own task first)
    assert [t["block"] for t in day] == [None, None, "ca", "custom", "pyq"]
    assert day[1]["title"] == "Constitution: Preamble" and day[1]["planned"] and not day[0]["planned"]
    # Practice opens the planner exam's question-bank exam, filtered to the closest subject
    assert day[1]["practice"] == {"exam": "UPSC", "subject": "Indian Polity & Governance"}
    pyq = next(t for t in day if t["block"] == "pyq")
    assert pyq["practice"] == {"exam": "UPSC", "subject": "Indian Polity & Governance"}
    assert next(t for t in day if t["block"] == "ca")["practice"] is None

    ov = (await client.get(f"{API}/overview", headers=_h())).json()
    assert ov["topics"] == 8 and ov["days"] == 5 and ov["plan"]["exam"] == "prelims"
    assert [x["name"] for x in ov["subjects"]] == ["Polity", "Economy"]

    # Finishing a plan topic covers its subtopic and lines up revisions at +1, +3, +7 and +21 days
    topic = day[1]
    assert (await client.post(f"/api/v1/study-plan/tasks/{topic['id']}/complete", headers=_h())).status_code == 200
    syl = (await client.get(f"{API}/syllabus/prelims", headers=_h())).json()
    assert syl["done"] == 1 and syl["week_done"] == 1
    s = _db()
    revs = (await s.exec(select(StudyTask).where(StudyTask.block == "auto_rev"))).all()
    assert sorted((r.scheduled_date - today).days for r in revs) == [1, 3, 7, 21]
    assert revs[0].title == "Revise: Constitution: Preamble"
    # Finishing a revision does not line up revisions of the revision
    rev = min(revs, key=lambda r: r.scheduled_date)
    assert (await client.post(f"/api/v1/study-plan/tasks/{rev.id}/complete", headers=_h())).status_code == 200
    s = _db()
    assert len((await s.exec(select(StudyTask).where(StudyTask.block == "auto_rev"))).all()) == 4
    await client.post(f"{API}/tasks/{rev.id}/reopen", headers=_h())

    # Skip moves a task to the next day; reopen un-ticks
    skipped = day[2]
    assert (await client.post(f"{API}/tasks/{skipped['id']}/skip", headers=_h())).json()["date"] == str(today + timedelta(days=1))
    await client.post(f"{API}/tasks/{topic['id']}/reopen", headers=_h())
    await client.post(f"/api/v1/study-plan/tasks/{topic['id']}/complete", headers=_h())

    # Rebuilding keeps completed and own tasks, and skips the covered subtopic
    res = (await client.post(f"{API}/generate", json=PLAN, headers=_h())).json()
    assert res["topics"] == 7
    # My plan counts only the new plan: the topic finished under the old plan isn't in it
    ov = (await client.get(f"{API}/overview", headers=_h())).json()
    assert ov["topics"] == 7 and ov["done"] == 0
    s = _db()
    titles = [t.title for t in (await s.exec(select(StudyTask).where(StudyTask.user_id == _state["pro"]))).all()]
    assert "My own task" in titles and titles.count("Constitution: Preamble") == 1

    # Clearing removes open generated tasks only
    assert (await client.delete(f"{API}/plan", headers=_h())).json()["removed"] > 0
    left = (await _db().exec(select(StudyTask).where(StudyTask.user_id == _state["pro"]))).all()
    assert {t.title for t in left} == {"My own task", "Constitution: Preamble"}


@pytest.mark.anyio
async def test_catch_up_tracker_focus_and_settings(client):
    await client.post(f"{API}/generate", json={**PLAN, "auto_catch": False}, headers=_h("other"))
    today = today_ist()
    s = _db()
    tasks = (await s.exec(select(StudyTask).where(StudyTask.user_id == _state["other"], StudyTask.block.is_(None)))).all()
    for t in tasks[:3]:
        t.scheduled_date = today - timedelta(days=2)
        s.add(t)
    await s.commit()
    assert (await client.get(f"{API}/overview", headers=_h("other"))).json()["missed"] == 3
    assert (await client.post(f"{API}/catch-up", headers=_h("other"))).json()["moved"] == 3
    assert (await client.get(f"{API}/overview", headers=_h("other"))).json()["missed"] == 0

    await client.put(f"{API}/settings", json={"daily_goal": 2, "weekly_target": 9}, headers=_h("other"))
    await client.post(f"{API}/focus", json={"minutes": 25, "task_id": tasks[0].id}, headers=_h("other"))
    tr = (await client.get(f"{API}/tracker", params={"range": "week"}, headers=_h("other"))).json()
    assert tr["daily_goal"] == 2 and tr["focus_minutes"] == 25 and tr["total"] > 0 and len(tr["calendar"]) == 7
    assert any("Nothing is planned" in t or "daily goal" in t for t in tr["tips"])
    month = (await client.get(f"{API}/tracker", params={"range": "month"}, headers=_h("other"))).json()
    assert month["start"].endswith("-01") and len(month["calendar"]) >= 28


@pytest.mark.anyio
async def test_mains_answer_writing_share_import_and_revision_plan(client):
    res = await client.post(f"{API}/generate", json={"exam": "mains", "days": 3, "mock": None}, headers=_h("other"))
    assert res.status_code == 200
    day = (await client.get(f"{API}/tasks", params={"start": str(today_ist()), "end": str(today_ist())}, headers=_h("other"))).json()
    assert "aw" in [t["block"] for t in day]

    token = (await client.post(f"{API}/share", headers=_h("other"))).json()["token"]
    summary = (await client.get(f"{API}/share/{token}", headers=_h())).json()
    assert summary["exam_label"] == "UPSC Mains" and summary["days"] == 1
    imported = (await client.post(f"{API}/share/{token}/import", headers=_h())).json()["imported"]
    assert imported == summary["tasks"]
    assert (await client.get(f"{API}/share/nope", headers=_h())).status_code == 404

    rp = (await client.get(f"{API}/revision-plan", headers=_h())).json()
    assert rp["sample"] is True and len(rp["plan"]) == 7
    assert (await client.post(f"{API}/revision-plan/add", headers=_h())).json()["added"] == 13


@pytest.mark.anyio
async def test_free_students_cannot_import_long_plans_and_shares_carry_only_the_current_plan(client):
    await client.post(f"{API}/generate", json={**PLAN, "days": 3}, headers=_h("other"))
    await client.post(f"{API}/generate", json={**PLAN, "days": 20}, headers=_h("other"))  # replaces the 3-day plan
    token = (await client.post(f"{API}/share", headers=_h("other"))).json()["token"]
    summary = (await client.get(f"{API}/share/{token}", headers=_h("free"))).json()
    assert summary["days"] == 20
    res = await client.post(f"{API}/share/{token}/import", headers=_h("free"))
    assert res.status_code == 403 and res.json()["detail"]["code"] == "PRO_STUDY_PLANNER"
    assert (await client.post(f"{API}/share/{token}/import", headers=_h())).status_code == 200


def test_practice_filters_use_the_closest_bank_match():
    from app.services.planner_service import _BankIndex, _join_filter
    bank = _BankIndex([
        (1, "Indian Polity & Governance", "Constitutional Bodies", "Finance Commission", 4),
        (2, "History", "Medieval India", "Delhi Sultanate", 3),
        (3, "Indian Culture", "Architecture", "Temple Architecture", 2),
        (4, "Economy", "Money and Banking", "RBI", 0),  # no questions: never a target
    ])
    assert bank.resolve(1, "x", "x", "x") == {"subject": "Indian Polity & Governance", "topic": "Constitutional Bodies",
                                              "subtopic": "Finance Commission"}
    assert bank.resolve(None, "Polity", "Bodies", "finance commission")["subtopic"] == "Finance Commission"
    assert bank.resolve(None, "Indian History", "Medieval India", "Mughals") == {"subject": "History", "topic": "Medieval India"}
    # "Indian" alone doesn't make Indian History match Indian Culture
    assert bank.resolve(None, "Indian History", "Ancient", "Vedic Age") == {"subject": "History"}
    assert bank.resolve(None, "Indian Economy", "Banking", "RBI") == {}
    assert _join_filter(["History", "History", "Polity"]) == "History,Polity"
    assert _join_filter(["Art, Culture", "History"]) == "Art, Culture;;History"


def test_practice_filters_match_on_shared_words():
    from app.services.planner_service import _BankIndex
    bank = _BankIndex([
        (1, "Indian Polity & Governance", "Union & Its Territory", "Article 1-4", 6),
        (2, "Indian Polity & Governance", "Salient Features of Indian Constitution", "Constitution and Types", 6),
        (3, "Polity", "Local Self-Government", "73rd Amendment — Panchayati Raj", 3),
        (4, "Polity", "Fundamental Rights", "Article 32", 11),
        (5, "Geography", "World Map related", "Countries, Capitals & Geographical Features", 2),
    ])
    polity = ("Polity and Governance", "Constitution")
    assert bank.resolve(None, *polity, "Union and its Territory") == {"subject": "Indian Polity & Governance", "topic": "Union & Its Territory"}
    assert bank.resolve(None, *polity, "Salient Features")["topic"] == "Salient Features of Indian Constitution"
    assert bank.resolve(None, "Polity and Governance", "Local Government", "Panchayati Raj (73rd Amendment)")["subtopic"] == "73rd Amendment — Panchayati Raj"
    # The topic's words ("Union Government") don't drag unrelated subtopics onto "Union & Its Territory"
    assert bank.resolve(None, "Polity and Governance", "Union Government", "Parliament") == {"subject": "Indian Polity & Governance"}
    # "Features" alone isn't a match, and another subject needs two shared words
    assert bank.resolve(None, "Indian Society", "Society", "Salient Features") == {}
