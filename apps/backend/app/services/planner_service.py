"""Study Planner v2: the student's plan, tasks, syllabus coverage, progress tracker, revision plan and share links.

The day-by-day layout comes from planner_engine (a port of the client's planner); this module reads and writes it.
A "generated" task is one the planner made: it has a plan_id or a block, or it came from the old one-click weekly /
monthly generator (is_ai_recommended without a source test). Rebuilding or clearing a plan only removes open
generated tasks; the student's own tasks and anything completed stay.
"""
import secrets
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_
from sqlmodel import select, delete, func, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.enums import ActivitySource, LanguageCode, QuestionStatus, StudyActivityType
from app.db.models.exam_type import ExamType
from app.db.models.hierarchy import Exam, Subject, Topic, Subtopic
from app.db.models.question import Question, QuestionTranslation
from app.db.models.planner import (
    PlannerExam, PlannerSettings, PlannerSubject, PlannerSubtopic, PlannerTopic, StudyPlan, StudyPlanShare,
    UserSyllabusCoverage, syllabus_label,
)
from app.db.models.study_plan import StudyActivity, StudyTask
from app.db.models.user import StudentProfile
from app.db.upsert import bulk_insert_on_conflict_do_nothing
from app.services import planner_engine as engine
from app.services import planner_syllabus_service as syl
from app.services.free_plan import IST

WEAK_ACCURACY = 60
WEAK_MIN_ANSWERS = 3
FREE_MAX_DAYS = 7
SAMPLE_SUBJECTS = [  # shown on the revision plan until the student has test results (as in the client's planner)
    {"name": "Polity", "accuracy": 82, "topic": "Fundamental Rights"},
    {"name": "History", "accuracy": 64, "topic": "Revolt of 1857"},
    {"name": "Economy", "accuracy": 48, "topic": "Inflation — CPI and WPI"},
    {"name": "Geography", "accuracy": 39, "topic": "Monsoon system"},
]


class PlannerError(Exception):
    """A message for the student; status is the HTTP status the router should use."""

    def __init__(self, message: str, status: int = 422, code: Optional[str] = None):
        super().__init__(message)
        self.message, self.status, self.code = message, status, code


def today_ist() -> date:
    return datetime.now(timezone.utc).astimezone(IST).date()


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def is_generated():
    return or_(col(StudyTask.plan_id).is_not(None), col(StudyTask.block).is_not(None),
               and_(col(StudyTask.is_ai_recommended).is_(True), col(StudyTask.source_attempt_id).is_(None)))


async def drop_cache(user_id: int) -> None:
    try:
        from app.cache import invalidate_study_activity_cache
        await invalidate_study_activity_cache(user_id)
    except Exception:
        pass


# ── Settings ─────────────────────────────────────────────────────────────────

async def get_settings(session: AsyncSession, user_id: int) -> PlannerSettings:
    q = select(PlannerSettings).where(PlannerSettings.user_id == user_id)
    s = (await session.exec(q)).first()
    if not s:
        # The planner page loads /planner/exams and /planner/settings together, and both create the row on a
        # first visit; ON CONFLICT DO NOTHING lets the slower one read the winner's row instead of failing.
        await bulk_insert_on_conflict_do_nothing(session, PlannerSettings, [PlannerSettings(user_id=user_id, prefs={})],
                                                 ["user_id"])
        await session.commit()
        s = (await session.exec(q)).one()
    return s


async def update_settings(session: AsyncSession, user_id: int, daily_goal: Optional[int],
                          weekly_target: Optional[int]) -> PlannerSettings:
    s = await get_settings(session, user_id)
    if daily_goal is not None:
        s.daily_goal_topics = max(1, min(30, daily_goal))
    if weekly_target is not None:
        s.weekly_coverage_target = max(1, min(200, weekly_target))
    session.add(s)
    await session.commit()
    await session.refresh(s)
    return s


async def active_plan(session: AsyncSession, user_id: int) -> Optional[StudyPlan]:
    return (await session.exec(select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.is_active == True)
                               .order_by(col(StudyPlan.id).desc()))).first()


# ── Syllabus and coverage ────────────────────────────────────────────────────

def _target_exam_type(groups: List[Dict[str, Any]], target: Optional[str]) -> Optional[Dict[str, Any]]:
    """The exam type matching the student's onboarding target ("UPSC CSE" -> upsc, "MPSC Rajyaseva" -> mpsc)."""
    t = (target or "").lower()
    if not t:
        return None
    for g in groups:
        code = g["code"].lower()
        if t.split()[0].startswith(code) or code.startswith(t.split()[0]) or g["name"].lower() in t:
            return g
    return None


async def active_exams(session: AsyncSession, user_id: Optional[int] = None) -> Dict[str, Any]:
    """Exam types with their active syllabi (the student's target exam first), and the syllabus to start on: the
    student's last plan or saved choice, else the first syllabus of their target exam, else the first one listed."""
    groups = await syl.syllabi_by_exam_type(session, active_only=True)
    ids = [s["id"] for g in groups for s in g["syllabi"]]
    default = None
    if user_id:
        profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == user_id))).first()
        g = _target_exam_type(groups, profile.target_exam if profile else None)
        if g:
            groups = [g] + [x for x in groups if x is not g]
        prefs = (await get_settings(session, user_id)).prefs or {}
        if prefs.get("syllabus_id") in ids:
            default = prefs["syllabus_id"]
        elif g and g["syllabi"]:
            default = g["syllabi"][0]["id"]
    if default is None and ids:
        default = ids[0]
    return {"exam_types": groups, "default_syllabus_id": default}


