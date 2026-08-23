import uuid
from typing import Optional, List, Tuple
from sqlmodel import select, func, col, or_
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Question,
    QuestionStatus,
    QuestionSourceType,
    Exam,
    Subject,
    Topic,
    Subtopic,
    QuestionHierarchyLink,
)


class QuestionRepository:
    """Repository handling database queries for Question entities with multi-filtering."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, question_id: uuid.UUID | str) -> Optional[Question]:
        q_uuid = uuid.UUID(str(question_id)) if not isinstance(question_id, uuid.UUID) else question_id
        return await self.session.get(Question, q_uuid)

    async def list_questions_filtered(
        self,
        subject_id: Optional[uuid.UUID] = None,
        subject_name: Optional[str] = None,
        subject_code: Optional[str] = None,
        topic_id: Optional[uuid.UUID] = None,
        topic_name: Optional[str] = None,
        topic_code: Optional[str] = None,
        subtopic_id: Optional[uuid.UUID] = None,
        subtopic_name: Optional[str] = None,
        subtopic_code: Optional[str] = None,
        exam_id: Optional[uuid.UUID] = None,
        exam_name: Optional[str] = None,
        exam_type: Optional[QuestionSourceType] = None,
        exam_year: Optional[int] = None,
        paper_set_code: Optional[str] = None,
        stage: Optional[str] = None,
        status: Optional[QuestionStatus] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Question], int]:
        """
        Executes multi-filtered query across questions, hierarchy, and exams.
        Supports filtering by IDs, names, codes, year, stage, and fuzzy exam name match.
        Returns tuple of (questions_list, total_count).
        """
        stmt = select(Question).outerjoin(Exam, Question.exam_id == Exam.id)

        # Needs hierarchy join if subject/topic/subtopic filters are applied
        needs_hierarchy = any([
            subject_id, subject_name, subject_code,
            topic_id, topic_name, topic_code,
            subtopic_id, subtopic_name, subtopic_code
        ])

        if needs_hierarchy:
            stmt = stmt.outerjoin(QuestionHierarchyLink, Question.id == QuestionHierarchyLink.question_id)
            stmt = stmt.outerjoin(Subtopic, or_(Question.subtopic_id == Subtopic.id, QuestionHierarchyLink.subtopic_id == Subtopic.id))
            stmt = stmt.outerjoin(Topic, or_(QuestionHierarchyLink.topic_id == Topic.id, Subtopic.topic_id == Topic.id))
            stmt = stmt.outerjoin(Subject, or_(QuestionHierarchyLink.subject_id == Subject.id, Topic.subject_id == Subject.id))

        # Filters
        if exam_id:
            stmt = stmt.where(or_(Question.exam_id == exam_id, Exam.id == exam_id))
        if status:
            stmt = stmt.where(Question.status == status)
        if paper_set_code:
            stmt = stmt.where(func.lower(Question.paper_set_code) == paper_set_code.lower())
        if exam_year:
            stmt = stmt.where(or_(Question.source_year == exam_year, Exam.source_year == exam_year))
        if exam_type:
            stmt = stmt.where(Exam.exam_type == exam_type)
        if stage:
            stmt = stmt.where(func.lower(Exam.stage) == stage.lower())
        if exam_name:
            stmt = stmt.where(func.lower(Exam.name).contains(exam_name.lower()))

        # Hierarchy Filters with cross-level taxonomy matching
        if subject_id:
            stmt = stmt.where(or_(QuestionHierarchyLink.subject_id == subject_id, Subject.id == subject_id))
        if subject_name and subject_name != "All Subjects" and subject_name.strip():
            clean_s = subject_name.strip().lower()
            stmt = stmt.where(or_(
                func.lower(Subject.name).contains(clean_s),
                func.lower(Question.section_code).contains(clean_s)
            ))
        if subject_code:
            stmt = stmt.where(func.lower(Subject.code) == subject_code.lower())

        if topic_id:
            stmt = stmt.where(or_(QuestionHierarchyLink.topic_id == topic_id, Topic.id == topic_id))
        if topic_name and topic_name != "All Topics" and topic_name.strip():
            clean_t = topic_name.strip().lower()
            stmt = stmt.where(or_(
                func.lower(Topic.name).contains(clean_t),
                func.lower(Question.section_code).contains(clean_t),
                func.lower(QuestionHierarchyLink.concept_name).contains(clean_t)
            ))
        if topic_code:
            stmt = stmt.where(func.lower(Topic.code) == topic_code.lower())

        if subtopic_id:
            stmt = stmt.where(or_(Question.subtopic_id == subtopic_id, QuestionHierarchyLink.subtopic_id == subtopic_id))
        if subtopic_name and subtopic_name != "All Subtopics" and subtopic_name.strip():
            clean_st = subtopic_name.strip().lower()
            stmt = stmt.where(or_(
                func.lower(Subtopic.name).contains(clean_st),
                func.lower(QuestionHierarchyLink.concept_name).contains(clean_st)
            ))
        if subtopic_code:
            stmt = stmt.where(func.lower(Subtopic.code) == subtopic_code.lower())


        # Unique questions only
        stmt = stmt.distinct()

        # Count total matches
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await self.session.exec(count_stmt)
        total = total_res.one() or 0

        # Pagination & Ordering based on question_number_in_paper
        stmt = stmt.order_by(Question.question_number_in_paper).offset(skip).limit(limit)
        res = await self.session.exec(stmt)
        questions = res.all()

        return questions, total
