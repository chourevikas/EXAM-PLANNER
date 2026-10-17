"""Leaderboards per target exam, nationally and by state, recalculated once a day.

Ranking (client-approved): XP first (it includes 10 per correct answer), then correct answers, then
whoever reached their XP first. A student appears once they have at least one correct answer and a
target exam. Each day's standing is stored in leaderboard_snapshots so ranks stay stable during the
day and can show the change since the previous snapshot.
"""
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from sqlmodel import col, delete, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.analytics import ExamAttempt, PracticeAnswer
from app.db.models.enums import AttemptStatus
from app.db.models.gamification import LeaderboardSnapshot, XPLog
from app.db.models.user import StudentProfile, User, UserRole, UserStatus
from app.services.free_plan import IST


def ist_today() -> date:
    return datetime.now(timezone.utc).astimezone(IST).date()


async def refresh(session: AsyncSession, day: Optional[date] = None) -> int:
    """Rebuilds the snapshot for `day` (default: today, IST). Returns how many students were ranked."""
    day = day or ist_today()

    students = (await session.exec(
        select(StudentProfile.user_id, StudentProfile.target_exam, StudentProfile.state, StudentProfile.total_xp)
        .join(User, col(User.id) == col(StudentProfile.user_id))
        .where(User.role == UserRole.STUDENT, User.status == UserStatus.ACTIVE, col(StudentProfile.target_exam).is_not(None))
    )).all()

    test_correct = dict((await session.exec(
        select(ExamAttempt.user_id, func.coalesce(func.sum(ExamAttempt.total_correct), 0))
        .where(col(ExamAttempt.status).in_([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]))
        .group_by(ExamAttempt.user_id)
    )).all())
    practice_correct = dict((await session.exec(
        select(PracticeAnswer.user_id, func.count(PracticeAnswer.id))
        .where(col(PracticeAnswer.is_correct).is_(True))
        .group_by(PracticeAnswer.user_id)
    )).all())
    last_xp_at = dict((await session.exec(
        select(XPLog.user_id, func.max(XPLog.created_at)).group_by(XPLog.user_id)
    )).all())

    far_future = datetime.max.replace(tzinfo=timezone.utc)

    def _aware(dt: Optional[datetime]) -> datetime:
        if dt is None:
            return far_future
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

    by_exam: Dict[str, List[Dict[str, Any]]] = {}
    for user_id, exam, state, xp in students:
        correct = int(test_correct.get(user_id, 0) or 0) + int(practice_correct.get(user_id, 0) or 0)
        if correct < 1 or not (exam or "").strip():
            continue
        by_exam.setdefault(exam.strip(), []).append({
            "user_id": user_id, "state": state, "xp": int(xp or 0), "correct": correct,
            "reached_at": _aware(last_xp_at.get(user_id)),
        })

    rows: List[LeaderboardSnapshot] = []
    for exam, entries in by_exam.items():
        entries.sort(key=lambda e: (-e["xp"], -e["correct"], e["reached_at"], e["user_id"]))
        state_counters: Dict[str, int] = {}
        for national_rank, e in enumerate(entries, start=1):
            state_rank = None
            if e["state"]:
                state_counters[e["state"]] = state_counters.get(e["state"], 0) + 1
                state_rank = state_counters[e["state"]]
            rows.append(LeaderboardSnapshot(
                snapshot_date=day, user_id=e["user_id"], exam=exam, state=e["state"], xp=e["xp"],
                correct_answers=e["correct"], rank_national=national_rank, rank_state=state_rank,
            ))

    await session.exec(delete(LeaderboardSnapshot).where(LeaderboardSnapshot.snapshot_date == day))
    session.add_all(rows)
    await session.commit()
    return len(rows)


async def latest_dates(session: AsyncSession) -> List[date]:
    """The two most recent snapshot dates, newest first."""
    return list((await session.exec(
        select(LeaderboardSnapshot.snapshot_date).distinct().order_by(col(LeaderboardSnapshot.snapshot_date).desc()).limit(2)
    )).all())


def display_name(full_name: str, username: Optional[str], preference: Optional[str]) -> str:
    """The name a student chose to show: their real name, or their username (falls back to "First L.")."""
    if (preference or "USERNAME").upper() == "NAME" and full_name:
        return full_name
    if username:
        return username
    # Split on spaces and trim punctuation, so "Ravi (Student)" -> "Ravi S." and Indic names keep their letters
    words = [w.strip("()[]{}.,;:'\"-_") for w in (full_name or "").split()]
    words = [w for w in words if w] or ["Student"]
    return f"{words[0]} {words[-1][0].upper()}." if len(words) > 1 else words[0]


