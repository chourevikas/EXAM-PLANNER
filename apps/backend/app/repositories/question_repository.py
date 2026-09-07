from typing import Optional, List, Tuple
from sqlmodel import select, func, or_, and_, not_, col
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

    async def get_by_id(self, question_id: int | str) -> Optional[Question]:
        try:
            q_id = int(question_id)
        except (ValueError, TypeError):
            return None
        return await self.session.get(Question, q_id)

    async def list_questions_filtered(
        self,
        subject_id: Optional[int] = None,
        subject_name: Optional[str] = None,
        subject_code: Optional[str] = None,
        topic_id: Optional[int] = None,
        topic_name: Optional[str] = None,
        topic_code: Optional[str] = None,
        subtopic_id: Optional[int] = None,
        subtopic_name: Optional[str] = None,
        subtopic_code: Optional[str] = None,
        exam_id: Optional[int] = None,
        exam_name: Optional[str] = None,
        exam_type: Optional[QuestionSourceType] = None,
        exam_year: Optional[int] = None,
        paper_set_code: Optional[str] = None,
        stage: Optional[str] = None,
        status: Optional[QuestionStatus] = None,
        exclude_ids: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Question], int]:
        """
        Executes multi-filtered query across questions, hierarchy, and exams.
        Supports filtering by IDs, names, codes, year, stage, and fuzzy exam name match.
        Returns tuple of (questions_list, total_count).
        """
        # Base ID query to avoid PostgreSQL DISTINCT on JSON columns while supporting ORDER BY question_number_in_paper
        id_stmt = select(Question.id, Question.question_number_in_paper).outerjoin(Exam, Question.exam_id == Exam.id)

        # Needs hierarchy join if subject/topic/subtopic filters are applied
        needs_hierarchy = any([
            subject_id, subject_name, subject_code,
            topic_id, topic_name, topic_code,
            subtopic_id, subtopic_name, subtopic_code
        ])

        if needs_hierarchy:
            id_stmt = id_stmt.outerjoin(QuestionHierarchyLink, Question.id == QuestionHierarchyLink.question_id)
            id_stmt = id_stmt.outerjoin(Subtopic, or_(Question.subtopic_id == Subtopic.id, QuestionHierarchyLink.subtopic_id == Subtopic.id))
            id_stmt = id_stmt.outerjoin(Topic, or_(QuestionHierarchyLink.topic_id == Topic.id, Subtopic.topic_id == Topic.id))
            id_stmt = id_stmt.outerjoin(Subject, or_(QuestionHierarchyLink.subject_id == Subject.id, Topic.subject_id == Subject.id))

        # Exclude IDs filter
        if exclude_ids:
            raw_ids = [i.strip() for i in exclude_ids.split(",") if i.strip()]
            valid_targets = []
            for r in raw_ids:
                try:
                    valid_targets.append(int(r))
                except Exception:
                    pass
            if valid_targets:
                id_stmt = id_stmt.where(not_(Question.id.in_(valid_targets)))

        # Filters
        if exam_id:
            id_stmt = id_stmt.where(or_(Question.exam_id == exam_id, Exam.id == exam_id))
        if status:
            id_stmt = id_stmt.where(Question.status == status)
        if paper_set_code:
            id_stmt = id_stmt.where(func.lower(Question.paper_set_code) == paper_set_code.lower())
        if exam_year:
            id_stmt = id_stmt.where(or_(Question.source_year == exam_year, Exam.source_year == exam_year))
        if exam_type:
            id_stmt = id_stmt.where(Exam.exam_type == exam_type)
        if stage:
            id_stmt = id_stmt.where(func.lower(Exam.stage) == stage.lower())
        if exam_name:
            id_stmt = id_stmt.where(func.lower(Exam.name).contains(exam_name.lower()))

        # Hierarchy Filters with cross-level taxonomy matching
        if subject_id:
            id_stmt = id_stmt.where(or_(QuestionHierarchyLink.subject_id == subject_id, Subject.id == subject_id))
        if subject_name and subject_name.strip().lower() not in ("all subjects", "all", "all topics", "all topics/subjects", "all topics and subjects") and subject_name.strip():
            clean_s = subject_name.strip().lower()
            id_stmt = id_stmt.where(or_(
                func.lower(Subject.name) == clean_s,
                func.lower(Subject.code) == clean_s,
                func.lower(Question.section_code) == clean_s,
            ))
        if subject_code:
            id_stmt = id_stmt.where(func.lower(Subject.code) == subject_code.lower())

        if topic_id:
            id_stmt = id_stmt.where(or_(QuestionHierarchyLink.topic_id == topic_id, Topic.id == topic_id))
        if topic_name and topic_name.strip().lower() not in ("all topics", "all", "all subjects", "all topics/subjects", "all topics and subjects") and topic_name.strip():
            clean_t = topic_name.strip().lower()
            id_stmt = id_stmt.where(or_(
                func.lower(Topic.name) == clean_t,
                func.lower(Topic.code) == clean_t,
                func.lower(QuestionHierarchyLink.concept_name) == clean_t,
            ))
        if topic_code:
            id_stmt = id_stmt.where(func.lower(Topic.code) == topic_code.lower())

        if subtopic_id:
            id_stmt = id_stmt.where(or_(Question.subtopic_id == subtopic_id, QuestionHierarchyLink.subtopic_id == subtopic_id))
        if subtopic_name and subtopic_name != "All Subtopics" and subtopic_name.strip():
            clean_st = subtopic_name.strip().lower()
            st_stop_words = ("and", "the", "for", "all", "of", "in", "to")
            st_tokens = [t for t in clean_st.replace("&", " ").replace("-", " ").split() if len(t) > 2 and t not in st_stop_words]
            
            subtopic_match = or_(
                func.lower(Subtopic.name).contains(clean_st),
                func.lower(QuestionHierarchyLink.concept_name).contains(clean_st),
            )
            if len(st_tokens) > 1:
                st_token_match = and_(*[
                    or_(
                        func.lower(Subtopic.name).contains(tok),
                        func.lower(QuestionHierarchyLink.concept_name).contains(tok),
                    )
                    for tok in st_tokens
                ])
                id_stmt = id_stmt.where(or_(subtopic_match, st_token_match))
            else:
                id_stmt = id_stmt.where(subtopic_match)
        if subtopic_code:
            id_stmt = id_stmt.where(func.lower(Subtopic.code) == subtopic_code.lower())

        # Distinct question IDs matching all criteria
        id_stmt = id_stmt.distinct()

        # Paginate IDs first to avoid materializing large JSON/text columns across all matching rows
        id_page_stmt = id_stmt.order_by(col(Question.question_number_in_paper)).offset(skip).limit(limit)
        id_res = await self.session.exec(id_page_stmt)
        raw_rows = id_res.all()
        q_ids = [r[0] for r in raw_rows] if raw_rows else []

        if not q_ids:
            if skip > 0:
                count_stmt = select(func.count()).select_from(id_stmt.subquery())
                total_res = await self.session.exec(count_stmt)
                total = total_res.one() or 0
                return [], total
            return [], 0

        # Fetch the exact page of Question objects by IDs
        q_stmt = select(Question).where(col(Question.id).in_(q_ids)).order_by(col(Question.question_number_in_paper))
        res = await self.session.exec(q_stmt)
        questions = list(res.all())

        # Fast-path total count: if on page 1 and fewer results than limit, total count is exact
        if skip == 0 and len(q_ids) < limit:
            total = len(q_ids)
        else:
            count_stmt = select(func.count()).select_from(id_stmt.subquery())
            total_res = await self.session.exec(count_stmt)
            total = total_res.one() or 0

        return questions, total

