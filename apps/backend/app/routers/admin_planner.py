"""Admin: study syllabi of exam types (UPSC Prelims, UPSC Mains, optionals…) and their subjects -> topics ->
subtopics. Edited from the Exam Types screen, so access follows the Exam Types permission."""
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

router = APIRouter(prefix="/admin", tags=["Admin Exam Syllabi"])
_admin = require_admin_section("admin.exam_types")
Level = Literal["subjects", "topics", "subtopics"]
Stage = Literal["prelims", "mains", "optional"]
PARENT_MODEL = {"subjects": PlannerExam, "topics": PlannerSubject, "subtopics": PlannerTopic}


class SyllabusIn(BaseModel):
    stage: Stage
    name: Optional[str] = PField(default=None, max_length=120)  # required for optionals; else "Prelims"/"Mains"
    answer_writing: Optional[bool] = None  # defaults to on for Mains and optionals


class SyllabusPatch(BaseModel):
    name: Optional[str] = PField(default=None, min_length=1, max_length=120)
    answer_writing: Optional[bool] = None
    is_active: Optional[bool] = None


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


async def _counts(session: AsyncSession, ids: List[int]) -> dict:
    if not ids:
        return {}
    rows = (await session.exec(
        select(PlannerSubject.exam_id, func.count(func.distinct(PlannerSubject.id)), func.count(PlannerSubtopic.id))
        .select_from(PlannerSubject)
        .join(PlannerTopic, PlannerTopic.subject_id == PlannerSubject.id, isouter=True)
        .join(PlannerSubtopic, PlannerSubtopic.topic_id == PlannerTopic.id, isouter=True)
        .where(PlannerSubject.exam_id.in_(ids)).group_by(PlannerSubject.exam_id))).all()
    return {r[0]: (r[1], r[2]) for r in rows}


async def _out(session: AsyncSession, items: List[PlannerExam], et: ExamType) -> List[dict]:
    counts = await _counts(session, [s.id for s in items])
    return [{**syl.syllabus_out(s, et), "subjects": counts.get(s.id, (0, 0))[0], "subtopics": counts.get(s.id, (0, 0))[1]}
            for s in items]


async def _exam_type(session: AsyncSession, exam_type_id: int) -> ExamType:
    et = await session.get(ExamType, exam_type_id)
    if not et:
        raise HTTPException(404, "Exam type not found")
    return et


async def _syllabus(session: AsyncSession, syllabus_id: int) -> PlannerExam:
    s = await session.get(PlannerExam, syllabus_id)
    if not s:
        raise HTTPException(404, "Syllabus not found")
    return s


def _stage_order(s: PlannerExam):
    return (syl.STAGES.index(s.stage) if s.stage in syl.STAGES else 9, s.sort_order, s.id)


