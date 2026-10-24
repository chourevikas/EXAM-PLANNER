"""Admin: the Study Planner syllabus. Planner exams, and their subjects -> topics -> subtopics."""
import re
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field as PField
from sqlmodel import select, func

from app.core.deps import require_admin_section
from app.db.session import AsyncSession, get_async_session
from app.db.models.user import User
from app.db.models.exam_type import ExamType
from app.db.models.hierarchy import Subtopic
from app.db.models.planner import PlannerExam, PlannerSubject, PlannerTopic, PlannerSubtopic
from app.services import planner_syllabus_service as syl

router = APIRouter(prefix="/admin/planner", tags=["Admin Planner Syllabus"])
_admin = require_admin_section("admin.planner_syllabus")
Level = Literal["subjects", "topics", "subtopics"]
PARENT_MODEL = {"subjects": PlannerExam, "topics": PlannerSubject, "subtopics": PlannerTopic}


class ExamIn(BaseModel):
    code: str = PField(min_length=2, max_length=50)
    label: str = PField(min_length=1, max_length=120)
    group: Literal["main", "optional"] = "main"
    answer_writing: bool = False
    is_active: bool = True
    exam_type_id: Optional[int] = None  # question-bank exam type that Practice opens


class ExamPatch(BaseModel):
    label: Optional[str] = PField(default=None, min_length=1, max_length=120)
    group: Optional[Literal["main", "optional"]] = None
    answer_writing: Optional[bool] = None
    is_active: Optional[bool] = None
    exam_type_id: Optional[int] = None
    clear_exam_type: bool = False  # Practice then searches every exam


class NodeIn(BaseModel):
    parent_id: int
    name: str = PField(min_length=1, max_length=255)


class NodePatch(BaseModel):
    name: Optional[str] = PField(default=None, min_length=1, max_length=255)
    bank_subtopic_id: Optional[int] = None
    clear_bank: bool = False  # unlink a subtopic from the question bank


class Reorder(BaseModel):
    ids: List[int]


class ImportIn(BaseModel):
    text: str
    mode: Literal["merge", "replace"] = "merge"


async def _counts(session: AsyncSession) -> dict:
    rows = (await session.exec(
        select(PlannerSubject.exam_id, func.count(func.distinct(PlannerSubject.id)), func.count(PlannerSubtopic.id))
        .select_from(PlannerSubject)
        .join(PlannerTopic, PlannerTopic.subject_id == PlannerSubject.id, isouter=True)
        .join(PlannerSubtopic, PlannerSubtopic.topic_id == PlannerTopic.id, isouter=True)
        .group_by(PlannerSubject.exam_id))).all()
    return {r[0]: (r[1], r[2]) for r in rows}


def _exam_out(e: PlannerExam, counts: dict) -> dict:
    s, st = counts.get(e.id, (0, 0))
    return {"id": e.id, "code": e.code, "label": e.label, "group": e.group, "answer_writing": e.answer_writing,
            "is_active": e.is_active, "sort_order": e.sort_order, "exam_type_id": e.exam_type_id,
            "subjects": s, "subtopics": st}


async def _exam(session: AsyncSession, exam_id: int) -> PlannerExam:
    exam = await session.get(PlannerExam, exam_id)
    if not exam:
        raise HTTPException(404, "Planner exam not found")
    return exam


async def _check_exam_type(session: AsyncSession, exam_type_id: Optional[int]) -> None:
    if exam_type_id is not None and not await session.get(ExamType, exam_type_id):
        raise HTTPException(404, "Exam type not found")


