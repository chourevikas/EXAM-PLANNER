import re
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlmodel import select, col, func, or_
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import ExamType, Exam
from app.schemas.exam_type import ExamTypeCreate, ExamTypeUpdate, ExamTypeResponse
from app.repositories.exam_type_repository import ExamTypeRepository
from app.cache import get_cache


class ExamTypeService:
    """Service handling business logic and validations for Exam Types."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = ExamTypeRepository(session)

    async def list_exam_types(self, include_inactive: bool = True) -> List[ExamTypeResponse]:
        rows = await self.repo.list_all(include_inactive=include_inactive)
        result = []
        for exam_type, count in rows:
            resp = ExamTypeResponse.model_validate(exam_type)
            resp.exams_count = count
            result.append(resp)
        return result

    async def get_exam_type(self, exam_type_id: int | str) -> ExamTypeResponse:
        exam_type = await self.repo.get_by_id(exam_type_id)
        if not exam_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exam type with ID '{exam_type_id}' not found.",
            )
        count = await self.repo.count_associated_exams(exam_type.id)
        resp = ExamTypeResponse.model_validate(exam_type)
        resp.exams_count = count
        return resp

    async def get_by_code(self, code: str) -> Optional[ExamType]:
        return await self.repo.get_by_type(code)

    async def create_exam_type(self, payload: ExamTypeCreate) -> ExamTypeResponse:
        clean_code = payload.type.strip().lower()
        existing = await self.repo.get_by_type(clean_code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An exam type with code '{clean_code}' already exists.",
            )

        exam_type = ExamType(
            type=clean_code,
            name=payload.name.strip(),
            total_duration=payload.total_duration,
            number_of_questions=payload.number_of_questions,
            total_marks=payload.total_marks,
            negative_marks=payload.negative_marks,
            positive_marks=payload.positive_marks,
            description=payload.description.strip() if payload.description else None,
            is_active=payload.is_active,
        )

        saved = await self.repo.create(exam_type)
        await self._invalidate_cache()
        resp = ExamTypeResponse.model_validate(saved)
        resp.exams_count = 0
        return resp

    async def update_exam_type(self, exam_type_id: int | str, payload: ExamTypeUpdate) -> ExamTypeResponse:
        exam_type = await self.repo.get_by_id(exam_type_id)
        if not exam_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exam type with ID '{exam_type_id}' not found.",
            )

        old_code = exam_type.type
        update_data = payload.model_dump(exclude_unset=True)
        # Papers link to the type by id, so the code can be renamed; their display names (which lead
        # with the code) are renamed with it below.
        new_code = update_data.pop("type", None)
        if new_code and new_code.strip().lower() != exam_type.type:
            clean_code = new_code.strip().lower()
            existing = await self.repo.get_by_type(clean_code)
            if existing and existing.id != exam_type.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"An exam type with code '{clean_code}' already exists.",
                )
            update_data["type"] = clean_code

        updated = await self.repo.update(exam_type, update_data)
        await self._sync_exam_names(updated, old_code)
        count = await self.repo.count_associated_exams(updated.id)
        await self._invalidate_cache()
        resp = ExamTypeResponse.model_validate(updated)
        resp.exams_count = count
        return resp

    async def delete_exam_type(self, exam_type_id: int | str) -> Dict[str, Any]:
        exam_type = await self.repo.get_by_id(exam_type_id)
        if not exam_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Exam type with ID '{exam_type_id}' not found.",
            )

        count = await self.repo.count_associated_exams(exam_type.id)
        if count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete exam type '{exam_type.name}' ({exam_type.type}) because {count} exam paper(s) are linked to it. Reassign or delete associated exams first.",
            )

        # Its study syllabi hold students' plans and coverage, so they have to be removed on purpose first
        from sqlmodel import select, func
        from app.db.models.planner import PlannerExam
        syllabi = (await self.repo.session.exec(
            select(func.count(PlannerExam.id)).where(PlannerExam.exam_type_id == exam_type.id))).one()
        if syllabi:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete exam type '{exam_type.name}' ({exam_type.type}) because it has {syllabi} study syllabus(es). Delete them under Syllabus first.",
            )

        await self.repo.delete(exam_type)
        await self._invalidate_cache()
        return {
            "success": True,
            "message": f"Exam type '{exam_type.name}' ({exam_type.type}) deleted successfully.",
        }

    async def _sync_exam_names(self, exam_type: ExamType, old_code: str) -> None:
        """Keep uploaded papers' display names in step with the exam type code.

        Upload stores Exam.name as "<CODE> (<year>) - Set X", a copy of the type code at upload
        time, so renaming the code left existing papers showing the old one. Only a leading token
        equal to the old code is rewritten: hand-written names, and papers of another exam that
        were linked to this type at upload (e.g. "UPPCS (2021)" under upsc), are left alone.
        """
        new_upper = exam_type.type.upper()
        old_lower = old_code.lower()
        stmt = select(Exam).where(
            or_(
                col(Exam.exam_type_id) == exam_type.id,
                # Papers under this code that were never linked by FK (older uploads). Exam.code
                # keeps the upload-time code, so after one rename only the name still carries it.
                (col(Exam.exam_type_id).is_(None))
                & or_(
                    func.lower(Exam.code).startswith(f"{old_lower}-", autoescape=True),
                    func.lower(Exam.name).startswith(old_lower, autoescape=True),
                ),
            )
        )
        exams = (await self.session.exec(stmt)).all()

        renamed: List[Exam] = []
        for exam in exams:
            match = re.match(r"^([A-Za-z0-9_-]+)(.*)$", exam.name or "", re.DOTALL)
            if not match:
                continue
            leading, rest = match.groups()
            if leading.lower() == old_lower and leading != new_upper:
                exam.name = f"{new_upper}{rest}"
                self.session.add(exam)
                renamed.append(exam)

        if not renamed:
            return
        await self.session.commit()
        try:
            from app.cache.helpers import invalidate_exam_cache
            for exam in renamed:
                await invalidate_exam_cache(str(exam.id))
        except Exception:
            pass

    async def _invalidate_cache(self):
        try:
            from app.cache.helpers import invalidate_exam_type_cache
            await invalidate_exam_type_cache()
        except Exception:
            pass