async def _exam(session: AsyncSession, syllabus_id: int) -> Tuple[PlannerExam, ExamType]:
    """An active syllabus of an active exam type, with the exam type."""
    exam = await session.get(PlannerExam, syllabus_id) if syllabus_id else None
    et = await session.get(ExamType, exam.exam_type_id) if exam else None
    if not exam or not exam.is_active or not et or not et.is_active:
        raise PlannerError("That syllabus is not available in the planner.", 404)
    return exam, et


def _exam_info(exam: PlannerExam, et: ExamType) -> Dict[str, Any]:
    return {"syllabus_id": exam.id, "exam_type": et.type, "stage": exam.stage, "name": exam.name,
            "label": syllabus_label(et.type, exam.stage, exam.name), "answer_writing": exam.answer_writing}


async def _covered(session: AsyncSession, user_id: int) -> Dict[int, datetime]:
    return dict((await session.exec(select(UserSyllabusCoverage.planner_subtopic_id, UserSyllabusCoverage.covered_at)
                                    .where(UserSyllabusCoverage.user_id == user_id))).all())


def _aware(ts: datetime) -> datetime:
    return ts if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


async def syllabus(session: AsyncSession, user_id: int, syllabus_id: int) -> Dict[str, Any]:
    exam, et = await _exam(session, syllabus_id)
    tree = await syl.exam_tree(session, exam.id)
    covered = await _covered(session, user_id)
    total = done = 0
    for s in tree:
        s_total = s_done = 0
        for t in s["topics"]:
            for st in t["subtopics"]:
                st["covered"] = st["id"] in covered
                s_total += 1
                s_done += st["covered"]
        s["total"], s["done"] = s_total, s_done
        total += s_total
        done += s_done
    settings = await get_settings(session, user_id)
    since = datetime.combine(week_start(today_ist()), datetime.min.time(), tzinfo=IST)
    week_done = sum(1 for ts in covered.values() if _aware(ts) >= since)
    return {"exam": _exam_info(exam, et), "subjects": tree, "total": total, "done": done, "percent": round(done * 100 / total) if total else 0,
            "week_done": week_done, "weekly_target": settings.weekly_coverage_target}


async def set_coverage(session: AsyncSession, user_id: int, subtopic_id: int, covered: bool) -> None:
    if not await session.get(PlannerSubtopic, subtopic_id):
        raise PlannerError("Subtopic not found.", 404)
    row = await session.get(UserSyllabusCoverage, (user_id, subtopic_id))
    if covered and not row:
        session.add(UserSyllabusCoverage(user_id=user_id, planner_subtopic_id=subtopic_id))
    elif not covered and row:
        await session.delete(row)
    await session.commit()


# ── Weak topics ──────────────────────────────────────────────────────────────

async def _weak_bank(session: AsyncSession, user_id: int) -> Dict[int, Dict[str, Any]]:
    """Question-bank subtopics the student is weak in: {bank subtopic id: {subject, topic, acc}}."""
    from app.services.study_plan_generator import _subtopic_stats
    stats = await _subtopic_stats(session, user_id)
    weak = {sid: round(c * 100 / n) for sid, (n, c) in stats.items()
            if n >= WEAK_MIN_ANSWERS and c * 100 < WEAK_ACCURACY * n}
    if not weak:
        return {}
    rows = (await session.exec(
        select(Subtopic.id, Subject.name, Subtopic.name).join(Topic, Topic.id == Subtopic.topic_id)
        .join(Subject, Subject.id == Topic.subject_id).where(col(Subtopic.id).in_(list(weak))))).all()
    return {sid: {"subject": subj, "topic": name, "acc": weak[sid]} for sid, subj, name in rows}


# ── Generating a plan ────────────────────────────────────────────────────────

async def _items(session: AsyncSession, user_id: int, exam: PlannerExam, subjects: Optional[List[str]]) -> List[Dict[str, Any]]:
    tree = await syl.exam_tree(session, exam.id)
    covered = await _covered(session, user_id)
    pick = set(subjects) if subjects else None
    return [{"sub": s["name"], "top": t["name"], "st": st["name"], "id": st["id"], "bank": st["bank_subtopic_id"]}
            for s in tree if pick is None or s["name"] in pick
            for t in s["topics"] for st in t["subtopics"] if st["id"] not in covered]


def options_from(req: Dict[str, Any], answer_writing: bool) -> engine.PlanOptions:
    return engine.PlanOptions(
        hours=max(1.0, min(14.0, float(req.get("hours") or 4))),
        mock=req.get("mock"), rest=req.get("rest"), tail=bool(req.get("tail", True)),
        mix=int(req.get("mix") or 1), subj_days={k: int(v) for k, v in (req.get("subject_days") or {}).items() if v},
        ca=bool(req.get("ca", True)), pyq=bool(req.get("pyq", True)),
        custom_title=str(req.get("custom_title") or "")[:60], answer_writing=answer_writing,
    )


def check_limits(req: Dict[str, Any], limited: bool) -> None:
    """Free plan: up to FREE_MAX_DAYS days, no weak-topics-first, no days per subject."""
    if not limited:
        return
    if (req.get("days") or 0) > FREE_MAX_DAYS:
        raise PlannerError(f"The free plan builds plans of up to {FREE_MAX_DAYS} days. Upgrade to Pro for longer plans.",
                           403, "PRO_STUDY_PLANNER")
    if req.get("weak_first") or any((req.get("subject_days") or {}).values()):
        raise PlannerError("Weak topics first and days per subject are part of Pro.", 403, "PRO_STUDY_PLANNER")


