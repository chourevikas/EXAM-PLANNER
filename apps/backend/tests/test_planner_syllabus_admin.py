"""Study Planner v2: the admin-editable planner syllabus."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.hierarchy import Exam, Subject, Topic, Subtopic, SyllabusVersion
from app.db.models.planner import PlannerExam, PlannerSubtopic, UserSyllabusCoverage
from app.db.models.study_plan import StudyTask
from app.db.models.enums import ExamStatus, QuestionSourceType, QuestionStatus
from app.db.models.question import Question
from app.core.security import create_access_token, get_password_hash
from app.db.models.exam_type import ExamType
from app.services.planner_syllabus_service import parse_import

test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_state: dict = {}
API = "/api/v1/admin"


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
    exam = await _add(session, Exam(code="PS-1", name="UPSC 2024", exam_type_id=upsc.id, source_year=2024, exam_type=QuestionSourceType.PYQ,
                                    status=ExamStatus.PUBLISHED, is_active=True))
    version = await _add(session, SyllabusVersion(exam_id=exam.id, version_code="v1"))
    subject = await _add(session, Subject(name="Polity", code="POL", version_id=version.id))
    topic = await _add(session, Topic(name="Constitution", code="CON", subject_id=subject.id))
    bank = await _add(session, Subtopic(name="Preamble", code="PRE", topic_id=topic.id))
    # An MPSC paper with its own "Preamble" (and more questions): UPSC syllabi must never link to it
    mpsc = await _add(session, ExamType(type="mpsc", name="MPSC State Services", total_duration=120,
                                        number_of_questions=100, total_marks=200, negative_marks=0.5, positive_marks=2))
    m_exam = await _add(session, Exam(code="MP-1", name="MPSC 2023", exam_type_id=mpsc.id, source_year=2023,
                                      exam_type=QuestionSourceType.PYQ, status=ExamStatus.PUBLISHED, is_active=True))
    m_ver = await _add(session, SyllabusVersion(exam_id=m_exam.id, version_code="v1"))
    m_sub = await _add(session, Subject(name="Polity", code="POL", version_id=m_ver.id))
    m_top = await _add(session, Topic(name="Constitution", code="CON", subject_id=m_sub.id))
    m_bank = await _add(session, Subtopic(name="Preamble", code="PRE", topic_id=m_top.id))
    cds = await _add(session, ExamType(type="cds", name="CDS", total_duration=120, number_of_questions=120,
                                       total_marks=100, negative_marks=0.33, positive_marks=1))  # no papers yet
    for n in (1, 2):
        await _add(session, Question(exam_id=m_exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED,
                                     subtopic_id=m_bank.id, source_year=2023))
    admin = await _add(session, User(full_name="Admin", email="admin@ps.test", role=UserRole.ADMIN, password_hash=get_password_hash("x")))
    student = await _add(session, User(full_name="Stu", email="stu@ps.test", role=UserRole.STUDENT, password_hash=get_password_hash("x")))
    _state.update(admin=admin.id, student=student.id, bank=bank.id, upsc=upsc.id, mpsc=mpsc.id, cds=cds.id)


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async for _ in _override_session():  # seeds _state before the test builds its headers
        pass
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_async_session, None)
    await get_cache().delete_pattern("*")  # cached users (by id) must not leak into the next test file


def _h(who: str = "admin", role: str = "ADMIN") -> dict:
    return {"Authorization": f"Bearer {create_access_token(subject=_state[who], role=role)}"}


def test_parse_import_line_and_json_formats():
    tree = parse_import("Polity|Constitution:Preamble, Citizenship;Parliament:Lok Sabha\nPolity|Parliament:Rajya Sabha")
    assert tree == {"Polity": {"Constitution": ["Preamble", "Citizenship"], "Parliament": ["Lok Sabha", "Rajya Sabha"]}}
    assert parse_import('{"Economy": {"Banking": ["RBI"]}}') == {"Economy": {"Banking": ["RBI"]}}
    for bad in ("", "no pipe here", "Polity|Constitution", "[1, 2]", "{bad json"):
        with pytest.raises(ValueError):
            parse_import(bad)


@pytest.mark.anyio
async def test_students_cannot_use_admin_api(client):
    assert (await client.get(f"{API}/exam-types/{_state['upsc']}/syllabi", headers=_h("student", "STUDENT"))).status_code == 403


@pytest.mark.anyio
async def test_build_edit_import_and_delete_a_syllabus(client):
    base = f"{API}/exam-types/{_state['upsc']}/syllabi"
    res = await client.post(base, json={"stage": "prelims"}, headers=_h())
    assert res.status_code == 201, res.text
    exam = res.json()
    assert (exam["label"], exam["answer_writing"]) == ("UPSC Prelims", False)
    assert (await client.post(base, json={"stage": "prelims"}, headers=_h())).status_code == 409
    assert (await client.post(base, json={"stage": "optional"}, headers=_h())).status_code == 422
    geo = (await client.post(base, json={"stage": "optional", "name": "Geography"}, headers=_h())).json()
    assert (geo["label"], geo["answer_writing"]) == ("UPSC Optional: Geography", True)
    assert (await client.post(f"{API}/exam-types/999/syllabi", json={"stage": "mains"}, headers=_h())).status_code == 404
    assert [x["label"] for x in (await client.get(base, headers=_h())).json()] == ["UPSC Prelims", "UPSC Optional: Geography"]

    N = f"{API}/syllabi/nodes"
    subj = (await client.post(f"{N}/subjects", json={"parent_id": exam["id"], "name": "Polity"}, headers=_h())).json()
    top = (await client.post(f"{N}/topics", json={"parent_id": subj["id"], "name": "Constitution"}, headers=_h())).json()
    a = (await client.post(f"{N}/subtopics", json={"parent_id": top["id"], "name": "Fundamental Rights"}, headers=_h())).json()
    b = (await client.post(f"{N}/subtopics", json={"parent_id": top["id"], "name": "DPSP"}, headers=_h())).json()
    assert (a["sort_order"], b["sort_order"]) == (0, 1)
    assert (await client.post(f"{N}/subtopics", json={"parent_id": 99999, "name": "x"}, headers=_h())).status_code == 404

    # Merge import adds only what is new, and links "Preamble" to the UPSC bank's Preamble, not the busier MPSC one
    S = f"{API}/syllabi/{exam['id']}"
    res = await client.post(f"{S}/import", headers=_h(), json={
        "text": "polity|Constitution:DPSP,Preamble;Parliament:Lok Sabha\nHistory|Modern:1857", "mode": "merge"})
    assert res.json()["added"] == {"subjects": 1, "topics": 2, "subtopics": 3}

    tree = (await client.get(f"{S}/tree", headers=_h())).json()
    assert [s["name"] for s in tree["subjects"]] == ["Polity", "History"]
    con = tree["subjects"][0]["topics"][0]
    assert [st["name"] for st in con["subtopics"]] == ["Fundamental Rights", "DPSP", "Preamble"]
    preamble = con["subtopics"][2]
    assert preamble["bank_subtopic_id"] == _state["bank"] and preamble["bank_label"] == "Polity › Constitution › Preamble (UPSC 2024)"
    assert tree["syllabus"]["subtopics"] == 5

    # Reorder, rename, map and unmap; bank search stays inside the exam type
    await client.post(f"{N}/subtopics/reorder", json={"ids": [preamble["id"], b["id"], a["id"]]}, headers=_h())
    await client.patch(f"{N}/subtopics/{a['id']}", json={"name": "Fundamental Rights (Part III)", "bank_subtopic_id": _state["bank"]}, headers=_h())
    await client.patch(f"{N}/subtopics/{preamble['id']}", json={"clear_bank": True}, headers=_h())
    con = (await client.get(f"{S}/tree", headers=_h())).json()["subjects"][0]["topics"][0]
    assert [(st["name"], st["bank_subtopic_id"]) for st in con["subtopics"]] == [
        ("Preamble", None), ("DPSP", None), ("Fundamental Rights (Part III)", _state["bank"])]
    found = (await client.get(f"{S}/bank-subtopics", params={"q": "pream"}, headers=_h())).json()
    assert found == [{"id": _state["bank"], "label": "Polity › Constitution › Preamble (UPSC 2024)"}]

    # Deleting a subject removes its subtopics, the students' coverage of them, and unlinks their tasks
    async for session in _override_session():
        session.add(UserSyllabusCoverage(user_id=_state["student"], planner_subtopic_id=a["id"]))
        session.add(StudyTask(user_id=_state["student"], title="FR", planner_subtopic_id=a["id"]))
        await session.commit()
    assert (await client.delete(f"{N}/subjects/{subj['id']}", headers=_h())).status_code == 204
    async for session in _override_session():
        assert (await session.exec(select(UserSyllabusCoverage))).all() == []
        assert (await session.exec(select(StudyTask))).one().planner_subtopic_id is None
        assert [s.name for s in (await session.exec(select(PlannerSubtopic))).all()] == ["1857"]

    # Replace import wipes the old tree; rename only optionals; hide; the exam type can't go while it has syllabi
    res = await client.post(f"{S}/import", headers=_h(), json={"text": '{"Economy": {"Banking": ["RBI"]}}', "mode": "replace"})
    assert res.json()["added"] == {"subjects": 1, "topics": 1, "subtopics": 1}
    assert (await client.patch(S, json={"name": "Other"}, headers=_h())).status_code == 422
    assert (await client.patch(f"{API}/syllabi/{geo['id']}", json={"name": "Geography (Paper I)"}, headers=_h())).json()["label"] == "UPSC Optional: Geography (Paper I)"
    assert (await client.patch(S, json={"is_active": False}, headers=_h())).json()["is_active"] is False
    assert (await client.post(f"{S}/import", headers=_h(), json={"text": "nope"})).status_code == 422
    cds = (await client.post(f"{API}/exam-types/{_state['cds']}/syllabi", json={"stage": "prelims"}, headers=_h())).json()
    blocked = await client.delete(f"{API}/exam-types/{_state['cds']}", headers=_h())
    assert blocked.status_code == 400 and "study syllabus" in blocked.json()["detail"]
    assert (await client.delete(f"{API}/syllabi/{cds['id']}", headers=_h())).status_code == 204
    assert (await client.delete(f"{API}/exam-types/{_state['cds']}", headers=_h())).status_code == 200
    for x in (exam, geo):
        assert (await client.delete(f"{API}/syllabi/{x['id']}", headers=_h())).status_code == 204
    async for session in _override_session():
        assert (await session.exec(select(PlannerExam))).all() == []
        assert (await session.exec(select(PlannerSubtopic))).all() == []
