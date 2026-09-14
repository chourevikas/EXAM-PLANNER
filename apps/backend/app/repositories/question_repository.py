from typing import Optional, List, Tuple, Union
from sqlmodel import select, func, or_, and_, not_, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    Question,
    QuestionStatus,
    QuestionSourceType,
    DifficultyLevel,
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
        exam_year: Optional[Union[int, str]] = None,
        paper_set_code: Optional[str] = None,
        stage: Optional[str] = None,
        status: Optional[QuestionStatus] = None,
        difficulty: Optional[str] = None,
        exclude_ids: Optional[str] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> Tuple[List[Question], int]:
        """
        Executes multi-filtered query across questions, hierarchy, and exams.
        Supports filtering by IDs, names, codes, year, stage, difficulty, and fuzzy exam name match.
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
            years = []
            if isinstance(exam_year, int):
                years = [exam_year]
            elif isinstance(exam_year, str):
                import re
                years = [int(y) for y in re.findall(r"\b(19\d\d|20\d\d)\b", exam_year)]
            if len(years) == 1:
                id_stmt = id_stmt.where(or_(Question.source_year == years[0], Exam.source_year == years[0]))
            elif len(years) > 1:
                id_stmt = id_stmt.where(or_(Question.source_year.in_(years), Exam.source_year.in_(years)))
        if exam_type:
            id_stmt = id_stmt.where(Exam.exam_type == exam_type)
        if stage:
            id_stmt = id_stmt.where(func.lower(Exam.stage) == stage.lower())
        if exam_name and exam_name.strip():
            exam_tokens = [
                e.strip().lower()
                for e in exam_name.split(",")
                if e.strip() and e.strip().lower() not in ("all", "all exams", "all levels")
            ]
            if exam_tokens:
                exam_clauses = [
                    or_(
                        func.lower(Exam.name).contains(tok),
                        func.lower(Exam.code).contains(tok),
                    )
                    for tok in exam_tokens
                ]
                id_stmt = id_stmt.where(or_(*exam_clauses))
        if difficulty and difficulty.strip() and difficulty.strip().lower() not in ("all", "all levels", "all difficulties"):
            diff_clean = difficulty.strip().upper()
            if diff_clean in DifficultyLevel.__members__:
                id_stmt = id_stmt.where(Question.difficulty == DifficultyLevel[diff_clean])
            else:
                from sqlalchemy import String, cast
                id_stmt = id_stmt.where(cast(Question.difficulty, String).ilike(diff_clean))

        # Hierarchy Filters with cross-level taxonomy matching (supports comma and ';;' / '||' separated multi-select)
        if subject_id:
            id_stmt = id_stmt.where(or_(QuestionHierarchyLink.subject_id == subject_id, Subject.id == subject_id))
        if subject_name and subject_name.strip():
            raw_s_items = subject_name.replace("||", ";;").split(";;") if (";;" in subject_name or "||" in subject_name) else [subject_name]
            s_list = []
            for item in raw_s_items:
                for sub_item in item.split(","):
                    c = sub_item.strip().lower()
                    if c and c not in ("all subjects", "all", "all topics", "all topics/subjects", "all topics and subjects") and c not in s_list:
                        s_list.append(c)
                c_full = item.strip().lower()
                if c_full and "," in c_full and c_full not in s_list and c_full not in ("all subjects", "all"):
                    s_list.append(c_full)
            if s_list:
                s_clauses = [
                    or_(
                        func.lower(Subject.name) == clean_s,
                        func.lower(Subject.name).contains(clean_s),
                        func.lower(Subject.code) == clean_s,
                        func.lower(Question.section_code) == clean_s,
                        func.lower(Question.section_code).contains(clean_s),
                    )
                    for clean_s in s_list
                ]
                id_stmt = id_stmt.where(or_(*s_clauses))
        if subject_code:
            id_stmt = id_stmt.where(func.lower(Subject.code) == subject_code.lower())

        if topic_id:
            id_stmt = id_stmt.where(or_(QuestionHierarchyLink.topic_id == topic_id, Topic.id == topic_id))
        if topic_name and topic_name.strip():
            raw_t_items = topic_name.replace("||", ";;").split(";;") if (";;" in topic_name or "||" in topic_name) else [topic_name]
            t_list = []
            for item in raw_t_items:
                for sub_item in item.split(","):
                    c = sub_item.strip().lower()
                    if c and c not in ("all topics", "all", "all subjects", "all topics/subjects", "all topics and subjects") and c not in t_list:
                        t_list.append(c)
                c_full = item.strip().lower()
                if c_full and "," in c_full and c_full not in t_list and c_full not in ("all topics", "all"):
                    t_list.append(c_full)
            if t_list:
                t_clauses = [
                    or_(
                        func.lower(Topic.name) == clean_t,
                        func.lower(Topic.name).contains(clean_t),
                        func.lower(Topic.code) == clean_t,
                        func.lower(QuestionHierarchyLink.concept_name) == clean_t,
                        func.lower(QuestionHierarchyLink.concept_name).contains(clean_t),
                    )
                    for clean_t in t_list
                ]
                id_stmt = id_stmt.where(or_(*t_clauses))
        if topic_code:
            id_stmt = id_stmt.where(func.lower(Topic.code) == topic_code.lower())

        if subtopic_id:
            id_stmt = id_stmt.where(or_(Question.subtopic_id == subtopic_id, QuestionHierarchyLink.subtopic_id == subtopic_id))
        if subtopic_name and subtopic_name.strip():
            raw_st_items = subtopic_name.replace("||", ";;").split(";;") if (";;" in subtopic_name or "||" in subtopic_name) else [subtopic_name]
            st_list = []
            for item in raw_st_items:
                for sub_item in item.split(","):
                    c = sub_item.strip().lower()
                    if c and c not in ("all subtopics", "all") and c not in st_list:
                        st_list.append(c)
                c_full = item.strip().lower()
                if c_full and "," in c_full and c_full not in st_list and c_full not in ("all subtopics", "all"):
                    st_list.append(c_full)
            if st_list:
                st_clauses = []
                st_stop_words = ("and", "the", "for", "all", "of", "in", "to")
                for clean_st in st_list:
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
                        st_clauses.append(or_(subtopic_match, st_token_match))
                    else:
                        st_clauses.append(subtopic_match)
                if st_clauses:
                    id_stmt = id_stmt.where(or_(*st_clauses))
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

