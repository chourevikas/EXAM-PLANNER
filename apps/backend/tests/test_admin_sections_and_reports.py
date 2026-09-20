"""Admin section permissions (role-based access for admins) and student question reports."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole
from app.db.models.roles import Role, Permission, RolePermission
from app.db.models.hierarchy import Exam
from app.db.models.question import Question, QuestionTranslation
from app.db.models.enums import QuestionStatus, LanguageCode
from app.core.security import create_access_token, get_password_hash

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
    exam = Exam(code="SEC-2026", name="Sections Exam")
    session.add(exam)
    await session.commit()
    await session.refresh(exam)

    questions = []
    for n in (1, 2):
        q = Question(exam_id=exam.id, question_number_in_paper=n, status=QuestionStatus.PUBLISHED)
        session.add(q)
        await session.commit()
        await session.refresh(q)
        session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text=f"Question text {n}"))
        questions.append(q.id)
    await session.commit()

    perms = {}
    for key in ("admin.testimonials", "admin.review", "admin.reported_questions"):
        p = Permission(key=key, label=key)
        session.add(p)
        await session.commit()
        await session.refresh(p)
        perms[key] = p

    def make_role(name, key):
        return Role(name=name, slug=name.lower().replace(" ", "-"), base_role_type=UserRole.ADMIN)

    roles = {}
    for name, key in (("Testimonial Mod", "admin.testimonials"), ("QA Only", "admin.review"), ("Report Triage", "admin.reported_questions")):
        r = make_role(name, key)
        session.add(r)
        await session.commit()
        await session.refresh(r)
        session.add(RolePermission(role_id=r.id, permission_id=perms[key].id))
        await session.commit()
        roles[key] = r

    def user(name, role, custom_role_id=None):
        return User(
            full_name=name,
            email=f"{name.lower().replace(' ', '_')}@sections.test",
            role=role,
            custom_role_id=custom_role_id,
            password_hash=get_password_hash("x"),
        )

    users = {
        "student": user("Student One", UserRole.STUDENT),
        "student2": user("Student Two", UserRole.STUDENT),
        "super": user("Super Admin", UserRole.SUPER_ADMIN),
        "admin_open": user("Admin Open", UserRole.ADMIN),
        "admin_testimonials": user("Admin Testimonials", UserRole.ADMIN, roles["admin.testimonials"].id),
        "admin_qa": user("Admin QA", UserRole.ADMIN, roles["admin.review"].id),
        "admin_triage": user("Admin Triage", UserRole.ADMIN, roles["admin.reported_questions"].id),
    }
    for u in users.values():
        session.add(u)
    await session.commit()
    for u in users.values():
        await session.refresh(u)

    # An unreviewed question (must never reach students) in the same exam.
    unreviewed = Question(exam_id=exam.id, question_number_in_paper=3, status=QuestionStatus.PENDING_HUMAN_REVIEW)
    session.add(unreviewed)
    await session.commit()
    await session.refresh(unreviewed)
    session.add(QuestionTranslation(question_id=unreviewed.id, language=LanguageCode.ENGLISH, question_text="Unreviewed question text"))
    await session.commit()

    # A separate exam for attempt tests: 2 published + 1 unreviewed question.
    exam2 = Exam(code="ATT-2026", name="Attempt Exam", is_active=True)
    session.add(exam2)
    await session.commit()
    await session.refresh(exam2)
    for n, st in ((1, QuestionStatus.PUBLISHED), (2, QuestionStatus.PUBLISHED), (3, QuestionStatus.PENDING_HUMAN_REVIEW)):
        session.add(Question(exam_id=exam2.id, question_number_in_paper=n, status=st))
    await session.commit()

    _state.update(
        users={k: (u.id, u.role.value) for k, u in users.items()},
        questions=questions,
        unreviewed=unreviewed.id,
        exam_id=exam.id,
        attempt_exam_id=exam2.id,
    )


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    # get_current_user caches users by id; ids collide with other test modules' in-memory DBs.
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        # trigger seeding, then drop any user cached from the seeding request
        await c.get("/api/v1/auth/languages")
        await c.get("/api/v1/testimonials/admin/all")
        await get_cache().delete_pattern("*")
        yield c
    # don't leak cached users (ids collide across modules' in-memory DBs) into later test modules
    await get_cache().delete_pattern("*")


# ── Admin sections ───────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_section_permission_gates_admin_endpoint(client):
    url = "/api/v1/testimonials/admin/all"
    assert (await client.get(url, headers=_h("super"))).status_code == 200
    assert (await client.get(url, headers=_h("admin_open"))).status_code == 200  # no custom role: unrestricted
    assert (await client.get(url, headers=_h("admin_testimonials"))).status_code == 200
    assert (await client.get(url, headers=_h("admin_qa"))).status_code == 403
    assert (await client.get(url, headers=_h("student"))).status_code == 403
    assert (await client.get(url)).status_code == 401


@pytest.mark.anyio
async def test_me_reports_admin_permissions(client):
    me_open = (await client.get("/api/v1/auth/me", headers=_h("admin_open"))).json()
    assert me_open["admin_permissions"] is None
    me_qa = (await client.get("/api/v1/auth/me", headers=_h("admin_qa"))).json()
    assert me_qa["admin_permissions"] == ["admin.review"]
    me_super = (await client.get("/api/v1/auth/me", headers=_h("super"))).json()
    assert me_super["admin_permissions"] is None


@pytest.mark.anyio
async def test_question_write_endpoints_require_admin(client):
    qid = _state["questions"][0]
    assert (await client.put(f"/api/v1/questions/{qid}", json={})).status_code == 401
    assert (await client.patch(f"/api/v1/questions/{qid}", json={})).status_code == 401
    assert (await client.post("/api/v1/questions", json={})).status_code == 401
    assert (await client.put(f"/api/v1/questions/{qid}", json={}, headers=_h("student"))).status_code == 403
    # Restricted to another section: still forbidden.
    assert (await client.put(f"/api/v1/questions/{qid}", json={}, headers=_h("admin_testimonials"))).status_code == 403


@pytest.mark.anyio
async def test_user_detail_is_self_or_admin_only(client):
    other_id, _ = _state["users"]["student2"]
    own_id, _ = _state["users"]["student"]
    assert (await client.get(f"/api/v1/users/{other_id}", headers=_h("student"))).status_code == 403
    own = await client.get(f"/api/v1/users/{own_id}", headers=_h("student"))
    assert own.status_code == 200
    assert "password_hash" not in own.json()
    assert (await client.get(f"/api/v1/users/{other_id}", headers=_h("admin_open"))).status_code == 200
    assert (await client.get(f"/api/v1/users/{other_id}", headers=_h("admin_qa"))).status_code == 403


# ── Question reports ─────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_student_can_report_once_and_admin_triages(client):
    qid = _state["questions"][0]
    url = f"/api/v1/questions/{qid}/report"

    assert (await client.post(url, json={"reason": "TYPO"})).status_code == 401
    assert (await client.post(url, json={"reason": "NOT_A_REASON"}, headers=_h("student"))).status_code == 422
    assert (await client.post(url, json={"reason": "OTHER"}, headers=_h("student"))).status_code == 422  # needs text
    assert (await client.post("/api/v1/questions/99999/report", json={"reason": "TYPO"}, headers=_h("student"))).status_code == 404

    ok = await client.post(url, json={"reason": "WRONG_ANSWER", "description": "Key says A"}, headers=_h("student"))
    assert ok.status_code == 201
    dup = await client.post(url, json={"reason": "TYPO"}, headers=_h("student"))
    assert dup.status_code == 409
    assert (await client.post(url, json={"reason": "TYPO"}, headers=_h("student2"))).status_code == 201

    list_url = "/api/v1/admin/reported-questions"
    assert (await client.get(list_url, headers=_h("student"))).status_code == 403
    assert (await client.get(list_url, headers=_h("admin_qa"))).status_code == 403  # review-only admin
    listed = await client.get(list_url, headers=_h("admin_triage"))
    assert listed.status_code == 200
    body = listed.json()
    assert body["total"] == 1
    item = body["items"][0]
    assert item["question_id"] == qid and item["report_count"] == 2
    assert item["question_text"] == "Question text 1"
    assert item["reasons"] == {"WRONG_ANSWER": 1, "TYPO": 1}

    summary = (await client.get(f"{list_url}/summary", headers=_h("super"))).json()
    assert summary == {"open_reports": 2, "open_questions": 1}


@pytest.mark.anyio
async def test_unpublish_hides_question_and_reject_keeps_it(client):
    q_unpublish, q_reject = _state["questions"][0], _state["questions"][1]
    # Reports may already exist from the other test; use a fresh reporter-free path via student2/student.
    for qid, who in ((q_unpublish, "student"), (q_reject, "student2")):
        await client.post(f"/api/v1/questions/{qid}/report", json={"reason": "TYPO"}, headers=_h(who))

    base = "/api/v1/admin/reported-questions"
    res = await client.post(f"{base}/{q_unpublish}/unpublish", json={"note": "fixing"}, headers=_h("admin_triage"))
    assert res.status_code == 200 and res.json()["question_status"] == "REJECTED"
    assert (await client.get(f"/api/v1/questions/{q_unpublish}")).status_code == 404  # hidden from students

    res = await client.post(f"{base}/{q_reject}/reject", json={}, headers=_h("admin_triage"))
    assert res.status_code == 200 and res.json()["status"] == "REJECTED"
    assert (await client.get(f"/api/v1/questions/{q_reject}")).status_code == 200  # still published

    # Nothing left open for either question.
    again = await client.post(f"{base}/{q_reject}/reject", json={}, headers=_h("admin_triage"))
    assert again.status_code == 404


# ── Students only get published questions ────────────────────────────────────

def _ids(payload) -> set:
    items = payload.get("items") or payload.get("questions") or []
    return {int(q.get("question_id") or q.get("id")) for q in items}


@pytest.mark.anyio
async def test_question_list_hides_unreviewed_from_students_but_not_staff(client):
    uid = _state["unreviewed"]
    anon = await client.get("/api/v1/questions?limit=50")
    assert uid not in _ids(anon.json())
    student = await client.get("/api/v1/questions?limit=50", headers=_h("student"))
    assert uid not in _ids(student.json())
    # A student cannot opt in to other statuses either.
    forced = await client.get("/api/v1/questions?limit=50&status=PENDING_HUMAN_REVIEW", headers=_h("student"))
    assert uid not in _ids(forced.json())

    admin = await client.get("/api/v1/questions?limit=50", headers=_h("admin_open"))
    assert uid in _ids(admin.json())
    only_pending = await client.get("/api/v1/questions?limit=50&status=PENDING_HUMAN_REVIEW", headers=_h("admin_open"))
    pending_ids = _ids(only_pending.json())
    assert uid in pending_ids
    assert not (pending_ids & set(_state["questions"]))  # published ones are not in the pending filter


@pytest.mark.anyio
async def test_unreviewed_question_detail_and_solution_are_404_for_students(client):
    uid = _state["unreviewed"]
    for path in (f"/api/v1/questions/{uid}", f"/api/v1/questions/{uid}/solution", f"/api/v1/questions/{uid}/formatted/markdown"):
        assert (await client.get(path)).status_code == 404, path
        assert (await client.get(path, headers=_h("student"))).status_code == 404, path
    assert (await client.get(f"/api/v1/questions/{uid}", headers=_h("admin_open"))).status_code == 200
    # A published question is still served to everyone.
    published = _state["questions"][1]
    assert (await client.get(f"/api/v1/questions/{published}")).status_code == 200


@pytest.mark.anyio
async def test_exam_review_and_artifact_endpoints_hide_unreviewed(client):
    eid = _state["exam_id"]
    uid = _state["unreviewed"]
    anon = await client.get(f"/api/v1/exams/{eid}/review-questions?limit=50")
    assert anon.status_code == 200 and uid not in _ids(anon.json())
    staff = await client.get(f"/api/v1/exams/{eid}/review-questions?limit=50", headers=_h("admin_open"))
    assert uid in _ids(staff.json())
    # question #3 is the unreviewed one
    assert (await client.get(f"/api/v1/exams/{eid}/question-db/3")).status_code == 404
    assert (await client.get(f"/api/v1/exams/{eid}/solution-db/3")).status_code == 404
    # Exports are admin-only.
    assert (await client.get("/api/v1/exams/export-zip?exam_name=x")).status_code == 401
    assert (await client.get("/api/v1/exams/export-zip?exam_name=x", headers=_h("student"))).status_code == 403


@pytest.mark.anyio
async def test_exam_attempt_only_includes_published_questions(client):
    res = await client.post(
        "/api/v1/attempts/start",
        json={"exam_id": _state["attempt_exam_id"], "mode": "EXAM"},
        headers=_h("student"),
    )
    assert res.status_code in (200, 201), res.text
    assert res.json()["total_questions"] == 2  # the unreviewed third question is excluded


# ── Student exam-preparation details reach the admin Users page ─────────────

@pytest.mark.anyio
async def test_target_exam_saved_by_student_is_visible_to_admin(client):
    sid, _ = _state["users"]["student2"]
    patch = await client.patch(
        "/api/v1/auth/me",
        json={"target_exam": "UPSC CSE", "target_year": "2027", "optional_subject": "Geography", "weekly_hours": "40"},
        headers=_h("student2"),
    )
    assert patch.status_code == 200, patch.text
    me = (await client.get("/api/v1/auth/me", headers=_h("student2"))).json()
    assert (me["target_exam"], me["target_year"], me["optional_subject"], me["weekly_hours"]) == ("UPSC CSE", "2027", "Geography", "40")

    listing = (await client.get("/api/v1/users", headers=_h("admin_open"))).json()
    row = next(u for u in listing if u["id"] == sid)
    assert (row["target_exam"], row["target_year"], row["optional_subject"]) == ("UPSC CSE", "2027", "Geography")
    other = next(u for u in listing if u["id"] != sid and u["role"] == "STUDENT")
    assert other["target_exam"] is None  # nobody else is affected, and no invented default

    detail = (await client.get(f"/api/v1/users/{sid}", headers=_h("admin_open"))).json()
    assert detail["target_exam"] == "UPSC CSE" and detail["weekly_hours"] == "40"

    # Only Users-section admins see the directory.
    assert (await client.get("/api/v1/users", headers=_h("admin_qa"))).status_code == 403


@pytest.mark.anyio
async def test_plan_change_by_admin_is_reflected_on_every_student_read(client):
    """The auth cache holds a User without its profile, so a cache hit used to
    read every student as FREE from the second request after a plan change."""
    sid, _ = _state["users"]["student2"]
    for tier in ("PREMIUM", "FREE", "PREMIUM"):
        upd = await client.put(f"/api/v1/users/{sid}", json={"subscription_tier": tier}, headers=_h("admin_open"))
        assert upd.status_code == 200, upd.text
        for _ in range(3):  # 1st read is a cache miss, the rest hit the cache
            me = (await client.get("/api/v1/auth/me", headers=_h("student2"))).json()
            assert me["subscription_tier"] == tier
