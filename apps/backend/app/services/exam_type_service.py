from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import ExamType
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

        update_data = payload.model_dump(exclude_unset=True)
        # The code is the exam type's identity (papers, questions and sessions key off it), so it
        # is fixed at creation; only the name and paper settings can change. Echoing the current
        # code back is allowed so the edit form can submit its full state.
        new_code = update_data.pop("type", None)
        if new_code is not None and new_code.strip().lower() != exam_type.type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exam type code cannot be changed after creation. Only the name and paper settings can be edited.",
            )

        updated = await self.repo.update(exam_type, update_data)
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

    async def _invalidate_cache(self):
        try:
            from app.cache.helpers import invalidate_exam_type_cache
            await invalidate_exam_type_cache()
        except Exception:
            pass
