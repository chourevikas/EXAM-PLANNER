"""Planner syllabus: read the exam -> subject -> topic -> subtopic tree, edit it, and bulk-import into it.

Deletes remove children explicitly (not only through ON DELETE CASCADE) so they behave the same on SQLite.
"""
import json
from typing import Any, Dict, List, Optional, Sequence

from sqlmodel import select, delete, update, func
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.hierarchy import Exam, Subject, SyllabusVersion, Topic, Subtopic
from app.db.models.planner import (
    PlannerExam, PlannerSubject, PlannerTopic, PlannerSubtopic, UserSyllabusCoverage,
)
from app.db.models.enums import QuestionStatus
from app.db.models.question import Question
from app.db.models.study_plan import StudyTask

LEVELS = {"subjects": PlannerSubject, "topics": PlannerTopic, "subtopics": PlannerSubtopic}
PARENT = {"subjects": "exam_id", "topics": "subject_id", "subtopics": "topic_id"}


async def exam_by_code(session: AsyncSession, code: str) -> Optional[PlannerExam]:
    return (await session.exec(select(PlannerExam).where(PlannerExam.code == code))).first()


async def exam_tree(session: AsyncSession, exam_id: int) -> List[Dict[str, Any]]:
    """Subjects in order, each with topics in order, each with subtopics {id, name, bank_subtopic_id}."""
    subjects = (await session.exec(select(PlannerSubject).where(PlannerSubject.exam_id == exam_id)
                                   .order_by(PlannerSubject.sort_order, PlannerSubject.id))).all()
    sids = [s.id for s in subjects]
    topics = (await session.exec(select(PlannerTopic).where(PlannerTopic.subject_id.in_(sids))
                                 .order_by(PlannerTopic.sort_order, PlannerTopic.id))).all() if sids else []
    tids = [t.id for t in topics]
    subs = (await session.exec(select(PlannerSubtopic).where(PlannerSubtopic.topic_id.in_(tids))
                               .order_by(PlannerSubtopic.sort_order, PlannerSubtopic.id))).all() if tids else []
    by_topic: Dict[int, List[Dict[str, Any]]] = {}
    for st in subs:
        by_topic.setdefault(st.topic_id, []).append(
            {"id": st.id, "name": st.name, "bank_subtopic_id": st.bank_subtopic_id})
    by_subject: Dict[int, List[Dict[str, Any]]] = {}
    for t in topics:
        by_subject.setdefault(t.subject_id, []).append({"id": t.id, "name": t.name, "subtopics": by_topic.get(t.id, [])})
    return [{"id": s.id, "name": s.name, "topics": by_subject.get(s.id, [])} for s in subjects]


def _bank_paths():
    """Question-bank subtopics with their path and paper. Each paper has its own copy of the syllabus, so the same
    'Subject › Topic › Subtopic' exists once per paper; the paper name tells them apart."""
    return (select(Subtopic.id, Subject.name, Topic.name, Subtopic.name, Exam.name)
            .join(Topic, Topic.id == Subtopic.topic_id).join(Subject, Subject.id == Topic.subject_id)
            .join(SyllabusVersion, SyllabusVersion.id == Subject.version_id).join(Exam, Exam.id == SyllabusVersion.exam_id))


def _bank_label(row) -> str:
    return f"{row[1]} › {row[2]} › {row[3]} ({row[4]})"


async def bank_names(session: AsyncSession, ids: Sequence[int]) -> Dict[int, str]:
    """'Subject › Topic › Subtopic (Exam)' for question-bank subtopic ids."""
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    rows = (await session.exec(_bank_paths().where(Subtopic.id.in_(ids)))).all()
    return {r[0]: _bank_label(r) for r in rows}


async def search_bank_subtopics(session: AsyncSession, q: str, limit: int = 20) -> List[Dict[str, Any]]:
    like = f"%{q.strip().lower()}%"
    rows = (await session.exec(
        _bank_paths().where(func.lower(Subtopic.name).like(like) | func.lower(Topic.name).like(like))
        .order_by(Subtopic.name, Exam.name, Subtopic.id).limit(limit))).all()
    return [{"id": r[0], "label": _bank_label(r)} for r in rows]


async def next_order(session: AsyncSession, level: str, parent_id: int) -> int:
    model = LEVELS[level]
    top = (await session.exec(select(func.max(model.sort_order)).where(getattr(model, PARENT[level]) == parent_id))).first()
    return (top if top is not None else -1) + 1


async def _delete_subtopics(session: AsyncSession, ids: List[int]) -> None:
    if not ids:
        return
    await session.exec(delete(UserSyllabusCoverage).where(UserSyllabusCoverage.planner_subtopic_id.in_(ids)))
    await session.exec(update(StudyTask).where(StudyTask.planner_subtopic_id.in_(ids)).values(planner_subtopic_id=None))
    await session.exec(delete(PlannerSubtopic).where(PlannerSubtopic.id.in_(ids)))


async def delete_node(session: AsyncSession, level: str, node_id: int) -> None:
    """Delete a subject, topic or subtopic with everything under it. The caller commits."""
    if level == "subtopics":
        await _delete_subtopics(session, [node_id])
        return
    topic_ids = [node_id] if level == "topics" else list(
        (await session.exec(select(PlannerTopic.id).where(PlannerTopic.subject_id == node_id))).all())
    if topic_ids:
        sub_ids = list((await session.exec(select(PlannerSubtopic.id).where(PlannerSubtopic.topic_id.in_(topic_ids)))).all())
        await _delete_subtopics(session, sub_ids)
        await session.exec(delete(PlannerTopic).where(PlannerTopic.id.in_(topic_ids)))
    if level == "subjects":
        await session.exec(delete(PlannerSubject).where(PlannerSubject.id == node_id))