async def _prepare(session: AsyncSession, user_id: int, req: Dict[str, Any]):
    exam, _et = await _exam(session, req["syllabus_id"])
    try:
        days, note = engine.plan_days(req.get("days"), req.get("exam_date"), today_ist())
    except ValueError as e:
        raise PlannerError(str(e))
    items = await _items(session, user_id, exam, req.get("subjects"))
    return exam, days, note, items, options_from(req, exam.answer_writing)


async def estimate(session: AsyncSession, user_id: int, req: Dict[str, Any]) -> Dict[str, Any]:
    exam, days, note, items, o = await _prepare(session, user_id, req)
    n_subjects = len(req.get("subjects") or []) or len({i["sub"] for i in items})
    out = engine.estimate(items, days, o, today_ist(), n_subjects)
    out["days"] = days
    return out


async def clear_open_generated(session: AsyncSession, user_id: int) -> int:
    res = await session.exec(delete(StudyTask).where(StudyTask.user_id == user_id, StudyTask.is_completed == False,
                                                     is_generated()))
    return res.rowcount or 0


async def generate(session: AsyncSession, user_id: int, req: Dict[str, Any]) -> Dict[str, Any]:
    exam, days, note, items, o = await _prepare(session, user_id, req)
    if not items:
        raise PlannerError("No pending topics in the selected subjects (all covered, or none selected).")
    weak_n = 0
    if req.get("weak_first"):
        weak_bank = await _weak_bank(session, user_id)
        for it in items:
            if it["bank"] in weak_bank:
                it["acc"] = weak_bank[it["bank"]]["acc"]
        items, weak_n = engine.weak_first(items, list(weak_bank.values()))
    start = today_ist()
    sch = engine.build_schedule(items, days, o, start)
    tasks = engine.materialize(sch, items, o)
    weak_ids = {it["id"] for it in items if it.get("acc") is not None}

    await clear_open_generated(session, user_id)
    for old in (await session.exec(select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.is_active == True))).all():
        old.is_active = False
        session.add(old)
    plan = StudyPlan(user_id=user_id, planner_exam_id=exam.id, start_date=start, days=days,
                     options={**{k: v for k, v in req.items() if k != "exam_date"},
                              "exam_date": str(req["exam_date"]) if req.get("exam_date") else None})
    session.add(plan)
    await session.flush()

    # Revision questions due each day come first, as in the data-driven plan
    from app.services.study_plan_generator import _due_by_day
    due = await _due_by_day(session, user_id, start, start + timedelta(days=days - 1))
    for day, n_due in sorted(due.items()):
        session.add(StudyTask(
            user_id=user_id, plan_id=plan.id, block="revq", scheduled_date=day, subject="Revision",
            title=f"Revise {n_due} question{'s' if n_due != 1 else ''} due today", priority="HIGH",
            description="Spaced revision: questions you answered before come back just before you're likely to forget them.",
            allocated_time_minutes=min(45, max(15, engine.js_round(n_due * 1.5 / 5) * 5)),
            activity_type="CONCEPT_REVISION", is_ai_recommended=True))
    for t in tasks:
        session.add(StudyTask(
            user_id=user_id, plan_id=plan.id, block=t["block"], planner_subtopic_id=t["planner_subtopic_id"],
            scheduled_date=start + timedelta(days=t["offset"]), subject=t["subject"], topic=t["topic"],
            subtopic=t["subtopic"], title=t["title"][:255], allocated_time_minutes=t["minutes"],
            activity_type=t["activity_type"], is_ai_recommended=True,
            priority="HIGH" if t["planner_subtopic_id"] in weak_ids or t["block"] == "mock" else "MEDIUM"))

    settings = await get_settings(session, user_id)
    settings.prefs = {k: req.get(k) for k in ("syllabus_id", "days", "subjects", "subject_days", "hours", "mock", "rest",
                                               "tail", "mix", "ca", "pyq", "custom_title", "weak_first", "auto_catch")}
    session.add(settings)
    await session.commit()
    await drop_cache(user_id)
    return {
        "message": engine.generate_message(sch, len(items), days, o, note, weak_n),
        "warning": engine.overload_warning(sch["max_per"], o.hours),
        "task_count": len(tasks) + len(due), "topics": len(items), "days": days,
        "start_date": str(start), "end_date": str(start + timedelta(days=days - 1)),
    }


async def clear_plan(session: AsyncSession, user_id: int) -> int:
    n = await clear_open_generated(session, user_id)
    for p in (await session.exec(select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.is_active == True))).all():
        p.is_active = False
        session.add(p)
    await session.commit()
    await drop_cache(user_id)
    return n


# ── Tasks ────────────────────────────────────────────────────────────────────

