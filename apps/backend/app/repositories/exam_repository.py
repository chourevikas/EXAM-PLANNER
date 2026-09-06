import uuid
from typing import Optional, List, Dict, Any
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import Exam


class ExamRepository:
    """Repository handling all database operations for Exam entities."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, exam_id: int | str) -> Optional[Exam]:
        try:
            parsed_id = int(exam_id)
        except (ValueError, TypeError):
            return None
        return await self.session.get(Exam, parsed_id)

    async def get_by_code(self, code: str) -> Optional[Exam]:
        stmt = select(Exam).where(Exam.code == code)
        res = await self.session.exec(stmt)
        return res.first()

    async def get_matching_canonical_exam(
        self,
        code: Optional[str] = None,
        year: Optional[int] = None,
        stage: Optional[str] = None,
        subject_code: Optional[str] = None,
        paper_set_code: Optional[str] = None,
    ) -> Optional[Exam]:
        """
        Finds an existing exam by code, code aliases, or composite key (year, stage, subject, set).
        Guarantees that variations like 'upse' vs 'upsc' match existing canonical exams.
        """
        from sqlmodel import func

        # 1. Check by exact or aliased code
        if code:
            clean_code = code.strip().lower()
            stmt = select(Exam).where(func.lower(Exam.code) == clean_code)
            res = await self.session.exec(stmt)
            match = res.first()
            if match:
                return match

            # Check known code prefix variations
            if clean_code.startswith("upsc-"):
                alt_code = "upse-" + clean_code[5:]
                res_alt = await self.session.exec(select(Exam).where(func.lower(Exam.code) == alt_code))
                match_alt = res_alt.first()
                if match_alt:
                    return match_alt
            elif clean_code.startswith("upse-"):
                alt_code = "upsc-" + clean_code[5:]
                res_alt = await self.session.exec(select(Exam).where(func.lower(Exam.code) == alt_code))
                match_alt = res_alt.first()
                if match_alt:
                    return match_alt

        # 2. Check by canonical parameters
        if year is not None and stage and subject_code and paper_set_code:
            try:
                norm_year = int(year)
                norm_stage = str(stage).strip().lower()
                norm_subj = str(subject_code).strip().lower()
                norm_set = str(paper_set_code).strip().lower()
                stmt = select(Exam).where(
                    Exam.source_year == norm_year,
                    func.lower(Exam.stage) == norm_stage,
                    func.lower(Exam.subject_code) == norm_subj,
                    func.lower(Exam.paper_set_code) == norm_set,
                )
                res = await self.session.exec(stmt)
                match = res.first()
                if match:
                    return match
            except (ValueError, TypeError):
                pass

        return None

    async def list_all(
        self, status: Optional[str] = None, is_active: Optional[bool] = None
    ) -> List[Exam]:
        stmt = select(Exam)
        if status:
            from sqlmodel import cast, String
            target_str = str(status.value) if hasattr(status, "value") else str(status)
            stmt = stmt.where(cast(Exam.status, String) == target_str)
        if is_active is not None:
            stmt = stmt.where(Exam.is_active == is_active)
        stmt = stmt.order_by(col(Exam.created_at).desc())
        res = await self.session.exec(stmt)
        return res.all()


    async def find_matching_exams_for_answer_key(
        self, stage: str, subject_code: str, year: int
    ) -> List[Exam]:
        stmt = select(Exam).where(
            Exam.stage == stage,
            Exam.subject_code == subject_code,
            Exam.source_year == year,
        )
        res = await self.session.exec(stmt)
        return res.all()

    async def save(self, exam: Exam) -> Exam:
        self.session.add(exam)
        await self.session.commit()
        await self.session.refresh(exam)
        return exam
