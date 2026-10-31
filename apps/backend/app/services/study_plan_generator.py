"""Study plan built from the student's own data (replaces the fixed UPSC template).

Rule-based (the AI study recommendation is on hold). For each day in the range, within the student's
daily study time (weekly hours from onboarding / 7, else 2 hours):
  1. Spaced revision: questions due that day (user_memory_states), as one "revise N questions" task.
  2. Weak subtopics (accuracy under 60% on 3+ answers, weakest first): targeted practice.
  3. New subtopics the student hasn't tried yet that have questions in the bank (most PYQs first):
     learn, then solve their PYQs.
  4. Sunday: a test (a subject-wise test on the weakest subject; a full paper when there's no data yet).
A month plan does the same, and turns its last week into consolidation: no new topics; weak topics, then
revision of everything else practised (lowest accuracy first) and mixed PYQs, with a full paper on
Wednesday and Sunday.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlmodel import case, col, func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.analytics import ExamAttempt, ExamQuestionResponse, PracticeAnswer, UserMemoryState
from app.db.models.enums import AttemptStatus, QuestionStatus
from app.db.models.hierarchy import Subject, Subtopic, Topic
from app.db.models.question import Question
from app.db.models.user import StudentProfile
from app.services.free_plan import IST

DEFAULT_DAILY_MINUTES = 120
WEAK_ACCURACY = 60
MAX_TASKS_PER_DAY = 6
_DONE = [AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED]


def daily_minutes(weekly_hours: Optional[str]) -> int:
    """Study minutes a day from the onboarding answer (hours a week), clamped to 30 min .. 8 h."""
    try:
        hours = float(str(weekly_hours).strip())
    except (TypeError, ValueError):
        return DEFAULT_DAILY_MINUTES
    if hours <= 0:
        return DEFAULT_DAILY_MINUTES
    return int(min(480, max(30, round(hours * 60 / 7 / 15) * 15)))


async def _subtopic_stats(session: AsyncSession, user_id: int) -> Dict[int, Tuple[int, int]]:
    """{subtopic_id: (answered, correct)} from tests and practice."""
    stats: Dict[int, List[int]] = defaultdict(lambda: [0, 0])
    test_rows = (await session.exec(
        select(Question.subtopic_id, func.count(ExamQuestionResponse.id),
               func.coalesce(func.sum(case((col(ExamQuestionResponse.is_correct).is_(True), 1), else_=0)), 0))
        .join(ExamAttempt, col(ExamAttempt.id) == col(ExamQuestionResponse.attempt_id))
        .join(Question, col(Question.id) == col(ExamQuestionResponse.question_id))
        .where(ExamAttempt.user_id == user_id, col(ExamAttempt.status).in_(_DONE),
               col(ExamQuestionResponse.selected_option_id).is_not(None), col(Question.subtopic_id).is_not(None))
        .group_by(Question.subtopic_id)
    )).all()
    practice_rows = (await session.exec(
        select(Question.subtopic_id, func.count(PracticeAnswer.id),
               func.coalesce(func.sum(case((col(PracticeAnswer.is_correct).is_(True), 1), else_=0)), 0))
        .join(Question, col(Question.id) == col(PracticeAnswer.question_id))
        .where(PracticeAnswer.user_id == user_id, col(Question.subtopic_id).is_not(None))
        .group_by(Question.subtopic_id)
    )).all()
    for sid, n, c in list(test_rows) + list(practice_rows):
        stats[sid][0] += int(n or 0)
        stats[sid][1] += int(c or 0)
    return {k: (v[0], v[1]) for k, v in stats.items()}


async def _bank(session: AsyncSession) -> Dict[int, Dict[str, Any]]:
    """Published questions per subtopic, with the subtopic's topic and subject names."""
    rows = (await session.exec(
        select(Subtopic.id, Subtopic.name, Topic.name, Subject.name, func.count(Question.id))
        .join(Question, col(Question.subtopic_id) == col(Subtopic.id))
        .join(Topic, col(Topic.id) == col(Subtopic.topic_id))
        .join(Subject, col(Subject.id) == col(Topic.subject_id))
        .where(Question.status == QuestionStatus.PUBLISHED)
        .group_by(Subtopic.id, Subtopic.name, Topic.name, Subject.name)
    )).all()
    return {sid: {"subtopic": s, "topic": t, "subject": subj, "questions": int(n)} for sid, s, t, subj, n in rows}