def task_out(t: StudyTask, practice: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    return {"id": t.id, "date": str(t.scheduled_date), "title": t.title, "subject": t.subject, "topic": t.topic,
            "subtopic": t.subtopic, "minutes": t.allocated_time_minutes, "done": t.is_completed, "block": t.block,
            "priority": t.priority, "activity_type": t.activity_type, "planner_subtopic_id": t.planner_subtopic_id,
            "practice": practice, "planned": t.plan_id is not None or t.block is not None,
            "description": t.description}


# Words too common in syllabus names to say two names are about the same thing
_GENERIC_WORDS = {"indian", "india", "and", "general", "state", "studies", "the", "its", "for", "with", "world",
                  "constitution", "constitutional", "basics", "basic", "issues", "role", "important", "other",
                  "feature", "features", "concept", "concepts", "aspect", "aspects", "related", "miscellaneous"}


def _words(name: str) -> set:
    """Meaningful words of a syllabus name ("Union & Its Territory" -> {"union", "territory"}), plurals folded."""
    for ch in "&,()/-—:.'":
        name = name.replace(ch, " ")
    out = set()
    for w in (name or "").lower().split():
        if len(w) > 2 and w not in _GENERIC_WORDS:
            out.add(w[:-1] if len(w) > 4 and w.endswith("s") else w)
    return out


class _BankIndex:
    """Question-bank names with published questions, for matching planner topics to practice filters.
    Each paper has its own copy of the syllabus, so names are merged and the busiest copy wins."""

    def __init__(self, rows):
        self.by_id: Dict[int, Tuple[str, str, str]] = {}
        self.subtopics: Dict[str, Tuple[str, str, str, int]] = {}
        self.topics: Dict[str, Tuple[str, str, int]] = {}
        self.subjects: Dict[str, Tuple[str, int]] = {}
        for sid, subj, top, st, n in rows:
            n = int(n or 0)
            if not n:
                continue
            self.by_id[sid] = (subj, top, st)
            if n > self.subtopics.get(st.lower(), ("", "", "", 0))[3]:
                self.subtopics[st.lower()] = (subj, top, st, n)
            t = self.topics.get(top.lower())
            if not t or t[0] == subj:
                self.topics[top.lower()] = (subj, top, (t[2] if t else 0) + n)
            sj = self.subjects.get(subj.lower())
            self.subjects[subj.lower()] = (subj, (sj[1] if sj else 0) + n)

    def subject_for(self, name: str) -> Optional[str]:
        """The bank subject closest to a planner subject: the same name, else the most shared words
        ("Polity and Governance" ~ "Indian Polity & Governance", "Indian History" ~ "History"), then the most questions."""
        name = (name or "").lower()
        if name in self.subjects:
            return self.subjects[name][0]
        words = _words(name)
        best = None
        for key, (label, n) in self.subjects.items():
            shared = len(words & _words(key))
            if shared and (best is None or (shared, n) > best[1:]):
                best = (label, shared, n)
        return best[0] if best else None

    def _closest(self, words: set, candidates, subject: Optional[str]):
        """The candidate whose words overlap `words` the most (more than a quarter of both sets together), inside the
        planner subject's bank subject first; another subject's candidate needs two shared words. Ties go to the one
        with more questions."""
        best = None
        for key, val in candidates:
            other = _words(key)
            shared = len(words & other)
            same = val[0] == subject
            overlap = shared / len(words | other) if shared else 0
            if overlap <= 0.25 or (not same and shared < 2):
                continue
            score = (same, overlap, val[-1])
            if best is None or score > best[0]:
                best = (score, val)
        return best[1] if best else None

    def resolve(self, bank_id: Optional[int], subject: str, topic: str, subtopic: str) -> Dict[str, str]:
        """Practice filters for a planner subtopic, most specific first: the linked bank subtopic; a bank subtopic or
        topic with the same name; then the bank subtopic, else topic, sharing the most words with it; else the
        closest subject. Empty when nothing matches (practice opens unfiltered)."""
        if bank_id in self.by_id:
            s, t, st = self.by_id[bank_id]
            return {"subject": s, "topic": t, "subtopic": st}
        hit = self.subtopics.get((subtopic or "").lower())
        if hit:
            return {"subject": hit[0], "topic": hit[1], "subtopic": hit[2]}
        for name in (subtopic, topic):
            hit = self.topics.get((name or "").lower())
            if hit:
                return {"subject": hit[0], "topic": hit[1]}
        bank_subject = self.subject_for(subject)
        words = _words(subtopic)
        hit = self._closest(words, self.subtopics.items(), bank_subject)
        if hit:
            return {"subject": hit[0], "topic": hit[1], "subtopic": hit[2]}
        hit = self._closest(words, self.topics.items(), bank_subject)
        if hit:
            return {"subject": hit[0], "topic": hit[1]}
        return {"subject": bank_subject} if bank_subject else {}


async def _bank_index(session: AsyncSession, exam_type_id: Optional[int] = None) -> _BankIndex:
    """The bank for one exam type (its papers' published questions), or the whole bank."""
    q = (select(Subtopic.id, Subject.name, Topic.name, Subtopic.name, func.count(Question.id))
         .join(Topic, col(Topic.id) == col(Subtopic.topic_id)).join(Subject, col(Subject.id) == col(Topic.subject_id))
         .join(Question, (col(Question.subtopic_id) == col(Subtopic.id)) & (Question.status == QuestionStatus.PUBLISHED)))
    if exam_type_id:
        q = q.join(Exam, col(Exam.id) == col(Question.exam_id)).where(Exam.exam_type_id == exam_type_id)
    return _BankIndex((await session.exec(q.group_by(Subtopic.id, Subject.name, Topic.name, Subtopic.name))).all())


def _join_filter(values: List[str]) -> Optional[str]:
    """The practice page's multi-value format: ',' or ';;' when a name has a comma."""
    vals = list(dict.fromkeys(v for v in values if v))
    if not vals:
        return None
    return ";;".join(vals) if any("," in v for v in vals) else ",".join(vals)


async def tasks_between(session: AsyncSession, user_id: int, start: date, end: date) -> List[Dict[str, Any]]:
    """Tasks by day. Plan topics (and their revisions) carry practice filters: the planner exam's question-bank
    exam type and the closest bank match. A day's "10 PYQs" block carries the filters of that day's topics."""
    rows = (await session.exec(
        select(StudyTask, PlannerSubject.name, PlannerTopic.name, PlannerSubtopic.name, PlannerSubtopic.bank_subtopic_id,
               PlannerExam.exam_type_id, ExamType.type)
        .outerjoin(PlannerSubtopic, col(PlannerSubtopic.id) == col(StudyTask.planner_subtopic_id))
        .outerjoin(PlannerTopic, col(PlannerTopic.id) == col(PlannerSubtopic.topic_id))
        .outerjoin(PlannerSubject, col(PlannerSubject.id) == col(PlannerTopic.subject_id))
        .outerjoin(PlannerExam, col(PlannerExam.id) == col(PlannerSubject.exam_id))
        .outerjoin(ExamType, col(ExamType.id) == col(PlannerExam.exam_type_id))
        .where(StudyTask.user_id == user_id, StudyTask.scheduled_date >= start, StudyTask.scheduled_date <= end)
        .order_by(StudyTask.scheduled_date, StudyTask.id))).all()
    banks: Dict[Optional[int], _BankIndex] = {}
    practice: Dict[int, Dict[str, str]] = {}
    for t, subj, top, st, bank_id, et_id, et_type in rows:
        if not (t.planner_subtopic_id and st):
            continue
        if et_id not in banks:
            banks[et_id] = await _bank_index(session, et_id)
        p = banks[et_id].resolve(bank_id, subj, top, st)
        practice[t.id] = {"exam": et_type.upper(), **p} if et_type else p
    by_day: Dict[date, List[Dict[str, str]]] = defaultdict(list)
    for t, *_ in rows:
        if t.id in practice and t.block is None:
            by_day[t.scheduled_date].append(practice[t.id])
    out = []
    for t, *_ in rows:
        p = practice.get(t.id)
        if t.block == "pyq":
            day = by_day.get(t.scheduled_date, [])
            p = {k: v for k, v in (("exam", _join_filter([x.get("exam") for x in day])),
                                    ("subject", _join_filter([x.get("subject") for x in day])),
                                    ("topic", _join_filter([x.get("topic") for x in day if x.get("subject")]))) if v}
        out.append(task_out(t, p))
    return out


async def _own_task(session: AsyncSession, user_id: int, task_id: int) -> StudyTask:
    t = await session.get(StudyTask, task_id)
    if not t or t.user_id != user_id:
        raise PlannerError("Task not found.", 404)
    return t


async def skip_task(session: AsyncSession, user_id: int, task_id: int) -> str:
    t = await _own_task(session, user_id, task_id)
    if t.is_completed:
        raise PlannerError("That task is already done.")
    t.scheduled_date = t.scheduled_date + timedelta(days=1)
    session.add(t)
    await session.commit()
    await drop_cache(user_id)
    return str(t.scheduled_date)


async def reopen_task(session: AsyncSession, user_id: int, task_id: int) -> None:
    t = await _own_task(session, user_id, task_id)
    t.is_completed = False
    t.completed_at = None
    session.add(t)
    await session.commit()
    await drop_cache(user_id)


async def on_task_completed(session: AsyncSession, task: StudyTask) -> None:
    """A finished plan topic: mark its subtopic covered and line up spaced revisions. The caller has committed.
    Revisions and other blocks carry the subtopic too, but finishing them must not line up revisions of revisions."""
    if not task.planner_subtopic_id or task.block:
        return
    if not await session.get(UserSyllabusCoverage, (task.user_id, task.planner_subtopic_id)):
        session.add(UserSyllabusCoverage(user_id=task.user_id, planner_subtopic_id=task.planner_subtopic_id))
    st = await session.get(PlannerSubtopic, task.planner_subtopic_id)
    weak_acc = None
    if st and st.bank_subtopic_id:
        weak = await _weak_bank(session, task.user_id)
        weak_acc = weak.get(st.bank_subtopic_id, {}).get("acc")
    title = ("Revise: " + task.title)[:255]
    days = [task.scheduled_date + timedelta(days=off) for off in engine.rev_offsets(weak_acc=weak_acc)]
    have = set((await session.exec(select(StudyTask.scheduled_date).where(
        StudyTask.user_id == task.user_id, StudyTask.block == "auto_rev", StudyTask.title == title,
        col(StudyTask.scheduled_date).in_(days)))).all())
    for d in days:
        if d not in have:
            session.add(StudyTask(user_id=task.user_id, plan_id=task.plan_id, block="auto_rev", scheduled_date=d,
                                  subject="Revision", topic=task.topic, subtopic=task.subtopic, title=title,
                                  planner_subtopic_id=task.planner_subtopic_id, allocated_time_minutes=15,
                                  activity_type="CONCEPT_REVISION", is_ai_recommended=True))
    await session.commit()
    await drop_cache(task.user_id)


async def _missed(session: AsyncSession, user_id: int) -> List[StudyTask]:
    return list((await session.exec(select(StudyTask).where(
        StudyTask.user_id == user_id, StudyTask.is_completed == False, col(StudyTask.planner_subtopic_id).is_not(None),
        col(StudyTask.block).is_(None), StudyTask.scheduled_date < today_ist())
        .order_by(StudyTask.scheduled_date, StudyTask.id))).all())


async def catch_up(session: AsyncSession, user_id: int) -> int:
    missed = await _missed(session, user_id)
    today = today_ist()
    for t, off in zip(missed, engine.catch_up_offsets(len(missed))):
        t.scheduled_date = today + timedelta(days=off)
        session.add(t)
    await session.commit()
    if missed:
        await drop_cache(user_id)
    return len(missed)


async def log_focus(session: AsyncSession, user_id: int, minutes: int, task_id: Optional[int]) -> None:
    subject = None
    if task_id:
        t = await session.get(StudyTask, task_id)
        if t and t.user_id == user_id:
            subject = t.subject
    session.add(StudyActivity(user_id=user_id, date=today_ist(), activity_type=StudyActivityType.OTHER,
                              activity_source=ActivitySource.PLANNED, subject=subject, notes="focus",
                              duration_minutes=max(1, min(240, minutes))))
    await session.commit()
    await drop_cache(user_id)


# ── My plan ──────────────────────────────────────────────────────────────────

async def overview(session: AsyncSession, user_id: int) -> Dict[str, Any]:
    plan = await active_plan(session, user_id)
    auto_msg = None
    today = today_ist()
    if plan and (plan.options or {}).get("auto_catch", True) and plan.last_auto_catchup != today:
        plan.last_auto_catchup = today
        session.add(plan)
        await session.commit()
        n = await catch_up(session, user_id)
        if n:
            auto_msg = f"Auto catch-up: {n} missed topic(s) moved to the coming days."
    # Only the current plan's tasks: completed topics from earlier plans don't count towards this one
    rows = (await session.exec(select(StudyTask).where(StudyTask.user_id == user_id, StudyTask.plan_id == plan.id)
                               .order_by(StudyTask.scheduled_date, StudyTask.id))).all() if plan else []
    by_day: Dict[date, List[StudyTask]] = defaultdict(list)
    for t in rows:
        by_day[t.scheduled_date].append(t)
    subjects: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    for t in rows:
        if t.planner_subtopic_id and t.block is None:
            subjects[t.subject or "Other"][0] += 1
            subjects[t.subject or "Other"][1] += int(t.is_completed)
    info = await _plan_exam_info(session, plan)
    topics = sum(v[0] for v in subjects.values())
    return {
        "plan": {"syllabus_id": info["syllabus_id"] if info else None, "exam_label": info["label"] if info else None,
                 "start_date": str(plan.start_date), "days": plan.days, "options": plan.options} if plan else None,
        "topics": topics, "done": sum(v[1] for v in subjects.values()), "days": len(by_day),
        "end_date": str(max(by_day)) if by_day else None,
        "subjects": [{"name": k, "total": v[0], "done": v[1]} for k, v in sorted(subjects.items(), key=lambda x: -x[1][0])],
        "day_list": [{"date": str(d), "total": len(ts), "done": sum(t.is_completed for t in ts),
                      "subjects": list(dict.fromkeys(t.subject for t in ts if t.subject))} for d, ts in sorted(by_day.items())],
        "missed": len(await _missed(session, user_id)),
        "auto_catchup": auto_msg,
    }


async def _plan_exam_info(session: AsyncSession, plan: Optional[StudyPlan]) -> Optional[Dict[str, Any]]:
    exam = await session.get(PlannerExam, plan.planner_exam_id) if plan and plan.planner_exam_id else None
    et = await session.get(ExamType, exam.exam_type_id) if exam else None
    return _exam_info(exam, et) if exam and et else None


async def plan_tasks(session: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
    """The current plan's tasks, for the PDF and calendar exports."""
    plan = await active_plan(session, user_id)
    rows = (await session.exec(select(StudyTask).where(StudyTask.user_id == user_id, StudyTask.plan_id == plan.id)
                               .order_by(StudyTask.scheduled_date, StudyTask.id))).all() if plan else []
    return [task_out(t) for t in rows]


# ── Progress tracker ─────────────────────────────────────────────────────────

def range_dates(kind: str, anchor: date) -> Tuple[date, date]:
    if kind == "month":
        first = anchor.replace(day=1)
        nxt = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
        return first, nxt - timedelta(days=1)
    s = week_start(anchor)
    return s, s + timedelta(days=6)


async def tracker(session: AsyncSession, user_id: int, kind: str, anchor: date) -> Dict[str, Any]:
    start, end = range_dates(kind, anchor)
    today = today_ist()
    lo, hi = min(start, week_start(today)), max(end, week_start(today) + timedelta(days=13))
    rows = (await session.exec(select(StudyTask).where(StudyTask.user_id == user_id, StudyTask.scheduled_date >= lo,
                                                       StudyTask.scheduled_date <= hi))).all()
    in_range = [t for t in rows if start <= t.scheduled_date <= end]
    done = [t for t in in_range if t.is_completed]
    focus = (await session.exec(select(func.coalesce(func.sum(StudyActivity.duration_minutes), 0)).where(
        StudyActivity.user_id == user_id, StudyActivity.notes == "focus", StudyActivity.date >= start,
        StudyActivity.date <= end))).one()
    profile = (await session.exec(select(StudentProfile).where(StudentProfile.user_id == user_id))).first()
    settings = await get_settings(session, user_id)
    by_day: Dict[date, List[int]] = defaultdict(lambda: [0, 0])
    subj: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    for t in in_range:
        by_day[t.scheduled_date][0] += 1
        by_day[t.scheduled_date][1] += int(t.is_completed)
        if t.subject:
            subj[t.subject][0] += 1
            subj[t.subject][1] += int(t.is_completed)
    today_done = sum(1 for t in rows if t.scheduled_date == today and t.is_completed)
    calendar = []
    d = start
    while d <= end:
        n, dn = by_day.get(d, (0, 0))
        calendar.append({"date": str(d), "total": n, "done": dn})
        d += timedelta(days=1)
    return {
        "range": kind, "start": str(start), "end": str(end),
        "percent": round(len(done) * 100 / len(in_range)) if in_range else 0, "done": len(done), "total": len(in_range),
        "hours": round(sum(t.allocated_time_minutes or 0 for t in done) / 6) / 10,
        "streak": profile.current_streak if profile else 0, "focus_minutes": int(focus or 0),
        "daily_goal": settings.daily_goal_topics, "today_done": today_done, "calendar": calendar,
        "subjects": [{"name": k, "total": v[0], "done": v[1]} for k, v in sorted(subj.items(), key=lambda x: -x[1][0])],
        "tips": await _tips(session, user_id, rows, settings.daily_goal_topics, today),
    }


async def _tips(session: AsyncSession, user_id: int, rows: List[StudyTask], goal: int, today: date) -> List[str]:
    """This week's tips ("Is hafte ke tips"), the rules from the client's planner."""
    ws = week_start(today)
    week = [t for t in rows if ws <= t.scheduled_date <= ws + timedelta(days=6)]
    nxt = [t for t in rows if ws + timedelta(days=7) <= t.scheduled_date <= ws + timedelta(days=13)]
    subj: Dict[str, List[int]] = defaultdict(lambda: [0, 0])
    miss = 0
    for t in week:
        if t.subject and t.subject != "Revision":
            subj[t.subject][0] += 1
            subj[t.subject][1] += int(t.is_completed)
        if t.planner_subtopic_id and t.block is None and not t.is_completed and t.scheduled_date < today:
            miss += 1
    goal_days = sum(1 for i in range(7) if sum(1 for t in week if t.is_completed
                                               and t.scheduled_date == ws + timedelta(days=i)) >= goal)
    tips: List[str] = []
    behind = sorted(((s, v) for s, v in subj.items() if v[0] >= 2 and v[1] / v[0] < .5), key=lambda x: x[1][1] / x[1][0])
    for s, (n, d) in behind[:2]:
        tips.append(f"Give **{s}** extra time: only {d} of {n} done ({round(d * 100 / n)}%).")
    if miss:
        tips.append(f"Use **Catch up** to move {miss} missed topic{'s' if miss > 1 else ''} into the coming days.")
    weak = sorted((await _weak_bank(session, user_id)).values(), key=lambda w: w["acc"])
    if weak:
        tips.append(f"Practise **{weak[0]['subject']}: {weak[0]['topic']}** ({weak[0]['acc']}% accuracy) with a booster test.")
    rev_due = sum(1 for t in nxt if t.block == "auto_rev")
    if rev_due:
        tips.append(f"{rev_due} revision{'s are' if rev_due > 1 else ' is'} already lined up for next week. Do them first each day.")
    if goal_days < 4:
        tips.append(f"You hit your daily goal on {goal_days} of 7 days. Try a smaller goal you can hold every day.")
    if not nxt:
        tips.append("Nothing is planned for next week yet. Generate or extend your plan.")
    return tips[:5] or ["Great week. Keep the same pace."]


# ── Revision plan from test results ──────────────────────────────────────────

async def revision_plan(session: AsyncSession, user_id: int) -> Dict[str, Any]:
    from app.services.study_plan_generator import _subtopic_stats
    from app.services.mistake_service import list_mistakes
    stats = await _subtopic_stats(session, user_id)
    subjects: List[Dict[str, Any]] = []
    if stats:
        rows = (await session.exec(
            select(Subtopic.id, Subject.name, Subtopic.name).join(Topic, Topic.id == Subtopic.topic_id)
            .join(Subject, Subject.id == Topic.subject_id).where(col(Subtopic.id).in_(list(stats))))).all()
        agg: Dict[str, Dict[str, Any]] = {}
        for sid, subject, name in rows:
            n, c = stats[sid]
            a = agg.setdefault(subject, {"n": 0, "c": 0, "worst": None})
            a["n"] += n
            a["c"] += c
            if n and (a["worst"] is None or c / n < a["worst"][1]):
                a["worst"] = (name, c / n)
        subjects = [{"name": s, "accuracy": round(a["c"] * 100 / a["n"]), "topic": a["worst"][0] if a["worst"] else s}
                    for s, a in agg.items() if a["n"] >= 5]
    mistakes = []
    if subjects:
        page = await list_mistakes(session, user_id, limit=6)
        qids = [r[0].id for r in page["rows"]]
        texts: Dict[int, str] = {}
        for qid, lang, text in (await session.exec(select(
                QuestionTranslation.question_id, QuestionTranslation.language, QuestionTranslation.question_text)
                .where(col(QuestionTranslation.question_id).in_(qids)))).all() if qids else []:
            if qid not in texts or lang == LanguageCode.ENGLISH:
                texts[qid] = text
        for q, wrong, _answers, _last, _fixed, subject in page["rows"]:
            text = texts.get(q.id)
            mistakes.append({"question": (text or f"Question {q.id}")[:140], "subject": subject, "wrong": int(wrong or 0),
                             "question_id": q.id})
    sample = not subjects
    if sample:
        subjects = SAMPLE_SUBJECTS
    weak = sorted(subjects, key=lambda s: s["accuracy"])
    plan = []
    for i in range(7):
        if i == 6:
            names = " and ".join(s["name"] for s in weak[:2])
            plan.append([{"subject": "Mock Test", "title": f"Re-test: {names}", "minutes": 45}])
            continue
        w = weak[i % len(weak)]
        m = next((x for x in mistakes if x["subject"] == w["name"]), None)
        plan.append([
            {"subject": "Revision", "title": f"Revise {w['topic']} ({w['name']})", "minutes": 40 if w["accuracy"] < 55 else 25},
            {"subject": "Revision", "title": f"Redo wrong questions: {m['question']}" if m else f"Solve 10 PYQs: {w['topic']}",
             "minutes": 20},
        ])
    return {"sample": sample, "subjects": subjects, "mistakes": mistakes[:4], "plan": plan}


async def add_revision_plan(session: AsyncSession, user_id: int) -> int:
    rp = await revision_plan(session, user_id)
    plan = await active_plan(session, user_id)
    start = today_ist() + timedelta(days=1)
    n = 0
    for i, items in enumerate(rp["plan"]):
        for t in items:
            session.add(StudyTask(user_id=user_id, plan_id=plan.id if plan else None, block="rev",
                                  scheduled_date=start + timedelta(days=i), subject=t["subject"], title=t["title"][:255],
                                  allocated_time_minutes=t["minutes"], activity_type="CONCEPT_REVISION",
                                  is_ai_recommended=True, priority="HIGH"))
            n += 1
    await session.commit()
    await drop_cache(user_id)
    return n


# ── Share links ──────────────────────────────────────────────────────────────

async def create_share(session: AsyncSession, user_id: int) -> str:
    plan = await active_plan(session, user_id)
    rows = (await session.exec(select(StudyTask).where(StudyTask.user_id == user_id, StudyTask.plan_id == plan.id)
                               .order_by(StudyTask.scheduled_date, StudyTask.id))).all() if plan else []
    rows = [t for t in rows if t.block not in ("auto_rev", "revq")]  # personal revisions don't travel
    if not rows:
        raise PlannerError("Generate a plan first, then share it.")
    base = min(plan.start_date, rows[0].scheduled_date)
    info = await _plan_exam_info(session, plan)
    payload = {"syllabus_id": info["syllabus_id"] if info else None, "exam_label": info["label"] if info else None, "tasks": [
        {"off": (t.scheduled_date - base).days, "subject": t.subject, "topic": t.topic, "subtopic": t.subtopic,
         "title": t.title, "minutes": t.allocated_time_minutes, "block": t.block, "activity_type": t.activity_type,
         "planner_subtopic_id": t.planner_subtopic_id} for t in rows]}
    token = secrets.token_urlsafe(9)
    session.add(StudyPlanShare(token=token, user_id=user_id, payload=payload))
    await session.commit()
    return token


async def _share(session: AsyncSession, token: str) -> StudyPlanShare:
    share = await session.get(StudyPlanShare, token)
    if not share:
        raise PlannerError("This plan link is not valid any more.", 404)
    return share


async def share_summary(session: AsyncSession, token: str) -> Dict[str, Any]:
    p = (await _share(session, token)).payload or {}
    tasks = p.get("tasks") or []
    return {"exam_label": p.get("exam_label"), "tasks": len(tasks),
            "days": (max(t["off"] for t in tasks) + 1) if tasks else 0}


async def import_share(session: AsyncSession, user_id: int, token: str, limited: bool = False) -> int:
    p = (await _share(session, token)).payload or {}
    tasks = p.get("tasks") or []
    if limited and tasks and max(int(t["off"]) for t in tasks) + 1 > FREE_MAX_DAYS:
        raise PlannerError(f"This plan is longer than {FREE_MAX_DAYS} days. Upgrade to Pro to import it.",
                           403, "PRO_STUDY_PLANNER")
    ids = {t["planner_subtopic_id"] for t in tasks if t.get("planner_subtopic_id")}
    alive = set((await session.exec(select(PlannerSubtopic.id).where(col(PlannerSubtopic.id).in_(list(ids)))))
                .all()) if ids else set()
    exam = await session.get(PlannerExam, p["syllabus_id"]) if p.get("syllabus_id") else None
    await clear_open_generated(session, user_id)
    for old in (await session.exec(select(StudyPlan).where(StudyPlan.user_id == user_id, StudyPlan.is_active == True))).all():
        old.is_active = False
        session.add(old)
    start = today_ist()
    plan = StudyPlan(user_id=user_id, planner_exam_id=exam.id if exam else None, start_date=start,
                     days=(max(t["off"] for t in tasks) + 1) if tasks else 0, options={"imported": token})
    session.add(plan)
    await session.flush()
    for t in tasks:
        session.add(StudyTask(
            user_id=user_id, plan_id=plan.id, block=t.get("block"),
            planner_subtopic_id=t.get("planner_subtopic_id") if t.get("planner_subtopic_id") in alive else None,
            scheduled_date=start + timedelta(days=int(t["off"])), subject=t.get("subject"), topic=t.get("topic"),
            subtopic=t.get("subtopic"), title=str(t.get("title"))[:255], allocated_time_minutes=int(t.get("minutes") or 30),
            activity_type=t.get("activity_type") or "NEW_TOPIC", is_ai_recommended=True))
    await session.commit()
    await drop_cache(user_id)
    return len(tasks)