async def leaderboard(
    session: AsyncSession,
    viewer: User,
    scope: str = "national",
    exam: Optional[str] = None,
    state: Optional[str] = None,
    page: int = 1,
    page_size: int = 25,
) -> Dict[str, Any]:
    profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == viewer.id))).first()
    exam = (exam or (profile.target_exam if profile else None) or "").strip() or None
    state = (state or (profile.state if profile else None) or "").strip() or None

    dates = await latest_dates(session)
    if not dates:
        # First run after deploy: build today's snapshot so the page isn't empty until midnight
        await refresh(session)
        dates = await latest_dates(session)

    exams = []
    if dates:
        exams = list((await session.exec(
            select(LeaderboardSnapshot.exam).where(LeaderboardSnapshot.snapshot_date == dates[0]).distinct()
            .order_by(LeaderboardSnapshot.exam)
        )).all())

    base: Dict[str, Any] = {
        "snapshot_date": dates[0].isoformat() if dates else None,
        "scope": scope,
        "exam": exam,
        "state": state,
        "exams": exams,
        "total": 0,
        "page": page,
        "page_size": page_size,
        "rows": [],
        "me": None,
        "profile_incomplete": {
            "state": not (profile and profile.state),
            "username": not (profile and profile.username),
        },
    }
    if not dates or not exam or (scope == "state" and not state):
        return base

    current, previous = dates[0], (dates[1] if len(dates) > 1 else None)
    # The order is fixed for the day (the snapshot's national rank). State membership uses the student's
    # current profile, so someone who just set their state shows up in it straight away; their state rank
    # is their position among that state's students in the day's national order.
    filters = [LeaderboardSnapshot.snapshot_date == current, LeaderboardSnapshot.exam == exam]
    if scope == "state":
        filters.append(StudentProfile.state == state)

    def scoped():
        return (
            select(LeaderboardSnapshot, User.full_name, StudentProfile.username, StudentProfile.leaderboard_display,
                   StudentProfile.state)
            .join(User, col(User.id) == col(LeaderboardSnapshot.user_id))
            .join(StudentProfile, col(StudentProfile.user_id) == col(LeaderboardSnapshot.user_id))
            .where(*filters)
        )

    total = (await session.exec(
        select(func.count(LeaderboardSnapshot.id))
        .join(StudentProfile, col(StudentProfile.user_id) == col(LeaderboardSnapshot.user_id))
        .where(*filters)
    )).one()
    offset = (page - 1) * page_size
    page_rows = (await session.exec(
        scoped().order_by(col(LeaderboardSnapshot.rank_national)).offset(offset).limit(page_size)
    )).all()
    mine_row = (await session.exec(scoped().where(LeaderboardSnapshot.user_id == viewer.id))).first()
    my_rank = None
    if mine_row:
        if scope == "state":
            my_rank = (await session.exec(
                select(func.count(LeaderboardSnapshot.id))
                .join(StudentProfile, col(StudentProfile.user_id) == col(LeaderboardSnapshot.user_id))
                .where(*filters, LeaderboardSnapshot.rank_national <= mine_row[0].rank_national)
            )).one()
        else:
            my_rank = mine_row[0].rank_national

    # Rank in the previous snapshot (same scope) for the ▲/▼ change
    prev_rank: Dict[int, int] = {}
    if previous:
        ids = [r[0].user_id for r in page_rows] + ([viewer.id] if mine_row else [])
        prev_filters = [LeaderboardSnapshot.snapshot_date == previous, LeaderboardSnapshot.exam == exam,
                        col(LeaderboardSnapshot.user_id).in_(ids)]
        for snap in (await session.exec(select(LeaderboardSnapshot).where(*prev_filters))).all():
            rank = snap.rank_national if scope == "national" else (snap.rank_state if snap.state == state else None)
            if rank is not None:
                prev_rank[snap.user_id] = rank

    def entry(snap: LeaderboardSnapshot, rank: int, name: str, current_state: Optional[str]) -> Dict[str, Any]:
        before = prev_rank.get(snap.user_id)
        return {
            "rank": rank,
            "name": name,
            "state": current_state,
            "xp": snap.xp,
            "correct_answers": snap.correct_answers,
            "rank_change": (before - rank) if before is not None else None,
            "is_me": snap.user_id == viewer.id,
        }

    base["total"] = int(total or 0)
    base["rows"] = [
        entry(snap, snap.rank_national if scope == "national" else offset + i + 1,
              display_name(full_name, username, pref), st)
        for i, (snap, full_name, username, pref, st) in enumerate(page_rows)
    ]
    if mine_row and my_rank is not None:
        snap, full_name, username, pref, st = mine_row
        base["me"] = entry(snap, int(my_rank), display_name(full_name, username, pref), st)
    return base
