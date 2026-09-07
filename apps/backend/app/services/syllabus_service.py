import logging
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func
from fastapi import HTTPException

from app.db.models import (
    Exam,
    SyllabusVersion,
    Subject,
    Topic,
    Subtopic,
    Question,
    QuestionTranslation,
    QuestionOption,
    QuestionExplanation,
    QuestionMetadata,
    LanguageCode,
    QuestionStatus,
)
from app.schemas.syllabus import (
    CompleteSyllabusResponse,
    SyllabusSubjectItem,
    SyllabusTopicItem,
    SyllabusSubtopicItem,
)
from app.schemas.question_integrity import (
    ExamIntegrityQuestionsResponse,
    QuestionIssueDetail,
)
from app.schemas.exam_year import (
    ExamYearItem,
    ExamsByYearResponse,
)
from app.schemas.syllabus_literals import (
    SYLLABUS_HIERARCHY,
    get_complete_master_syllabus,
    verify_syllabus_node,
    is_valid_subject,
    is_valid_topic,
    is_valid_subtopic,
)

logger = logging.getLogger("SyllabusService")


class SyllabusService:
    """Service handling Syllabus Hierarchy, Exam Verification, Question Integrity Analytics & Exams by Year."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_complete_syllabus(
        self, exam_id: Optional[int] = None
    ) -> CompleteSyllabusResponse:
        """
        Returns the complete Subject -> Topic -> Subtopic syllabus tree dynamically queried from the database.
        If exam_id is provided, returns the hierarchy for that exam's SyllabusVersion.
        If exam_id is None, aggregates across all subjects, topics, and subtopics in DB.
        """
        syl_ver = None
        exam = None

        if exam_id:
            exam = await self.session.get(Exam, exam_id)
            if exam:
                stmt_syl = (
                    select(SyllabusVersion)
                    .where(SyllabusVersion.exam_id == exam_id)
                    .order_by(SyllabusVersion.effective_from.desc())
                )
                syl_ver = (await self.session.exec(stmt_syl)).first()

        LEGACY_EMPTY_SUBJECTS = {
            "history",
            "science & technology",
            "ecology & environment",
            "indian polity & governance",
            "general science",
            "indian culture",
        }

        # Query subjects linked to actual questions in the pipeline
        active_subject_ids_stmt = (
            select(Topic.subject_id)
            .join(Subtopic, Subtopic.topic_id == Topic.id)
            .join(Question, Question.subtopic_id == Subtopic.id)
            .distinct()
        )

        if syl_ver:
            subj_stmt = (
                select(Subject)
                .where(Subject.version_id == syl_ver.id)
                .where(Subject.id.in_(active_subject_ids_stmt))
                .order_by(Subject.display_order, Subject.name)
            )
            db_subjects = list((await self.session.exec(subj_stmt)).all())
        else:
            subj_stmt = (
                select(Subject)
                .where(Subject.id.in_(active_subject_ids_stmt))
                .order_by(Subject.display_order, Subject.name)
            )
            db_subjects = list((await self.session.exec(subj_stmt)).all())

        if not db_subjects:
            fallback_stmt = select(Subject).order_by(Subject.display_order, Subject.name)
            all_s = list((await self.session.exec(fallback_stmt)).all())
            db_subjects = [s for s in all_s if s.name and s.name.strip().lower() not in LEGACY_EMPTY_SUBJECTS]

        # If database has no subjects at all, fall back to master syllabus literals
        if not db_subjects:
            master = get_complete_master_syllabus()
            if exam_id:
                master["exam_id"] = str(exam_id)
            return CompleteSyllabusResponse(**master)

        subj_ids = [s.id for s in db_subjects if s.id is not None]
        if subj_ids:
            top_stmt = (
                select(Topic)
                .where(Topic.subject_id.in_(subj_ids))
                .order_by(Topic.display_order, Topic.name)
            )
            db_topics = list((await self.session.exec(top_stmt)).all())
        else:
            db_topics = []

        top_ids = [t.id for t in db_topics if t.id is not None]
        if top_ids:
            subtop_stmt = (
                select(Subtopic)
                .where(Subtopic.topic_id.in_(top_ids))
                .order_by(Subtopic.display_order, Subtopic.name)
            )
            db_subtopics = list((await self.session.exec(subtop_stmt)).all())
        else:
            db_subtopics = []

        # Group subtopics by topic_id
        subtopics_by_topic: Dict[int, List[Subtopic]] = {}
        for st in db_subtopics:
            if st.topic_id is not None:
                subtopics_by_topic.setdefault(st.topic_id, []).append(st)

        # Group topics by subject_id
        topics_by_subject: Dict[int, List[Topic]] = {}
        for t in db_topics:
            if t.subject_id is not None:
                topics_by_subject.setdefault(t.subject_id, []).append(t)

        # Deduplicate / aggregate by subject name
        seen_subjects: Dict[str, SyllabusSubjectItem] = {}
        hierarchy: Dict[str, Dict[str, List[str]]] = {}
        flat_hierarchy: Dict[str, List[str]] = {}
        all_topics_set = set()
        all_subtopics_set = set()

        for s in db_subjects:
            s_name = (s.name or "General Studies").strip()
            s_key = s_name.lower()

            if s_name not in hierarchy:
                hierarchy[s_name] = {}
            if s_name not in flat_hierarchy:
                flat_hierarchy[s_name] = []

            cur_topics = topics_by_subject.get(s.id, [])
            built_topics: List[SyllabusTopicItem] = []

            for t in cur_topics:
                t_name = (t.name or s_name).strip()
                all_topics_set.add(t_name)
                if t_name not in hierarchy[s_name]:
                    hierarchy[s_name][t_name] = []

                cur_subtopics = subtopics_by_topic.get(t.id, [])
                built_subtopics: List[SyllabusSubtopicItem] = []

                for st in cur_subtopics:
                    st_name = (st.name or t_name).strip()
                    all_subtopics_set.add(st_name)
                    if st_name not in hierarchy[s_name][t_name]:
                        hierarchy[s_name][t_name].append(st_name)
                    if st_name not in flat_hierarchy[s_name]:
                        flat_hierarchy[s_name].append(st_name)

                    built_subtopics.append(
                        SyllabusSubtopicItem(
                            id=str(st.id) if st.id is not None else None,
                            name=st_name,
                            code=st.code or st_name[:10].upper().replace(" ", "_"),
                            display_order=st.display_order or 1,
                            pyq_frequency=st.pyq_frequency or 0,
                        )
                    )

                built_topics.append(
                    SyllabusTopicItem(
                        id=str(t.id) if t.id is not None else None,
                        name=t_name,
                        code=t.code or t_name[:10].upper().replace(" ", "_"),
                        display_order=t.display_order or 1,
                        subtopics_count=len(built_subtopics),
                        subtopics=built_subtopics,
                    )
                )

            if s_key not in seen_subjects:
                seen_subjects[s_key] = SyllabusSubjectItem(
                    id=str(s.id) if s.id is not None else None,
                    name=s_name,
                    code=s.code or s_name[:10].upper().replace(" ", "_"),
                    display_order=s.display_order or 1,
                    topics_count=len(built_topics),
                    subtopics_count=sum(len(t.subtopics) for t in built_topics),
                    topics=built_topics,
                )
            else:
                existing_s = seen_subjects[s_key]
                existing_top_names = {t.name.lower(): t for t in existing_s.topics}
                for nt in built_topics:
                    if nt.name.lower() not in existing_top_names:
                        existing_s.topics.append(nt)
                    else:
                        ext_t = existing_top_names[nt.name.lower()]
                        ext_sub_names = {st.name.lower() for st in ext_t.subtopics}
                        for nst in nt.subtopics:
                            if nst.name.lower() not in ext_sub_names:
                                ext_t.subtopics.append(nst)
                        ext_t.subtopics_count = len(ext_t.subtopics)
                existing_s.topics_count = len(existing_s.topics)
                existing_s.subtopics_count = sum(len(t.subtopics) for t in existing_s.topics)

        subjects_list = [s.name for s in seen_subjects.values()]
        topics_list = sorted(list(all_topics_set))
        subtopics_list = sorted(list(all_subtopics_set))

        version_code = syl_ver.version_code if syl_ver and syl_ver.version_code else "UPSC_PRELIMS_DB_V1"
        title = syl_ver.title if syl_ver and syl_ver.title else (f"{exam.name} Syllabus" if exam else "UPSC Master Database Syllabus")

        return CompleteSyllabusResponse(
            version_code=version_code,
            title=title,
            syllabus_version_id=str(syl_ver.id) if syl_ver else None,
            exam_id=str(exam_id) if exam_id else None,
            total_subjects=len(subjects_list),
            total_topics=len(topics_list),
            total_subtopics=len(subtopics_list),
            subjects=list(seen_subjects.values()),
            hierarchy=hierarchy,
            flat_hierarchy=flat_hierarchy,
            subjects_list=subjects_list,
            topics_list=topics_list,
            subtopics_list=subtopics_list,
        )

    async def sync_or_create_exam_syllabus(
        self, exam_id: int
    ) -> SyllabusVersion:
        """
        Ensures a SyllabusVersion and canonical DB entries exist for exam_id.
        Creates Subject, Topic, Subtopic rows under SyllabusVersion if not present.
        """
        stmt_syl = select(SyllabusVersion).where(SyllabusVersion.exam_id == exam_id)
        syl_ver = (await self.session.exec(stmt_syl)).first()

        if not syl_ver:
            syl_ver = SyllabusVersion(
                exam_id=exam_id,
                title="UPSC Prelims Master Syllabus (GS Micro-Topics)",
                version_code="UPSC_PRELIMS_MASTER_V1",
                is_active=True,
            )
            self.session.add(syl_ver)
            await self.session.flush()

        # Check existing subjects for this version
        subj_stmt = select(Subject).where(Subject.version_id == syl_ver.id)
        existing_subjects = {
            s.name.strip().lower(): s for s in (await self.session.exec(subj_stmt)).all()
        }

        top_stmt = (
            select(Topic).where(Topic.subject_id.in_([s.id for s in existing_subjects.values()]))
            if existing_subjects
            else None
        )
        existing_topics = (
            {t.name.strip().lower(): t for t in (await self.session.exec(top_stmt)).all()}
            if top_stmt is not None
            else {}
        )

        subtop_stmt = (
            select(Subtopic).where(Subtopic.topic_id.in_([t.id for t in existing_topics.values()]))
            if existing_topics
            else None
        )
        existing_subtopics = (
            {st.name.strip().lower(): st for st in (await self.session.exec(subtop_stmt)).all()}
            if subtop_stmt is not None
            else {}
        )

        s_order = len(existing_subjects) + 1
        t_order = len(existing_topics) + 1
        st_order = 1

        for subject_name, topics_dict in SYLLABUS_HIERARCHY.items():
            s_key = subject_name.strip().lower()
            subject = existing_subjects.get(s_key)
            if not subject:
                code_s = subject_name.strip().upper().replace(" ", "_").replace("&", "AND")[:20]
                subject = Subject(
                    version_id=syl_ver.id,
                    name=subject_name.strip(),
                    code=code_s,
                    display_order=s_order,
                )
                self.session.add(subject)
                await self.session.flush()
                existing_subjects[s_key] = subject
                s_order += 1

            for topic_name, subtopics_list in topics_dict.items():
                t_key = topic_name.strip().lower()
                topic = existing_topics.get(t_key)
                if not topic:
                    code_t = topic_name.strip().upper().replace(" ", "_").replace("&", "AND")[:50]
                    topic = Topic(
                        subject_id=subject.id,
                        name=topic_name.strip(),
                        code=code_t,
                        display_order=t_order,
                    )
                    self.session.add(topic)
                    await self.session.flush()
                    existing_topics[t_key] = topic
                    t_order += 1

                for subtopic_name in subtopics_list:
                    st_key = subtopic_name.strip().lower()
                    subtopic = existing_subtopics.get(st_key)
                    if not subtopic:
                        code_st = subtopic_name.strip().upper().replace(" ", "_").replace("&", "AND")[:50]
                        subtopic = Subtopic(
                            topic_id=topic.id,
                            name=subtopic_name.strip(),
                            code=code_st,
                            display_order=st_order,
                            pyq_frequency=0,
                        )
                        self.session.add(subtopic)
                        existing_subtopics[st_key] = subtopic
                        st_order += 1

        await self.session.commit()
        await self.session.refresh(syl_ver)
        return syl_ver

    async def evaluate_and_persist_question_integrity(
        self, question: Question
    ) -> Tuple[str, List[str]]:
        """
        Evaluates the integrity of a question record after explanation generation or admin updates.
        Updates question.integrity_status and question.integrity_reasons_json directly in the database.
        """
        # Fetch translations
        t_stmt = select(QuestionTranslation).where(QuestionTranslation.question_id == question.id)
        trans_list = (await self.session.exec(t_stmt)).all()
        default_trans = next(
            (t for t in trans_list if t.language == LanguageCode.ENGLISH),
            (trans_list[0] if trans_list else None),
        )
        has_statement = bool(default_trans and default_trans.question_text and default_trans.question_text.strip())

        # Fetch options
        o_stmt = select(QuestionOption).where(QuestionOption.question_id == question.id)
        opts = (await self.session.exec(o_stmt)).all()
        has_options = len(opts) > 0
        correct_opts = [o for o in opts if o.is_correct]
        has_correct_option = len(correct_opts) == 1

        # Fetch explanation
        e_stmt = select(QuestionExplanation).where(QuestionExplanation.question_id == question.id)
        expl = (await self.session.exec(e_stmt)).first()
        has_explanation = bool(expl and expl.detailed_solution and expl.detailed_solution.strip())

        # Fetch syllabus
        has_valid_syllabus = False
        subj_name, top_name, subtop_name = None, None, None
        if question.subtopic_id:
            st_stmt = (
                select(Subtopic, Topic, Subject)
                .join(Topic, Subtopic.topic_id == Topic.id)
                .join(Subject, Topic.subject_id == Subject.id)
                .where(Subtopic.id == question.subtopic_id)
            )
            res = (await self.session.exec(st_stmt)).first()
            if res:
                st, top, subj = res
                subj_name, top_name, subtop_name = subj.name, top.name, st.name
                has_valid_syllabus = bool(
                    subj_name
                    and top_name
                    and is_valid_subject(subj_name)
                    and is_valid_topic(top_name, subj_name)
                    and (not subtop_name or is_valid_subtopic(subtop_name, top_name, subj_name))
                )

        issues: List[str] = []
        if not has_statement:
            issues.append("Question statement text is missing or blank in database.")
        if not has_options:
            issues.append("0 answer options configured in database.")
        elif len(opts) < 2:
            issues.append(f"Incomplete options count ({len(opts)} options found).")

        if len(correct_opts) == 0:
            issues.append("No correct answer option configured / mapped from answer key.")
        elif len(correct_opts) > 1:
            labels = [o.option_label for o in correct_opts]
            issues.append(f"Multiple correct options configured: {labels}.")

        if not has_explanation:
            issues.append("Detailed solution explanation is missing in database.")

        if not has_valid_syllabus:
            if not subj_name:
                issues.append("No syllabus hierarchy link attached to question.")
            else:
                issues.append(f"Non-canonical syllabus attached (Subject: '{subj_name}', Topic: '{top_name}', Subtopic: '{subtop_name}').")

        # Categorize
        if not has_statement or not has_options:
            category = "CORRUPTED"
        elif not has_correct_option or not has_explanation or not has_valid_syllabus or not question.is_complete or issues:
            category = "PARTIALLY_CORRUPTED"
        else:
            category = "VALID"

        # Update columns on Question model if present
        if hasattr(question, "validation_status"):
            question.validation_status = category
        if hasattr(question, "validation_issues_json"):
            question.validation_issues_json = issues
        if question.status == QuestionStatus.PENDING_HUMAN_REVIEW or category != "VALID":
            question.requires_human_review = True

        self.session.add(question)
        await self.session.commit()
        await self.session.refresh(question)
        object.__setattr__(question, "integrity_status", category)
        object.__setattr__(question, "integrity_reasons_json", issues)
        return category, issues

    async def get_exam_question_integrity(
        self,
        exam_id: int,
        issue_type: Optional[str] = None,
        page: int = 1,
        limit: int = 250,
        language: LanguageCode = LanguageCode.ENGLISH,
    ) -> ExamIntegrityQuestionsResponse:
        """
        Fast evaluation of question integrity and missing questions across an entire exam.
        Uses a consolidated SQL query to avoid sequential multi-table round trips.
        """
        exam = await self.session.get(Exam, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        lang_str = language.value if hasattr(language, "value") else str(language)

        # 1. Fetch questions, option counts, correct option count, statement preview, and syllabus hierarchy in ONE round trip
        sql = text("""
            SELECT 
                q.id,
                q.question_number_in_paper,
                q.status,
                q.difficulty,
                q.is_complete,
                q.requires_human_review,
                (
                    SELECT SUBSTR(qt.question_text, 1, 120) 
                    FROM question_translations qt 
                    WHERE qt.question_id = q.id 
                    ORDER BY CASE WHEN qt.language = :lang THEN 0 ELSE 1 END 
                    LIMIT 1
                ) AS text_preview,
                COUNT(qo.id) AS options_count,
                SUM(CASE WHEN qo.is_correct THEN 1 ELSE 0 END) AS correct_options_count,
                MIN(CASE WHEN qo.is_correct THEN qo.option_label ELSE NULL END) AS correct_option_label,
                s.name AS subject_name,
                t.name AS topic_name,
                st.name AS subtopic_name
            FROM questions q
            LEFT JOIN question_options qo ON qo.question_id = q.id
            LEFT JOIN subtopics st ON q.subtopic_id = st.id
            LEFT JOIN topics t ON st.topic_id = t.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            WHERE q.exam_id = :exam_id
            GROUP BY q.id, q.question_number_in_paper, q.status, q.difficulty, q.is_complete, q.requires_human_review, s.name, t.name, st.name
            ORDER BY q.question_number_in_paper ASC;
        """)
        res = await self.session.execute(sql, {"exam_id": exam_id, "lang": lang_str})
        q_rows = res.fetchall()

        q_by_num = {r.question_number_in_paper: r for r in q_rows}
        total_extracted = len(q_rows)
        total_expected = max(exam.total_questions or 100, max(q_by_num.keys()) if q_by_num else 100)

        # Check if exam is actively undergoing extraction
        from app.db.models.pipeline_run import PipelineRun
        from app.services.task_registry import task_registry

        status_str = exam.status.value if hasattr(exam.status, "value") else str(exam.status)
        p1_res = await self.session.execute(
            select(PipelineRun).where(
                PipelineRun.exam_id == exam_id,
                PipelineRun.pipeline_type.in_(("QUESTION_EXTRACTION", "DOCUMENT_EXTRACTION"))
            ).order_by(PipelineRun.id.desc())
        )
        p1_run = p1_res.scalars().first()
        is_extracting = False
        if task_registry.is_running(str(exam_id)) or task_registry.is_running(f"qp_{exam_id}"):
            is_extracting = True
        elif p1_run and str(p1_run.status).upper() in ("RUNNING", "PROCESSING", "INITIALIZING"):
            is_extracting = True
        elif status_str in ("PROCESSING", "PARSING_PDF", "EXTRACTING"):
            is_extracting = True

        # 2. Build integrity items for each question number from 1 to total_expected
        all_issue_items: List[QuestionIssueDetail] = []
        corrupted_count = 0
        partially_corrupted_count = 0
        missing_count = 0
        valid_count = 0
        missing_numbers: List[int] = []

        for q_num in range(1, total_expected + 1):
            r = q_by_num.get(q_num)

            if not r:
                # If the paper is currently undergoing extraction, do not treat unextracted slots as missing
                if is_extracting:
                    continue
                missing_count += 1
                missing_numbers.append(q_num)
                all_issue_items.append(
                    QuestionIssueDetail(
                        question_id=None,
                        question_number_in_paper=q_num,
                        status="MISSING",
                        issue_category="MISSING_IN_PAPER",
                        issues=[f"Question #{q_num} was not extracted from paper / missing in database."],
                        has_statement=False,
                        has_options=False,
                        has_correct_option=False,
                        has_explanation=False,
                        has_valid_syllabus=False,
                        subject=None,
                        topic=None,
                        subtopic=None,
                        question_text_preview=None,
                        options_count=0,
                        is_complete=False,
                        requires_human_review=True,
                    )
                )
                continue

            has_statement = bool(r.text_preview and r.text_preview.strip())
            has_options = (r.options_count or 0) > 0
            has_correct_option = (r.correct_options_count or 0) == 1
            has_valid_syllabus = bool(
                r.subject_name
                and r.topic_name
                and r.subtopic_name
                and r.subject_name != "Uncategorized"
                and r.topic_name != "Uncategorized"
                and r.subtopic_name != "Uncategorized"
            )

            reasons: List[str] = []
            if not has_statement:
                reasons.append("Question statement text is missing or blank in database.")
            if not has_options:
                reasons.append("0 answer options configured in database.")

            if not has_statement or not has_options:
                category = "CORRUPTED"
            elif not has_correct_option or not has_valid_syllabus or not r.is_complete:
                category = "PARTIALLY_CORRUPTED"
                if not has_correct_option:
                    reasons.append("No correct answer option configured / mapped from answer key.")
                if not has_valid_syllabus:
                    reasons.append("Incomplete or uncategorized syllabus hierarchy mapping.")
            else:
                category = "VALID"

            if category == "CORRUPTED":
                corrupted_count += 1
            elif category == "PARTIALLY_CORRUPTED":
                partially_corrupted_count += 1
            elif category == "VALID":
                valid_count += 1

            stmt_preview = (r.text_preview + "...") if r.text_preview else None
            status_val = r.status.value if hasattr(r.status, "value") else str(r.status)
            diff_val = r.difficulty.value if hasattr(r.difficulty, "value") else str(r.difficulty)

            all_issue_items.append(
                QuestionIssueDetail(
                    question_id=str(r.id),
                    question_number_in_paper=r.question_number_in_paper,
                    status=status_val,
                    issue_category=category,
                    issues=reasons,
                    has_statement=has_statement,
                    has_options=has_options,
                    has_correct_option=has_correct_option,
                    has_explanation=category != "CORRUPTED",
                    has_valid_syllabus=has_valid_syllabus,
                    subject=r.subject_name,
                    topic=r.topic_name,
                    subtopic=r.subtopic_name,
                    question_text_preview=stmt_preview,
                    options_count=r.options_count or 0,
                    correct_option_label=r.correct_option_label,
                    difficulty=diff_val,
                    is_complete=bool(r.is_complete and (category != "CORRUPTED")),
                    requires_human_review=bool(r.requires_human_review or (category != "VALID")),
                )
            )

        # 3. Filter by issue_type
        filter_type = (issue_type or "").strip().upper()
        if filter_type == "CORRUPTED":
            filtered_items = [item for item in all_issue_items if item.issue_category == "CORRUPTED"]
        elif filter_type == "PARTIALLY_CORRUPTED":
            filtered_items = [item for item in all_issue_items if item.issue_category == "PARTIALLY_CORRUPTED"]
        elif filter_type == "MISSING_IN_PAPER":
            filtered_items = [item for item in all_issue_items if item.issue_category == "MISSING_IN_PAPER"]
        elif filter_type in ("ALL_ISSUES", "ISSUES"):
            filtered_items = [item for item in all_issue_items if item.issue_category in ("CORRUPTED", "PARTIALLY_CORRUPTED", "MISSING_IN_PAPER")]
        elif filter_type == "VALID":
            filtered_items = [item for item in all_issue_items if item.issue_category == "VALID"]
        else:
            filtered_items = all_issue_items

        # 4. Apply pagination
        page = max(1, page)
        limit = max(1, min(500, limit))
        total_items = len(filtered_items)
        pages = max(1, (total_items + limit - 1) // limit)
        start_idx = (page - 1) * limit
        paged_items = filtered_items[start_idx : start_idx + limit]

        return ExamIntegrityQuestionsResponse(
            exam_id=str(exam.id),
            exam_code=exam.code,
            exam_name=exam.name,
            paper_set_code=exam.paper_set_code or "SET_A",
            total_expected_questions=total_expected,
            total_extracted_questions=total_extracted,
            corrupted_count=corrupted_count,
            partially_corrupted_count=partially_corrupted_count,
            missing_count=missing_count,
            valid_count=valid_count,
            missing_question_numbers=missing_numbers,
            is_extracting=is_extracting,
            page=page,
            limit=limit,
            total_items=total_items,
            pages=pages,
            items=paged_items,
        )

    async def get_exams_by_year(self) -> ExamsByYearResponse:
        """
        Returns all available exams grouped by year (e.g. 2024, 2023, 2019) with summary metrics.
        """
        stmt = select(Exam).order_by(Exam.source_year.desc(), Exam.created_at.desc())
        exams = (await self.session.exec(stmt)).all()

        from app.services.task_registry import task_registry
        from app.db.models.pipeline_run import PipelineRun

        runs_stmt = select(PipelineRun).where(
            PipelineRun.pipeline_type.in_(("QUESTION_EXTRACTION", "DOCUMENT_EXTRACTION"))
        ).order_by(PipelineRun.id.desc())
        all_runs = (await self.session.exec(runs_stmt)).all()
        runs_by_exam: Dict[int, PipelineRun] = {}
        for r in all_runs:
            if r.exam_id and r.exam_id not in runs_by_exam:
                runs_by_exam[r.exam_id] = r
        exams_by_year_map: Dict[str, List[ExamYearItem]] = {}
        years_set = set()

        for exam in exams:
            yr = exam.source_year or 0
            if yr > 0:
                years_set.add(yr)
            yr_str = str(yr) if yr > 0 else "UNKNOWN"

            stage_val = exam.stage if isinstance(exam.stage, str) else (exam.stage.value if hasattr(exam.stage, "value") else str(exam.stage))
            status_val = (
                exam.status.value
                if hasattr(exam.status, "value")
                else str(exam.status or "PENDING_HUMAN_REVIEW")
            )
            is_pub = (status_val == "PUBLISHED" or getattr(exam, "is_active", False))

            p_run = runs_by_exam.get(exam.id)
            is_task_running = task_registry.is_running(str(exam.id)) or task_registry.is_running(f"qp_{exam.id}")

            is_extracting = False
            if is_task_running:
                is_extracting = True
            elif p_run and str(p_run.status).upper() in ("RUNNING", "PROCESSING", "INITIALIZING"):
                is_extracting = True
            elif status_val in ("PROCESSING", "PARSING_PDF", "EXTRACTING"):
                is_extracting = True
            elif not is_pub and (exam.extracted_questions_count or 0) > 0 and (exam.extracted_questions_count or 0) < (exam.total_questions or 100):
                if p_run and str(p_run.status).upper() != "FAILED":
                    is_extracting = True

            item = ExamYearItem(
                id=str(exam.id),
                code=exam.code,
                name=exam.name,
                source_year=exam.source_year,
                stage=stage_val,
                subject_code=exam.subject_code or "gs1",
                paper_set_code=exam.paper_set_code or "SET_A",
                total_questions=exam.total_questions or 100,
                extracted_questions_count=exam.extracted_questions_count or 0,
                corrupted_questions_count=0,
                partially_corrupted_questions_count=0,
                missing_questions_count=0 if is_extracting else (exam.missing_questions_count or 0),
                is_published=is_pub,
                pipeline_status="IN_PROGRESS" if is_extracting else status_val,
                overall_status="PROCESSING" if is_extracting else status_val,
                stage1_status="IN_PROGRESS" if is_extracting else ("COMPLETED" if (exam.extracted_questions_count or 0) >= (exam.total_questions or 100) else "QUEUED"),
                is_extracting=is_extracting,
                created_at=exam.created_at.isoformat() if exam.created_at else None,
            )

            exams_by_year_map.setdefault(yr_str, []).append(item)


        sorted_years = sorted(list(years_set), reverse=True)
        return ExamsByYearResponse(
            years=sorted_years,
            total_exams=len(exams),
            exams_by_year=exams_by_year_map,
        )