@router.get("/exam-types")
async def list_exam_types(session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    """Question-bank exam types a planner exam can practise from."""
    rows = (await session.exec(select(ExamType).order_by(ExamType.is_active.desc(), ExamType.name))).all()
    return [{"id": t.id, "code": t.type, "name": t.name, "is_active": t.is_active} for t in rows]


@router.get("/exams")
async def list_exams(session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    exams = (await session.exec(select(PlannerExam).order_by(PlannerExam.sort_order, PlannerExam.id))).all()
    counts = await _counts(session)
    return [_exam_out(e, counts) for e in exams]


@router.post("/exams", status_code=201)
async def create_exam(body: ExamIn, session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    code = re.sub(r"[^a-z0-9_]+", "_", body.code.strip().lower()).strip("_")
    if not code:
        raise HTTPException(422, "Code must contain letters or numbers")
    if await syl.exam_by_code(session, code):
        raise HTTPException(409, f"An exam with code '{code}' already exists")
    top = (await session.exec(select(func.max(PlannerExam.sort_order)))).first()
    await _check_exam_type(session, body.exam_type_id)
    exam = PlannerExam(code=code, label=body.label.strip(), group=body.group, answer_writing=body.answer_writing,
                       is_active=body.is_active, exam_type_id=body.exam_type_id,
                       sort_order=(top if top is not None else -1) + 1)
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    return _exam_out(exam, {})


@router.patch("/exams/{exam_id}")
async def update_exam(exam_id: int, body: ExamPatch, session: AsyncSession = Depends(get_async_session),
                      _: User = Depends(_admin)):
    exam = await _exam(session, exam_id)
    await _check_exam_type(session, body.exam_type_id)
    for k, v in body.model_dump(exclude_none=True, exclude={"clear_exam_type"}).items():
        setattr(exam, k, v.strip() if isinstance(v, str) else v)
    if body.clear_exam_type:
        exam.exam_type_id = None
    session.add(exam)
    await session.commit()
    await session.refresh(exam)
    return _exam_out(exam, await _counts(session))


@router.delete("/exams/{exam_id}", status_code=204)
async def delete_exam(exam_id: int, session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    await syl.delete_exam(session, await _exam(session, exam_id))
    await session.commit()


@router.post("/exams/reorder")
async def reorder_exams(body: Reorder, session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    exams = {e.id: e for e in (await session.exec(select(PlannerExam).where(PlannerExam.id.in_(body.ids)))).all()}
    for i, eid in enumerate(body.ids):
        if eid in exams:
            exams[eid].sort_order = i
            session.add(exams[eid])
    await session.commit()
    return {"ok": True}


@router.get("/exams/{exam_id}/tree")
async def get_tree(exam_id: int, session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    exam = await _exam(session, exam_id)
    tree = await syl.exam_tree(session, exam.id)
    names = await syl.bank_names(session, [st["bank_subtopic_id"] for s in tree for t in s["topics"]
                                           for st in t["subtopics"]])
    for s in tree:
        for t in s["topics"]:
            for st in t["subtopics"]:
                st["bank_label"] = names.get(st["bank_subtopic_id"])
    return {"exam": _exam_out(exam, await _counts(session)), "subjects": tree}


@router.post("/exams/{exam_id}/import")
async def import_syllabus(exam_id: int, body: ImportIn, session: AsyncSession = Depends(get_async_session),
                          _: User = Depends(_admin)):
    exam = await _exam(session, exam_id)
    try:
        tree = syl.parse_import(body.text)
    except ValueError as e:
        raise HTTPException(422, str(e))
    added = await syl.import_tree(session, exam, tree, replace=body.mode == "replace")
    await session.commit()
    return {"added": added}


@router.get("/bank-subtopics")
async def bank_subtopics(q: str = Query(..., min_length=2), session: AsyncSession = Depends(get_async_session),
                         _: User = Depends(_admin)):
    return await syl.search_bank_subtopics(session, q)


@router.post("/{level}", status_code=201)
async def create_node(level: Level, body: NodeIn, session: AsyncSession = Depends(get_async_session),
                      _: User = Depends(_admin)):
    if not await session.get(PARENT_MODEL[level], body.parent_id):
        raise HTTPException(404, "Parent not found")
    model = syl.LEVELS[level]
    node = model(**{syl.PARENT[level]: body.parent_id, "name": body.name.strip(),
                    "sort_order": await syl.next_order(session, level, body.parent_id)})
    session.add(node)
    await session.commit()
    await session.refresh(node)
    return node.model_dump()


@router.patch("/{level}/{node_id}")
async def update_node(level: Level, node_id: int, body: NodePatch, session: AsyncSession = Depends(get_async_session),
                      _: User = Depends(_admin)):
    node = await session.get(syl.LEVELS[level], node_id)
    if not node:
        raise HTTPException(404, "Not found")
    if body.name is not None:
        node.name = body.name.strip()
    if level == "subtopics":
        if body.clear_bank:
            node.bank_subtopic_id = None
        elif body.bank_subtopic_id is not None:
            if not await session.get(Subtopic, body.bank_subtopic_id):
                raise HTTPException(404, "Question-bank subtopic not found")
            node.bank_subtopic_id = body.bank_subtopic_id
    session.add(node)
    await session.commit()
    await session.refresh(node)
    return node.model_dump()


@router.delete("/{level}/{node_id}", status_code=204)
async def delete_node(level: Level, node_id: int, session: AsyncSession = Depends(get_async_session),
                      _: User = Depends(_admin)):
    if not await session.get(syl.LEVELS[level], node_id):
        raise HTTPException(404, "Not found")
    await syl.delete_node(session, level, node_id)
    await session.commit()


@router.post("/{level}/reorder")
async def reorder_nodes(level: Level, body: Reorder, session: AsyncSession = Depends(get_async_session),
                        _: User = Depends(_admin)):
    model = syl.LEVELS[level]
    nodes = {n.id: n for n in (await session.exec(select(model).where(model.id.in_(body.ids)))).all()}
    parents = {getattr(n, syl.PARENT[level]) for n in nodes.values()}
    if len(parents) > 1:
        raise HTTPException(422, "Reorder items under one parent at a time")
    for i, nid in enumerate(body.ids):
        if nid in nodes:
            nodes[nid].sort_order = i
            session.add(nodes[nid])
    await session.commit()
    return {"ok": True}