@router.get("/syllabi")
async def all_syllabi(session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    """Every exam type that has syllabi, with them (for the Exam Types list counts)."""
    return await syl.syllabi_by_exam_type(session, active_only=False)


@router.get("/exam-types/{exam_type_id}/syllabi")
async def list_syllabi(exam_type_id: int, session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    et = await _exam_type(session, exam_type_id)
    items = sorted((await session.exec(select(PlannerExam).where(PlannerExam.exam_type_id == et.id))).all(),
                   key=_stage_order)
    return await _out(session, items, et)


@router.post("/exam-types/{exam_type_id}/syllabi", status_code=201)
async def create_syllabus(exam_type_id: int, body: SyllabusIn, session: AsyncSession = Depends(get_async_session),
                          _: User = Depends(_admin)):
    et = await _exam_type(session, exam_type_id)
    name = (body.name or "").strip()
    if body.stage == "optional" and not name:
        raise HTTPException(422, "Give the optional subject's name")
    name = name or body.stage.capitalize()
    exists = (await session.exec(select(PlannerExam).where(
        PlannerExam.exam_type_id == et.id, PlannerExam.stage == body.stage,
        func.lower(PlannerExam.name) == name.lower()))).first()
    if exists:
        raise HTTPException(409, f"{syl.syllabus_label(et.type, body.stage, name)} already exists")
    top = (await session.exec(select(func.max(PlannerExam.sort_order)).where(PlannerExam.exam_type_id == et.id))).first()
    item = PlannerExam(exam_type_id=et.id, stage=body.stage, name=name,
                       answer_writing=body.answer_writing if body.answer_writing is not None else body.stage != "prelims",
                       sort_order=(top if top is not None else -1) + 1)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return (await _out(session, [item], et))[0]


@router.post("/exam-types/{exam_type_id}/syllabi/reorder")
async def reorder_syllabi(exam_type_id: int, body: Reorder, session: AsyncSession = Depends(get_async_session),
                          _: User = Depends(_admin)):
    items = {s.id: s for s in (await session.exec(select(PlannerExam).where(
        PlannerExam.exam_type_id == exam_type_id, PlannerExam.id.in_(body.ids)))).all()}
    for i, sid in enumerate(body.ids):
        if sid in items:
            items[sid].sort_order = i
            session.add(items[sid])
    await session.commit()
    return {"ok": True}


@router.patch("/syllabi/{syllabus_id}")
async def update_syllabus(syllabus_id: int, body: SyllabusPatch, session: AsyncSession = Depends(get_async_session),
                          _: User = Depends(_admin)):
    item = await _syllabus(session, syllabus_id)
    if body.name is not None and item.stage != "optional":
        raise HTTPException(422, "Only optional subjects can be renamed")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v.strip() if isinstance(v, str) else v)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    return (await _out(session, [item], await session.get(ExamType, item.exam_type_id)))[0]


@router.delete("/syllabi/{syllabus_id}", status_code=204)
async def delete_syllabus(syllabus_id: int, session: AsyncSession = Depends(get_async_session),
                          _: User = Depends(_admin)):
    await syl.delete_exam(session, await _syllabus(session, syllabus_id))
    await session.commit()


@router.get("/syllabi/{syllabus_id}/tree")
async def get_tree(syllabus_id: int, session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    item = await _syllabus(session, syllabus_id)
    et = await session.get(ExamType, item.exam_type_id)
    tree = await syl.exam_tree(session, item.id)
    names = await syl.bank_names(session, [st["bank_subtopic_id"] for s in tree for t in s["topics"]
                                           for st in t["subtopics"]])
    for s in tree:
        for t in s["topics"]:
            for st in t["subtopics"]:
                st["bank_label"] = names.get(st["bank_subtopic_id"])
    return {"syllabus": (await _out(session, [item], et))[0], "subjects": tree}


@router.post("/syllabi/{syllabus_id}/import")
async def import_syllabus(syllabus_id: int, body: ImportIn, session: AsyncSession = Depends(get_async_session),
                          _: User = Depends(_admin)):
    item = await _syllabus(session, syllabus_id)
    try:
        tree = syl.parse_import(body.text)
    except ValueError as e:
        raise HTTPException(422, str(e))
    added = await syl.import_tree(session, item, tree, replace=body.mode == "replace")
    await session.commit()
    return {"added": added}


@router.get("/syllabi/{syllabus_id}/bank-subtopics")
async def bank_subtopics(syllabus_id: int, q: str = Query(..., min_length=2),
                         session: AsyncSession = Depends(get_async_session), _: User = Depends(_admin)):
    """Question-bank subtopics in this syllabus's exam type, to link a planner subtopic to."""
    item = await _syllabus(session, syllabus_id)
    return await syl.search_bank_subtopics(session, q, item.exam_type_id)


@router.post("/syllabi/nodes/{level}", status_code=201)
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


@router.patch("/syllabi/nodes/{level}/{node_id}")
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


@router.delete("/syllabi/nodes/{level}/{node_id}", status_code=204)
async def delete_node(level: Level, node_id: int, session: AsyncSession = Depends(get_async_session),
                      _: User = Depends(_admin)):
    if not await session.get(syl.LEVELS[level], node_id):
        raise HTTPException(404, "Not found")
    await syl.delete_node(session, level, node_id)
    await session.commit()


@router.post("/syllabi/nodes/{level}/reorder")
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
