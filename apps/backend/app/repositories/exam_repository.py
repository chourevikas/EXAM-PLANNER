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

    async def get_all_matching_canonical_exams(
        self,
        code: Optional[str] = None,
        year: Optional[int] = None,
        stage: Optional[str] = None,
        subject_code: Optional[str] = None,
        paper_set_code: Optional[str] = None,
    ) -> List[Exam]:
        """
        Finds all existing exams matching by code, code aliases, or composite key (year, stage, subject, set).
        Guarantees that variations like 'upse' vs 'upsc' match all existing canonical exams.
        """
        from sqlmodel import func, or_

        matched_exams_dict: Dict[int, Exam] = {}

        # 1. Check by exact or aliased code
        if code:
            clean_code = code.strip().lower()
            stmt = select(Exam).where(func.lower(Exam.code) == clean_code)
            res = await self.session.exec(stmt)
            for e in res.all():
                if e.id is not None:
                    matched_exams_dict[e.id] = e

            # Check known code prefix variations (e.g. upsc- vs upse-)
            alt_codes = []
            if clean_code.startswith("upsc-"):
                alt_codes.append("upse-" + clean_code[5:])
            elif clean_code.startswith("upse-"):
                alt_codes.append("upsc-" + clean_code[5:])

            if alt_codes:
                res_alt = await self.session.exec(
                    select(Exam).where(func.lower(Exam.code).in_(alt_codes))
                )
                for e in res_alt.all():
                    if e.id is not None:
                        matched_exams_dict[e.id] = e

        # 2. Check by canonical parameters
        if year is not None and stage and subject_code and paper_set_code:
            try:
                norm_year = int(year)
                norm_stage = str(stage).strip().lower()
                subj_clean = str(subject_code).strip().lower()
                set_clean = str(paper_set_code).strip().lower()

                subj_variants = {subj_clean, subj_clean.replace("-", ""), subj_clean.replace("_", "")}
                set_variants = {set_clean, set_clean.replace("set_", ""), f"set_{set_clean}"}

                stmt = select(Exam).where(
                    Exam.source_year == norm_year,
                    func.lower(Exam.stage) == norm_stage,
                )
                res = await self.session.exec(stmt)
                for e in res.all():
                    e_subj = (e.subject_code or "").strip().lower()
                    e_set = (e.paper_set_code or "").strip().lower()
                    if (e_subj in subj_variants or e_subj.replace("-", "") in subj_variants) and (
                        e_set in set_variants or e_set.replace("set_", "") in set_variants
                    ):
                        if e.id is not None:
                            matched_exams_dict[e.id] = e
            except (ValueError, TypeError):
                pass

        return list(matched_exams_dict.values())

    async def get_matching_canonical_exam(
        self,
        code: Optional[str] = None,
        year: Optional[int] = None,
        stage: Optional[str] = None,
        subject_code: Optional[str] = None,
        paper_set_code: Optional[str] = None,
    ) -> Optional[Exam]:
        """
        Finds a primary existing exam by code, code aliases, or composite key.
        """
        matches = await self.get_all_matching_canonical_exams(
            code=code,
            year=year,
            stage=stage,
            subject_code=subject_code,
            paper_set_code=paper_set_code,
        )
        return matches[0] if matches else None

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

    async def delete(self, exam: Exam) -> None:
        await self.session.delete(exam)
        await self.session.commit()