async def _due_by_day(session: AsyncSession, user_id: int, start: date, end: date) -> Dict[date, int]:
    """Revision questions falling due on each day; anything already overdue counts on the first day."""
    rows = (await session.exec(
        select(UserMemoryState.next_scheduled_review)
        .join(Question, col(Question.id) == col(UserMemoryState.question_id))
        .where(UserMemoryState.user_id == user_id, Question.status == QuestionStatus.PUBLISHED)
    )).all()
    due: Dict[date, int] = defaultdict(int)
    for ts in rows:
        if ts is None:
            continue
        aware = ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)
        day = max(aware.astimezone(IST).date(), start)
        if day <= end:
            due[day] += 1
    return due


def _task(day: date, title: str, description: str, minutes: int, activity: str, priority: str,
          info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    info = info or {}
    return {
        "scheduled_date": day,
        "title": title,
        "description": description,
        "allocated_time_minutes": minutes,
        "activity_type": activity,
        "priority": priority,
        "subject": info.get("subject"),
        "topic": info.get("topic"),
        "subtopic": info.get("subtopic"),
    }


async def build_plan(session: AsyncSession, user_id: int, start: date, end: date,
                     today: Optional[date] = None, monthly: bool = False) -> List[Dict[str, Any]]:
    """Plan tasks for every day from max(start, today) to end."""
    today = today or datetime.now(timezone.utc).astimezone(IST).date()
    first = max(start, today)
    if first > end:
        return []

    profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == user_id))).first()
    budget = daily_minutes(profile.weekly_hours if profile else None)
    stats = await _subtopic_stats(session, user_id)
    bank = await _bank(session)
    due = await _due_by_day(session, user_id, first, end)

    weak = sorted(
        [(sid, n, c) for sid, (n, c) in stats.items() if sid in bank and n >= 3 and c * 100 < WEAK_ACCURACY * n],
        key=lambda x: (x[2] / x[1], -x[1]),
    )
    new = sorted([sid for sid in bank if sid not in stats], key=lambda sid: -bank[sid]["questions"])
    weak_ids = {w[0] for w in weak}
    # Everything else already practised, lowest accuracy first: revised in a month's last week
    review = sorted([(sid, n, c) for sid, (n, c) in stats.items() if sid in bank and n and sid not in weak_ids],
                    key=lambda x: (x[2] / x[1], -x[1]))
    weak_i = new_i = review_i = 0

    # The weakest subject (by answers) for test days without a full paper
    by_subject: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    for sid, (n, c) in stats.items():
        if sid in bank:
            by_subject[bank[sid]["subject"]][0] += n
            by_subject[bank[sid]["subject"]][1] += c
    weakest_subject = min(
        (s for s, (n, _) in by_subject.items() if n >= 5), key=lambda s: by_subject[s][1] / by_subject[s][0], default=None
    )

    consolidation_from = end - timedelta(days=6) if monthly else None
    tasks: List[Dict[str, Any]] = []
    day = first
    while day <= end:
        left = budget
        day_tasks: List[Dict[str, Any]] = []
        consolidating = consolidation_from is not None and day >= consolidation_from

        n_due = due.get(day, 0)
        if n_due:
            minutes = min(45, max(15, round(n_due * 1.5 / 5) * 5))
            day_tasks.append(_task(day, f"Revise {n_due} question{'s' if n_due != 1 else ''} due today",
                                   "Spaced revision: questions you answered before come back just before you're likely to forget them.",
                                   minutes, "CONCEPT_REVISION", "HIGH"))
            left -= minutes

        test_day = day.weekday() == 6 or (consolidating and day.weekday() == 2)
        if test_day and left >= 60:
            if weakest_subject and not consolidating:
                day_tasks.append(_task(day, f"Subject-wise test: {weakest_subject}",
                                       f"Your lowest-accuracy subject ({round(by_subject[weakest_subject][1] * 100 / by_subject[weakest_subject][0])}% so far). "
                                       "Build it from PYQs → Subject-wise.", min(left, 90), "MOCK_TEST", "HIGH", {"subject": weakest_subject}))
            else:
                day_tasks.append(_task(day, "Full paper under exam conditions",
                                       "Take a complete previous-year paper with the timer, then go through the report.",
                                       min(left, 120), "MOCK_TEST", "HIGH"))
            left -= min(left, 120)

        used_today: set = set()  # each subtopic at most once a day
        while left >= 25 and len(day_tasks) < MAX_TASKS_PER_DAY:
            weak_next = weak[weak_i % len(weak)] if weak else None
            weak_ok = weak_next is not None and weak_next[0] not in used_today
            new_ok = bool(new) and not consolidating and new_i < len(new)
            prefer_weak = weak_ok and (consolidating or weak_i <= new_i or not new_ok)
            if prefer_weak:
                sid, n, c = weak_next
                weak_i += 1
                used_today.add(sid)
                info = bank[sid]
                minutes = min(left, 40)
                day_tasks.append(_task(day, f"Strengthen {info['subtopic']}",
                                       f"{c} of {n} right so far ({round(c * 100 / n)}%). Practise its questions and read each explanation.",
                                       minutes, "PRACTICE_MCQS", "HIGH", info))
                left -= minutes
            elif new_ok:
                sid = new[new_i]
                new_i += 1
                used_today.add(sid)
                info = bank[sid]
                learn = min(left, 30)
                day_tasks.append(_task(day, f"Learn {info['subtopic']} ({info['topic']})",
                                       f"Not tried yet; {info['questions']} question{'s' if info['questions'] != 1 else ''} in the bank.",
                                       learn, "NEW_TOPIC", "MEDIUM", info))
                left -= learn
                if left >= 20 and len(day_tasks) < MAX_TASKS_PER_DAY:
                    solve = min(left, 30)
                    day_tasks.append(_task(day, f"Solve PYQs: {info['subtopic']}",
                                           "Right after learning it, so it sticks.", solve, "PYQ_SOLVING", "MEDIUM", info))
                    left -= solve
            elif consolidating and review and review[review_i % len(review)][0] not in used_today:
                sid, n, c = review[review_i % len(review)]
                review_i += 1
                used_today.add(sid)
                info = bank[sid]
                minutes = min(left, 30)
                day_tasks.append(_task(day, f"Revise {info['subtopic']}",
                                       f"{c} of {n} right so far ({round(c * 100 / n)}%). Read your notes, then a few questions to check.",
                                       minutes, "CONCEPT_REVISION", "MEDIUM", info))
                left -= minutes
            else:
                if consolidating and left >= 30:
                    day_tasks.append(_task(day, "Mixed PYQs from all subjects",
                                           "Questions from every subject, so the whole syllabus stays fresh before the exam.",
                                           min(left, 60), "PYQ_SOLVING", "MEDIUM"))
                break
        if not day_tasks:
            # Nothing in the student's data for this day yet (a new student, an empty bank): keep the day useful
            day_tasks.append(_task(day, "Practise previous-year questions",
                                   "Pick any subject from PYQs. The plan gets more specific as you answer questions.",
                                   min(budget, 60), "PYQ_SOLVING", "MEDIUM"))
        tasks.extend(day_tasks)
        day += timedelta(days=1)
    return tasks
