"""Student onboarding (locked primary target) and challenges (exam/year filters, one attempt per user)."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.cache import get_cache
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, StudentProfile, SubscriptionTier
from app.db.models.exam_type import ExamType
from app.db.models.hierarchy import Exam, SyllabusVersion, Subject, Topic, Subtopic
from app.db.models.question import Question, QuestionTranslation
from app.db.models.challenge import Challenge, ChallengeQuestion
from app.db.models.notification import UserNotification
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
    etype = ExamType(type="upsc", name="UPSC Civil Services Examination")
    other_type = ExamType(type="mpsc", name="MPSC Rajyaseva")
    session.add(etype)
    session.add(other_type)
    await session.commit()
    await session.refresh(etype)
    await session.refresh(other_type)

    def exam(code, year, type_id):
        return Exam(code=code, name=f"{code} paper", exam_type_id=type_id, source_year=year)

    exams = {
        "upsc2023": exam("UPSC-2023", 2023, etype.id),
        "upsc2024": exam("UPSC-2024", 2024, etype.id),
        "mpsc2023": exam("MPSC-2023", 2023, other_type.id),
    }
    for e in exams.values():
        session.add(e)
    await session.commit()
    for e in exams.values():
        await session.refresh(e)

    qids = {}
    for key, count in (("upsc2023", 3), ("upsc2024", 2), ("mpsc2023", 2)):
        qids[key] = []
        for n in range(1, count + 1):
            q = Question(
                exam_id=exams[key].id,
                question_number_in_paper=n,
                status=QuestionStatus.PUBLISHED,
                source_year=exams[key].source_year,
            )
            session.add(q)
            await session.commit()
            await session.refresh(q)
            session.add(QuestionTranslation(question_id=q.id, language=LanguageCode.ENGLISH, question_text=f"{key} q{n}"))
            qids[key].append(q.id)
    await session.commit()

    # Subjects: "Polity" and "Indian Polity & Governance" overlap as substrings on purpose.
    version = SyllabusVersion(exam_id=exams["upsc2023"].id, version_code="v1")
    session.add(version)
    await session.commit()
    await session.refresh(version)
    subtopics = {}
    for order, name in enumerate(("Polity", "History", "Indian Polity & Governance"), start=1):
        subj = Subject(version_id=version.id, name=name, display_order=order)
        session.add(subj)
        await session.commit()
        await session.refresh(subj)
        topic = Topic(subject_id=subj.id, name=f"{name} topic")
        session.add(topic)
        await session.commit()
        await session.refresh(topic)
        sub = Subtopic(topic_id=topic.id, name=f"{name} subtopic")
        session.add(sub)
        await session.commit()
        await session.refresh(sub)
        subtopics[name] = sub.id
    by_subject = {
        "Polity": [qids["upsc2023"][0]],
        "History": [qids["upsc2023"][1], qids["upsc2024"][0]],
        "Indian Polity & Governance": [qids["upsc2023"][2]],
    }
    for name, ids in by_subject.items():
        for qid in ids:
            q = await session.get(Question, qid)
            q.subtopic_id = subtopics[name]
            session.add(q)
    await session.commit()

    def user(name, role):
        return User(
            full_name=name,
            email=f"{name.lower().replace(' ', '_')}@ob.test",
            role=role,
            password_hash=get_password_hash("x"),
        )

    users = {
        "alice": user("Alice", UserRole.STUDENT),
        "bob": user("Bob", UserRole.STUDENT),
        "carol": user("Carol", UserRole.STUDENT),
        "dave": user("Dave", UserRole.STUDENT),  # premium: not bound by the free-plan challenge cap
        "admin": user("Admin", UserRole.ADMIN),
    }
    for u in users.values():
        session.add(u)
    await session.commit()
    for u in users.values():
        await session.refresh(u)
    session.add(StudentProfile(user_id=users["dave"].id, subscription_tier=SubscriptionTier.PREMIUM))
    await session.commit()

    _state.update(
        users={k: (u.id, u.role.value) for k, u in users.items()},
        upsc_type=etype.id,
        mpsc_type=other_type.id,
        qids=qids,
        by_subject=by_subject,
    )


def _h(who: str) -> dict:
    uid, role = _state["users"][who]
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


@pytest.fixture
async def client():
    app.dependency_overrides[get_async_session] = _override_session
    await get_cache().delete_pattern("*")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.get("/api/v1/exam-types")  # any DB-backed call triggers the seed
        await get_cache().delete_pattern("*")
        yield c
    # don't leak cached users (ids collide across modules' in-memory DBs) into later test modules
    await get_cache().delete_pattern("*")


ONBOARDING = {
    "target_exam": "UPSC CSE",
    "target_year": "2027",
    "optional_subject": "Geography",
    "weekly_hours": "35",
    "preferred_language": "hi",
    "subject_proficiency": {"History": 2, "Polity": 4},
}


# ── Onboarding ───────────────────────────────────────────────────────────────

@pytest.mark.anyio
async def test_new_student_must_onboard_and_only_optional_subject_is_then_locked(client):
    me = (await client.get("/api/v1/auth/me", headers=_h("alice"))).json()
    assert me["onboarding_completed"] is False

    done = await client.post("/api/v1/auth/me/onboarding", json=ONBOARDING, headers=_h("alice"))
    assert done.status_code == 200, done.text
    body = done.json()
    assert body["onboarding_completed"] is True
    assert (body["target_exam"], body["target_year"], body["optional_subject"], body["weekly_hours"]) == ("UPSC CSE", "2027", "Geography", "35")
    assert body["subject_proficiency"] == {"History": 2, "Polity": 4}
    assert body["preferred_language"] == "hi"

    # persisted, and every later read agrees (cache hits included)
    for _ in range(2):
        me = (await client.get("/api/v1/auth/me", headers=_h("alice"))).json()
        assert me["onboarding_completed"] is True and me["target_year"] == "2027"

    # a second submission is refused
    again = await client.post("/api/v1/auth/me/onboarding", json={**ONBOARDING, "target_year": "2028"}, headers=_h("alice"))
    assert again.status_code == 409

    # the optional subject can't be edited afterwards…
    r = await client.patch("/api/v1/auth/me", json={"optional_subject": "History"}, headers=_h("alice"))
    assert r.status_code == 403, r.text
    # …target exam and year can, but not to empty
    for field in ("target_exam", "target_year"):
        r = await client.patch("/api/v1/auth/me", json={field: "  "}, headers=_h("alice"))
        assert r.status_code == 400, (field, r.text)
    moved = await client.patch("/api/v1/auth/me", json={"target_exam": "MPSC Rajyaseva", "target_year": "2028"}, headers=_h("alice"))
    assert moved.status_code == 200, moved.text
    me = (await client.get("/api/v1/auth/me", headers=_h("alice"))).json()
    assert (me["target_exam"], me["target_year"], me["optional_subject"]) == ("MPSC Rajyaseva", "2028", "Geography")
    # re-sending the stored optional subject is harmless, and the weekly goal stays editable
    ok = await client.patch(
        "/api/v1/auth/me",
        json={"target_exam": "UPSC CSE", "target_year": "2027", "optional_subject": "Geography", "weekly_hours": "45"},
        headers=_h("alice"),
    )
    assert ok.status_code == 200, ok.text
    me = (await client.get("/api/v1/auth/me", headers=_h("alice"))).json()
    assert (me["target_exam"], me["target_year"], me["weekly_hours"]) == ("UPSC CSE", "2027", "45")

    # admins see the answers
    detail = (await client.get(f"/api/v1/users/{_state['users']['alice'][0]}", headers=_h("admin"))).json()
    assert detail["subject_proficiency"] == {"History": 2, "Polity": 4}
    assert detail["target_exam"] == "UPSC CSE"


@pytest.mark.anyio
async def test_onboarding_validation_and_roles(client):
    bad_rating = await client.post(
        "/api/v1/auth/me/onboarding", json={**ONBOARDING, "subject_proficiency": {"History": 6}}, headers=_h("bob")
    )
    assert bad_rating.status_code == 422
    bad_lang = await client.post(
        "/api/v1/auth/me/onboarding", json={**ONBOARDING, "preferred_language": "xx"}, headers=_h("bob")
    )
    assert bad_lang.status_code == 400
    missing = await client.post("/api/v1/auth/me/onboarding", json={"target_year": "2027"}, headers=_h("bob"))
    assert missing.status_code == 422
    # nothing was saved by the failed attempts
    assert (await client.get("/api/v1/auth/me", headers=_h("bob"))).json()["onboarding_completed"] is False

    staff = await client.post("/api/v1/auth/me/onboarding", json=ONBOARDING, headers=_h("admin"))
    assert staff.status_code == 403
    assert (await client.get("/api/v1/auth/me", headers=_h("admin"))).json()["onboarding_completed"] is True


@pytest.mark.anyio
async def test_ratings_are_optional_at_onboarding_and_editable_later(client):
    # onboarding no longer needs ratings
    without = {k: v for k, v in ONBOARDING.items() if k != "subject_proficiency"}
    done = await client.post("/api/v1/auth/me/onboarding", json=without, headers=_h("bob"))
    assert done.status_code == 200, done.text
    assert done.json()["onboarding_completed"] is True
    assert not done.json()["subject_proficiency"]

    # ratings can be set after onboarding (e.g. from the profile or study planner)
    r = await client.patch(
        "/api/v1/auth/me", json={"subject_proficiency": {" History ": 1, "Polity": 5}}, headers=_h("bob")
    )
    assert r.status_code == 200, r.text
    assert r.json()["subject_proficiency"] == {"History": 1, "Polity": 5}
    me = (await client.get("/api/v1/auth/me", headers=_h("bob"))).json()
    assert me["subject_proficiency"] == {"History": 1, "Polity": 5}

    # a later save replaces the whole map rather than merging
    r = await client.patch("/api/v1/auth/me", json={"subject_proficiency": {"Economy": 3}}, headers=_h("bob"))
    assert r.json()["subject_proficiency"] == {"Economy": 3}

    # out-of-range ratings are rejected and nothing changes
    bad = await client.patch("/api/v1/auth/me", json={"subject_proficiency": {"Economy": 6}}, headers=_h("bob"))
    assert bad.status_code == 422
    assert (await client.get("/api/v1/auth/me", headers=_h("bob"))).json()["subject_proficiency"] == {"Economy": 3}

    # editing ratings doesn't unlock the optional subject
    locked = await client.patch(
        "/api/v1/auth/me", json={"subject_proficiency": {"Economy": 2}, "optional_subject": "Sociology"}, headers=_h("bob")
    )
    assert locked.status_code == 403

    # spelling variants are stored under the taxonomy's spelling; unknown subjects keep theirs
    canon = await client.patch(
        "/api/v1/auth/me",
        json={"subject_proficiency": {"HISTORY": 3, "Indian Polity and Governance": 4, "Ethics": 2}},
        headers=_h("bob"),
    )
    assert canon.status_code == 200, canon.text
    assert canon.json()["subject_proficiency"] == {"History": 3, "Indian Polity & Governance": 4, "Ethics": 2}

    # an empty map clears the ratings
    cleared = await client.patch("/api/v1/auth/me", json={"subject_proficiency": {}}, headers=_h("bob"))
    assert cleared.status_code == 200
    assert not cleared.json()["subject_proficiency"]


# ── Challenges ───────────────────────────────────────────────────────────────

async def _create(client, who, **extra):
    payload = {"title": "Sprint", "question_count": 50, "visibility": "PUBLIC", **extra}
    return await client.post("/api/v1/challenges", json=payload, headers=_h(who))


@pytest.mark.anyio
async def test_challenge_options_list_exams_with_their_years(client):
    opts = (await client.get("/api/v1/challenges/options", headers=_h("alice"))).json()
    by_name = {e["name"]: e["years"] for e in opts["exams"]}
    assert by_name == {"UPSC Civil Services Examination": [2024, 2023], "MPSC Rajyaseva": [2023]}
    assert opts["years"] == [2024, 2023]

    # subjects are per exam (and per year), built from published questions filed under a syllabus
    subjects = {e["name"]: e["subject_years"] for e in opts["exams"]}
    assert subjects["UPSC Civil Services Examination"] == {
        "History": [2024, 2023],
        "Indian Polity & Governance": [2023],
        "Polity": [2023],
    }
    assert subjects["MPSC Rajyaseva"] == {}  # no syllabus data for this exam yet
    assert opts["subject_years"] == subjects["UPSC Civil Services Examination"]


@pytest.mark.anyio
async def test_challenge_questions_follow_exam_and_year_filters(client):
    q = _state["qids"]

    async def question_ids(challenge_id):
        async with AsyncSession(test_engine) as s:
            rows = (await s.exec(select(ChallengeQuestion.question_id).where(ChallengeQuestion.challenge_id == challenge_id))).all()
        return set(rows)

    upsc_all = await _create(client, "alice", exam_type_id=_state["upsc_type"])
    assert upsc_all.status_code == 200, upsc_all.text
    assert (upsc_all.json()["exam_name"], upsc_all.json()["years"]) == ("UPSC Civil Services Examination", [])
    assert await question_ids(upsc_all.json()["id"]) == set(q["upsc2023"] + q["upsc2024"])

    upsc_2024 = await _create(client, "alice", exam_type_id=_state["upsc_type"], years=[2024])
    assert upsc_2024.json()["years"] == [2024]
    assert await question_ids(upsc_2024.json()["id"]) == set(q["upsc2024"])

    both_years_any_exam = await _create(client, "alice", years=[2023])
    assert await question_ids(both_years_any_exam.json()["id"]) == set(q["upsc2023"] + q["mpsc2023"])

    multi = await _create(client, "alice", exam_type_id=_state["mpsc_type"], years=[2023, 2024])
    assert await question_ids(multi.json()["id"]) == set(q["mpsc2023"])

    assert (await _create(client, "alice", exam_type_id=_state["mpsc_type"], years=[2024])).status_code == 400
    assert (await _create(client, "alice", exam_type_id=99999)).status_code == 400


@pytest.mark.anyio
async def test_challenge_can_draw_from_several_exams(client):
    q = _state["qids"]  # created as dave (Pro): alice's free challenges are needed by later tests

    async def stored(challenge_id):
        async with AsyncSession(test_engine) as s:
            ids = set((await s.exec(select(ChallengeQuestion.question_id).where(ChallengeQuestion.challenge_id == challenge_id))).all())
            return ids, await s.get(Challenge, challenge_id)

    both = await _create(client, "dave", exam_type_ids=[_state["upsc_type"], _state["mpsc_type"]])
    assert both.status_code == 200, both.text
    assert both.json()["exam_name"] == "UPSC Civil Services Examination, MPSC Rajyaseva"
    ids, row = await stored(both.json()["id"])
    assert ids == set(q["upsc2023"] + q["upsc2024"] + q["mpsc2023"])
    assert row.exam_type_id is None  # several exams: the names say which

    # Years narrow every chosen exam; 2024 only exists for UPSC
    both_2024 = await _create(client, "dave", exam_type_ids=[_state["upsc_type"], _state["mpsc_type"]], years=[2024])
    assert (await stored(both_2024.json()["id"]))[0] == set(q["upsc2024"])

    # One exam in the list behaves like the legacy single exam_type_id; duplicates are ignored
    one = await _create(client, "dave", exam_type_ids=[_state["mpsc_type"], _state["mpsc_type"]])
    ids, row = await stored(one.json()["id"])
    assert (ids, row.exam_type_id, one.json()["exam_name"]) == (set(q["mpsc2023"]), _state["mpsc_type"], "MPSC Rajyaseva")

    # Any unknown exam in the list is rejected
    assert (await _create(client, "dave", exam_type_ids=[_state["upsc_type"], 99999])).status_code == 400


@pytest.mark.anyio
async def test_each_user_gets_only_one_attempt_per_challenge(client):
    cid = (await _create(client, "alice", exam_type_id=_state["upsc_type"], years=[2024])).json()["id"]

    first = await client.post(f"/api/v1/challenges/{cid}/attempts/start", headers=_h("bob"))
    assert first.status_code == 200
    attempt_id = first.json()["attempt_id"]

    # an unfinished attempt resumes rather than starting a new one
    resumed = await client.post(f"/api/v1/challenges/{cid}/attempts/start", headers=_h("bob"))
    assert resumed.json()["attempt_id"] == attempt_id
    mid = (await client.get(f"/api/v1/challenges/{cid}", headers=_h("bob"))).json()
    assert (mid["has_in_progress"], mid["has_attempted"]) == (True, False)

    assert (await client.post(f"/api/v1/challenges/attempts/{attempt_id}/submit", headers=_h("bob"))).status_code == 200

    # once submitted, no second go — by id or by share token
    again = await client.post(f"/api/v1/challenges/{cid}/attempts/start", headers=_h("bob"))
    assert again.status_code == 409
    token = (await client.get(f"/api/v1/challenges/{cid}", headers=_h("bob"))).json()["share_token"]
    assert (await client.post(f"/api/v1/challenges/{token}/attempts/start", headers=_h("bob"))).status_code == 409

    done = (await client.get(f"/api/v1/challenges/{cid}", headers=_h("bob"))).json()
    assert (done["has_attempted"], done["has_in_progress"]) == (True, False)
    # the list flag (taking a public challenge from its link puts it in your list)
    invite = await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": "bob@ob.test"}, headers=_h("alice"))
    assert invite.status_code == 200, invite.text
    listed = next(c for c in (await client.get("/api/v1/challenges", headers=_h("bob"))).json() if c["id"] == cid)
    assert listed["has_attempted"] is True

    # it applies per user: the creator and others still get their own single attempt
    assert (await client.post(f"/api/v1/challenges/{cid}/attempts/start", headers=_h("carol"))).status_code == 200
    creator = await client.post(f"/api/v1/challenges/{cid}/attempts/start", headers=_h("alice"))
    assert creator.status_code == 200
    # …and the flags are per user
    carol_view = (await client.get(f"/api/v1/challenges/{cid}", headers=_h("carol"))).json()
    assert carol_view["has_attempted"] is False


@pytest.mark.anyio
async def test_invite_only_challenges_invites_and_where_they_show_up(client):
    from datetime import datetime, timedelta, timezone

    # dave (Pro) makes an invite-only challenge; its link says so before anyone signs in
    made = await _create(client, "dave", exam_type_id=_state["upsc_type"], visibility="INVITE_ONLY")
    assert made.status_code == 200, made.text
    cid, token = made.json()["id"], made.json()["share_token"]
    assert (await client.get(f"/api/v1/challenges/public/{token}")).json()["visibility"] == "INVITE_ONLY"
    assert (await client.get(f"/api/v1/challenges/{cid}", headers=_h("bob"))).status_code == 403

    # invite by email in any case; it rings their bell once, even if invited twice
    invited = await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": " BOB@OB.test "}, headers=_h("dave"))
    assert invited.status_code == 200, invited.text
    assert (invited.json()["name"], invited.json()["has_attempted"]) == ("Bob", False)
    assert (await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": "bob@ob.test"}, headers=_h("dave"))).status_code == 200
    async with AsyncSession(test_engine) as s:
        notes = (await s.exec(select(UserNotification).where(
            UserNotification.notification_type == "CHALLENGE_INVITE", UserNotification.action_url == f"/challenges/{cid}"
        ))).all()
    assert [(n.user_id, n.title) for n in notes] == [(_state["users"]["bob"][0], "Dave challenged you")]

    assert (await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": "dave@ob.test"}, headers=_h("dave"))).status_code == 400
    assert (await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": "nobody@ob.test"}, headers=_h("dave"))).status_code == 404
    assert (await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": "carol@ob.test"}, headers=_h("bob"))).status_code == 403
    assert (await client.get(f"/api/v1/challenges/{cid}/invites", headers=_h("bob"))).status_code == 403

    # bob now sees it as invited, takes it, and dave's invite list shows his score
    assert (await client.get(f"/api/v1/challenges/{cid}", headers=_h("bob"))).json()["relation"] == "INVITED"
    start = await client.post(f"/api/v1/challenges/{cid}/attempts/start", headers=_h("bob"))
    assert (await client.post(f"/api/v1/challenges/attempts/{start.json()['attempt_id']}/submit", headers=_h("bob"))).status_code == 200
    invitees = (await client.get(f"/api/v1/challenges/{cid}/invites", headers=_h("dave"))).json()
    assert [(i["name"], i["has_attempted"], i["score"]) for i in invitees] == [("Bob", True, 0.0)]
    assert next(c for c in (await client.get("/api/v1/challenges", headers=_h("dave"))).json() if c["id"] == cid)["relation"] == "CREATED"

    # a public challenge: carol is just viewing until she takes it, then it's in her list as joined
    pub = (await _create(client, "dave", exam_type_id=_state["upsc_type"])).json()
    assert (await client.get(f"/api/v1/challenges/{pub['id']}", headers=_h("carol"))).json()["relation"] == "VIEWING"
    assert pub["id"] not in [c["id"] for c in (await client.get("/api/v1/challenges", headers=_h("carol"))).json()]
    assert (await client.post(f"/api/v1/challenges/{pub['share_token']}/attempts/start", headers=_h("carol"))).status_code == 200
    joined = next(c for c in (await client.get("/api/v1/challenges", headers=_h("carol"))).json() if c["id"] == pub["id"])
    assert joined["relation"] == "JOINED"

    # nobody new can be invited once it has closed
    async with AsyncSession(test_engine) as s:
        row = await s.get(Challenge, cid)
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        s.add(row)
        await s.commit()
    closed = await client.post(f"/api/v1/challenges/{cid}/invite", json={"email": "carol@ob.test"}, headers=_h("dave"))
    assert closed.status_code == 400 and "closed" in closed.json()["detail"]


@pytest.mark.anyio
async def test_challenge_subjects_are_multi_select_with_exact_matching(client):
    by_subject = _state["by_subject"]

    async def question_ids(challenge_id):
        async with AsyncSession(test_engine) as s:
            rows = (await s.exec(select(ChallengeQuestion.question_id).where(ChallengeQuestion.challenge_id == challenge_id))).all()
        return set(rows)

    one = await _create(client, "dave", subject_names=["Polity"])
    assert one.status_code == 200, one.text
    # exact match: "Polity" must not drag in "Indian Polity & Governance"
    assert await question_ids(one.json()["id"]) == set(by_subject["Polity"])
    assert one.json()["subject_names"] == ["Polity"]

    two = await _create(client, "dave", subject_names=["Polity", "History"])
    assert await question_ids(two.json()["id"]) == set(by_subject["Polity"] + by_subject["History"])
    assert two.json()["subject_names"] == ["Polity", "History"]
    assert two.json()["subject_name"] == "Polity, History"

    # subjects combine with exam and year filters
    combo = await _create(client, "dave", subject_names=["History"], exam_type_id=_state["upsc_type"], years=[2024])
    assert await question_ids(combo.json()["id"]) == {_state["qids"]["upsc2024"][0]}

    # the detail and list views return the subjects
    detail = (await client.get(f"/api/v1/challenges/{two.json()['id']}", headers=_h("dave"))).json()
    assert detail["subject_names"] == ["Polity", "History"]

    # older clients sending a single subject_name keep their loose substring behaviour
    legacy = await _create(client, "dave", subject_name="polity")
    assert await question_ids(legacy.json()["id"]) == set(by_subject["Polity"] + by_subject["Indian Polity & Governance"])
    assert legacy.json()["subject_names"] == ["polity"]

    # nothing matches -> a clear 400
    assert (await _create(client, "dave", subject_names=["Geography"])).status_code == 400
    # blanks and duplicates are ignored
    dedup = await _create(client, "dave", subject_names=["History", " history ", ""])
    assert dedup.json()["subject_names"] == ["History"]


def test_subject_key_matches_spelling_variants():
    from app.services.subject_names import subject_key

    assert len({subject_key(n) for n in ("Art & Culture", "Arts & Culture", "Arts and Culture", " arts AND culture ")}) == 1
    assert subject_key("Science & Tech") == subject_key("Science and Technology")
    assert subject_key("Economics") == subject_key("Economy")
    assert subject_key("Current Affairs") == subject_key("Current Affair")
    assert subject_key("Polity") != subject_key("Politics")
    assert subject_key("Class") == "class"  # double-s words aren't treated as plurals