async def delete_exam(session: AsyncSession, exam: PlannerExam) -> None:
    for sid in (await session.exec(select(PlannerSubject.id).where(PlannerSubject.exam_id == exam.id))).all():
        await delete_node(session, "subjects", sid)
    await session.delete(exam)


def parse_import(text: str) -> Dict[str, Dict[str, List[str]]]:
    """Accept JSON {"Subject": {"Topic": ["Subtopic", ...]}} or the client's line format:
    `Subject|Topic A:sub 1,sub 2;Topic B:sub 3` (one subject per line)."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Nothing to import.")
    if text[0] in "{[":
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e.msg} (line {e.lineno}).")
        if not isinstance(data, dict):
            raise ValueError('JSON must look like {"Subject": {"Topic": ["Subtopic"]}}.')
        out: Dict[str, Dict[str, List[str]]] = {}
        for sub, topics in data.items():
            if not isinstance(topics, dict):
                raise ValueError(f'"{sub}": topics must be an object of topic -> list of subtopics.')
            out[str(sub).strip()] = {str(t).strip(): [str(x).strip() for x in (subs or []) if str(x).strip()]
                                     for t, subs in topics.items()}
        return out
    out = {}
    for n, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        if "|" not in line:
            raise ValueError(f"Line {n}: expected 'Subject|Topic:subtopic, subtopic;Topic:...'.")
        sub, rest = (p.strip() for p in line.split("|", 1))
        topics = out.setdefault(sub, {})
        for part in rest.split(";"):
            part = part.strip()
            if not part:
                continue
            if ":" not in part:
                raise ValueError(f"Line {n}: topic '{part}' needs ':' followed by its subtopics.")
            top, subs = part.split(":", 1)
            topics.setdefault(top.strip(), []).extend(x.strip() for x in subs.split(",") if x.strip())
    if not out:
        raise ValueError("Nothing to import.")
    return out


async def import_tree(session: AsyncSession, exam: PlannerExam, tree: Dict[str, Dict[str, List[str]]],
                      replace: bool) -> Dict[str, int]:
    """Merge (match by name, case-insensitive; add what's missing) or replace the exam's syllabus. Caller commits."""
    if replace:
        for sid in (await session.exec(select(PlannerSubject.id).where(PlannerSubject.exam_id == exam.id))).all():
            await delete_node(session, "subjects", sid)
        await session.flush()
    added = {"subjects": 0, "topics": 0, "subtopics": 0}
    subjects = {s.name.lower(): s for s in (await session.exec(
        select(PlannerSubject).where(PlannerSubject.exam_id == exam.id))).all()}
    s_order = await next_order(session, "subjects", exam.id)
    for sname, topics in tree.items():
        subj = subjects.get(sname.lower())
        if not subj:
            subj = PlannerSubject(exam_id=exam.id, name=sname[:200], sort_order=s_order)
            s_order += 1
            session.add(subj)
            await session.flush()
            subjects[sname.lower()] = subj
            added["subjects"] += 1
        existing_t = {t.name.lower(): t for t in (await session.exec(
            select(PlannerTopic).where(PlannerTopic.subject_id == subj.id))).all()}
        t_order = await next_order(session, "topics", subj.id)
        for tname, subs in topics.items():
            top = existing_t.get(tname.lower())
            if not top:
                top = PlannerTopic(subject_id=subj.id, name=tname[:200], sort_order=t_order)
                t_order += 1
                session.add(top)
                await session.flush()
                existing_t[tname.lower()] = top
                added["topics"] += 1
            have = {n.lower() for n in (await session.exec(
                select(PlannerSubtopic.name).where(PlannerSubtopic.topic_id == top.id))).all()}
            st_order = await next_order(session, "subtopics", top.id)
            for name in subs:
                if name.lower() in have:
                    continue
                session.add(PlannerSubtopic(topic_id=top.id, name=name[:255], sort_order=st_order))
                have.add(name.lower())
                st_order += 1
                added["subtopics"] += 1
    await session.flush()
    await link_bank_by_name(session, exam.id)
    return added


async def link_bank_by_name(session: AsyncSession, exam_id: int) -> None:
    """Fill bank_subtopic_id for this exam's unlinked subtopics whose name matches a bank subtopic.
    Every paper has its own copy of the syllabus, so pick the copy with the most published questions."""
    rows = (await session.exec(
        select(PlannerSubtopic).join(PlannerTopic, PlannerTopic.id == PlannerSubtopic.topic_id)
        .join(PlannerSubject, PlannerSubject.id == PlannerTopic.subject_id)
        .where(PlannerSubject.exam_id == exam_id, PlannerSubtopic.bank_subtopic_id.is_(None)))).all()
    if not rows:
        return
    names = {r.name.lower() for r in rows}
    published = func.count(Question.id)
    bank: Dict[str, int] = {}
    for bid, bname, _n in (await session.exec(
            select(Subtopic.id, Subtopic.name, published)
            .outerjoin(Question, (Question.subtopic_id == Subtopic.id) & (Question.status == QuestionStatus.PUBLISHED))
            .where(func.lower(Subtopic.name).in_(names))
            .group_by(Subtopic.id, Subtopic.name).order_by(published.desc(), Subtopic.id))).all():
        bank.setdefault(bname.lower(), bid)
    for r in rows:
        if r.name.lower() in bank:
            r.bank_subtopic_id = bank[r.name.lower()]
            session.add(r)
