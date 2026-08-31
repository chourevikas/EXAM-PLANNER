import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlmodel import SQLModel, select
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.fastapi_server import app
from app.db.session import get_async_session
from app.db.models.user import User, UserRole, UserStatus
from app.db.models.roles import Role, Permission, RolePermission
from app.db.models.hierarchy import Exam
from app.db.models.question import Question
from app.db.models.review import HumanReviewTask
from app.db.models.enums import QuestionStatus
from app.core.security import create_access_token, get_password_hash

test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

_seeded = False


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
    exam = Exam(code="RA-2026", name="Review Auth Exam")
    session.add(exam)
    await session.commit()
    await session.refresh(exam)

    question = Question(
        exam_id=exam.id,
        section_code="GS",
        question_number_in_paper=1,
        status=QuestionStatus.PENDING_HUMAN_REVIEW,
    )
    session.add(question)
    await session.commit()
    await session.refresh(question)

    task = HumanReviewTask(question_id=question.id, exam_id=exam.id, review_status="PENDING_REVIEW")
    session.add(task)

    review_perm = Permission(key="questions.review", label="Review")
    manage_perm = Permission(key="questions.review.manage", label="Manage")
    session.add_all([review_perm, manage_perm])
    await session.commit()
    await session.refresh(review_perm)
    await session.refresh(manage_perm)

    teacher_role = Role(name="Teacher", slug="teacher", base_role_type=UserRole.TEACHER, is_system=True)
    session.add(teacher_role)
    await session.commit()
    await session.refresh(teacher_role)
    session.add(RolePermission(role_id=teacher_role.id, permission_id=review_perm.id))
    session.add(RolePermission(role_id=teacher_role.id, permission_id=manage_perm.id))
    await session.commit()

    users = {
        "student": User(full_name="Student", email="student_ra@example.com", role=UserRole.STUDENT, password_hash=get_password_hash("x")),
        "teacher": User(full_name="Teacher", email="teacher_ra@example.com", role=UserRole.TEACHER, password_hash=get_password_hash("x")),
        "admin": User(full_name="Admin", email="admin_ra@example.com", role=UserRole.ADMIN, password_hash=get_password_hash("x")),
    }
    for u in users.values():
        session.add(u)
    await session.commit()
    for u in users.values():
        await session.refresh(u)

    global _users, _question_id, _exam_id
    _users = users
    _question_id = question.id
    _exam_id = exam.id


_users = {}
_question_id = None
_exam_id = None


def _auth_header(user: User) -> dict:
    token = create_access_token(subject=user.id, role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_review_tasks_requires_auth():
    # Re-assert our override: app.dependency_overrides is a single global dict,
    # and whichever test module was imported last otherwise wins for every test
    # in the session. Reasserting per-test makes this file order-independent.
    app.dependency_overrides[get_async_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/admin/review/tasks")
        assert resp.status_code == 401


@pytest.mark.anyio
async def test_review_tasks_rejects_student():
    app.dependency_overrides[get_async_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # trigger seeding
        await client.get("/api/v1/admin/review/tasks", headers=_auth_header_lazy("admin"))
        resp = await client.get("/api/v1/admin/review/tasks", headers=_auth_header_lazy("student"))
        assert resp.status_code == 403


@pytest.mark.anyio
async def test_review_tasks_allows_teacher_and_admin():
    app.dependency_overrides[get_async_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp_teacher = await client.get("/api/v1/admin/review/tasks", headers=_auth_header_lazy("teacher"))
        assert resp_teacher.status_code == 200
        resp_admin = await client.get("/api/v1/admin/review/tasks", headers=_auth_header_lazy("admin"))
        assert resp_admin.status_code == 200


@pytest.mark.anyio
async def test_approve_endpoint_rejects_student_and_allows_teacher():
    app.dependency_overrides[get_async_session] = override_get_session
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # ensure seed ran
        await client.get("/api/v1/admin/review/tasks", headers=_auth_header_lazy("admin"))

        resp_student = await client.post(
            f"/api/v1/admin/review/tasks/{_question_id}/approve",
            json={"reviewer_notes": "n/a"},
            headers=_auth_header_lazy("student"),
        )
        assert resp_student.status_code == 403

        resp_teacher = await client.post(
            f"/api/v1/admin/review/tasks/{_question_id}/approve",
            json={"reviewer_notes": "looks good"},
            headers=_auth_header_lazy("teacher"),
        )
        assert resp_teacher.status_code == 200
        assert resp_teacher.json()["status"] == "PUBLISHED"


def _auth_header_lazy(role_key: str) -> dict:
    user = _users[role_key]
    return _auth_header(user)
