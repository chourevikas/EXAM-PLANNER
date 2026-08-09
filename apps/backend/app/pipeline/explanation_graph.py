import uuid
import json
from typing import List, Dict, Any, TypedDict, Optional, Tuple
from sqlmodel import select, col
from langgraph.graph import StateGraph, END, START

from app.db.session import async_session_factory
from app.db.models import (
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    PassageTranslation,
    Subject,
    Topic,
    Subtopic,
    DifficultyLevel,
    BloomsLevel,
    LanguageCode,
    HumanReviewTask,
    SyllabusVersion,
    QuestionMetadata,
    QuestionHierarchyLink,
    QuestionStatus,
)
from app.pipeline.explanation_generator import (
    ainvoke_explanation_llm,
    ainvoke_translate_explanation_llm,
)
from app.pipeline.explanation_schema import (
    QuestionExplanationSchema,
    MultiConceptItemSchema,
)
from app.services.pipeline_management_service import PipelineManagementService
from app.config.logger import setup_logger, TaskLoggerAdapter

logger = setup_logger("ExplanationPipeline")


class ExplanationPipelineState(TypedDict):
    exam_id: str
    question_ids: Optional[List[str]]
    language: str
    task_id: Optional[str]
    total_questions: Optional[int]
    total_explanations_generated: Optional[int]
    failed_question_ids: Optional[List[str]]


async def _get_or_create_subtopic(
    session, syl_id: uuid.UUID, subj_name: str, topic_name: str, subtopic_name: str
) -> Tuple[Subtopic, Topic, Subject]:
    """Helper to upsert Subject -> Topic -> Subtopic hierarchy and return Subtopic, Topic, and Subject records."""
    subj_stmt = select(Subject).where(
        Subject.syllabus_version_id == syl_id,
        Subject.name == subj_name,
    )
    subj = (await session.exec(subj_stmt)).first()
    if not subj:
        subj = Subject(
            syllabus_version_id=syl_id,
            code=subj_name[:10].upper(),
            name=subj_name,
        )
        session.add(subj)
        await session.commit()
        await session.refresh(subj)

    top_stmt = select(Topic).where(
        Topic.subject_id == subj.id, Topic.name == topic_name
    )
    top = (await session.exec(top_stmt)).first()
    if not top:
        top = Topic(
            subject_id=subj.id,
            code=topic_name[:10].upper(),
            name=topic_name,
        )
        session.add(top)
        await session.commit()
        await session.refresh(top)

    subtop_stmt = select(Subtopic).where(
        Subtopic.topic_id == top.id, Subtopic.name == subtopic_name
    )
    subtop = (await session.exec(subtop_stmt)).first()
    if not subtop:
        subtop = Subtopic(
            topic_id=top.id,
            code=subtopic_name[:10].upper(),
            name=subtopic_name,
        )
        session.add(subtop)
        await session.commit()
        await session.refresh(subtop)

    return subtop, top, subj


async def node_load_exam_questions(
    state: ExplanationPipelineState,
) -> Dict[str, Any]:
    """Loads all questions for target exam from DB and updates PipelineRun progress."""
    exam_id = uuid.UUID(state["exam_id"])
    target_q_ids = state.get("question_ids")
    lang_str = state.get("language", "ENGLISH").upper()
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    log.info(
        f"📚 [EXPLANATION PIPELINE STARTED] Exam ID: {exam_id} | Default Target Language: {lang_str}"
    )

    async with async_session_factory() as session:
        pm_service = PipelineManagementService(session)
        await pm_service.update_pipeline_status(
            exam_id=exam_id,
            pipeline_type="EXPLANATION_INDEXING",
            status="RUNNING",
            current_step="LOADING_QUESTIONS_FOR_LLM_REASONING",
            progress_percent=10.0,
        )

        stmt = select(Question).where(Question.exam_id == exam_id)
        if target_q_ids:
            q_uuids = [uuid.UUID(qid) for qid in target_q_ids]
            stmt = stmt.where(col(Question.id).in_(q_uuids))

        res = await session.exec(stmt)
        questions = res.all()

        log.info(f"Loaded {len(questions)} question(s) for explanation processing.")
        return {"total_questions": len(questions)}


async def _generate_and_save_single_question_explanation(
    q_id: uuid.UUID,
    default_lang_enum: LanguageCode,
    log: TaskLoggerAdapter,
) -> bool:
    """Helper to generate explanation in English and translate/persist for all question target languages in DB."""
    async with async_session_factory() as session:
        q = await session.get(Question, q_id)
        if not q:
            return False

        trans_stmt = select(QuestionTranslation).where(
            QuestionTranslation.question_id == q_id
        )
        trans_res = await session.exec(trans_stmt)
        translations = trans_res.all()

        target_languages = set()
        for t in translations:
            target_languages.add(t.language)
        target_languages.add(LanguageCode.ENGLISH)
        if default_lang_enum:
            target_languages.add(default_lang_enum)

        eng_trans = next(
            (t for t in translations if t.language == LanguageCode.ENGLISH),
            translations[0] if translations else None,
        )
        q_text = (
            eng_trans.question_text
            if eng_trans
            else f"Question #{q.question_number_in_paper}"
        )

        passage_text = None
        if q.passage_id:
            p_trans_stmt = select(PassageTranslation).where(
                PassageTranslation.passage_id == q.passage_id
            )
            p_res = await session.exec(p_trans_stmt)
            p_translations = p_res.all()
            p_trans = next(
                (pt for pt in p_translations if pt.language == LanguageCode.ENGLISH),
                p_translations[0] if p_translations else None,
            )
            if p_trans:
                passage_text = p_trans.passage_text

        opt_stmt = select(QuestionOption).where(QuestionOption.question_id == q_id)
        opt_res = await session.exec(opt_stmt)
        options = opt_res.all()

        opt_payloads: List[Dict[str, Any]] = []
        correct_label = None
        for opt in options:
            o_trans_stmt = select(OptionTranslation).where(
                OptionTranslation.option_id == opt.id
            )
            o_trans_res = await session.exec(o_trans_stmt)
            o_translations = o_trans_res.all()
            opt_trans = next(
                (ot for ot in o_translations if ot.language == LanguageCode.ENGLISH),
                o_translations[0] if o_translations else None,
            )
            o_text = (
                opt_trans.option_text
                if opt_trans
                else f"Option {opt.option_label}"
            )

            if opt.is_correct:
                correct_label = opt.option_label

            opt_payloads.append(
                {
                    "option_id": opt.id,
                    "option_label": str(opt.option_label),
                    "option_text": str(o_text),
                    "is_correct": bool(opt.is_correct),
                }
            )

    # Step 1: Generate primary English QuestionExplanationSchema
    log.info(f"🇬🇧 Generating primary English Explanation for Question ID {q_id}...")
    english_schema: QuestionExplanationSchema = await ainvoke_explanation_llm(
        question_text=q_text,
        options=opt_payloads,
        correct_option_label=correct_label,
        passage_text=passage_text,
        language=LanguageCode.ENGLISH,
    )

    # Step 2: Save explanations & distractor analyses for all target languages
    for target_lang in target_languages:
        if target_lang == LanguageCode.ENGLISH:
            lang_schema = english_schema
        else:
            log.info(f"🌐 Translating Explanation to {target_lang.value} for Question ID {q_id}...")
            lang_schema = await ainvoke_translate_explanation_llm(
                english_schema, target_lang
            )

        async with async_session_factory() as session:
            existing_expl_stmt = select(QuestionExplanation).where(
                QuestionExplanation.question_id == q_id,
                QuestionExplanation.language == target_lang,
            )
            existing_expl = (await session.exec(existing_expl_stmt)).first()

            if existing_expl:
                existing_expl.core_concept = lang_schema.core_concept
                existing_expl.detailed_solution = lang_schema.detailed_solution
                existing_expl.common_traps_json = lang_schema.common_traps or []
                existing_expl.key_takeaways_json = lang_schema.key_takeaways or []
                session.add(existing_expl)
            else:
                new_expl = QuestionExplanation(
                    question_id=q_id,
                    language=target_lang,
                    core_concept=lang_schema.core_concept,
                    detailed_solution=lang_schema.detailed_solution,
                    common_traps_json=lang_schema.common_traps or [],
                    key_takeaways_json=lang_schema.key_takeaways or [],
                )
                session.add(new_expl)

            # Update Per-Option Distractor Analysis in OptionTranslation
            for opt_analysis in lang_schema.options_breakdown:
                clean_key = str(opt_analysis.option_key).strip().strip("()").strip(".").upper()
                target_opt = next(
                    (
                        o
                        for o in opt_payloads
                        if str(o["option_label"]).strip().strip("()").strip(".").upper()
                        == clean_key
                    ),
                    None,
                )

                if target_opt:
                    o_id = uuid.UUID(str(target_opt["option_id"]))
                    ot_stmt = select(OptionTranslation).where(
                        OptionTranslation.option_id == o_id,
                        OptionTranslation.language == target_lang,
                    )
                    opt_trans = (await session.exec(ot_stmt)).first()

                    if opt_trans:
                        opt_trans.distractor_analysis = opt_analysis.explanation
                        session.add(opt_trans)
                    else:
                        new_ot = OptionTranslation(
                            option_id=o_id,
                            language=target_lang,
                            option_text=str(target_opt["option_text"]),
                            distractor_analysis=opt_analysis.explanation,
                        )
                        session.add(new_ot)

            await session.commit()

    # Step 3: Multi-Concept Hierarchy & QuestionMetadata Update
    async with async_session_factory() as session:
        db_q = await session.get(Question, q_id)
        if db_q:
            # Base time by Bloom's Taxonomy
            blooms_str = (english_schema.blooms_level or "ANALYZE").upper()
            if "REMEMBER" in blooms_str:
                blooms_time = 40
                blooms_enum = BloomsLevel.REMEMBER
            elif "UNDERSTAND" in blooms_str:
                blooms_time = 55
                blooms_enum = BloomsLevel.UNDERSTAND
            elif "APPLY" in blooms_str:
                blooms_time = 70
                blooms_enum = BloomsLevel.APPLY
            elif "EVALUATE" in blooms_str:
                blooms_time = 110
                blooms_enum = BloomsLevel.EVALUATE
            else:
                blooms_time = 90
                blooms_enum = BloomsLevel.ANALYZE

            # Difficulty Modifier
            diff_upper = english_schema.difficulty.upper()
            if "EASY" in diff_upper:
                db_q.difficulty = DifficultyLevel.EASY
                diff_mod = -15
            elif "HARD" in diff_upper:
                db_q.difficulty = DifficultyLevel.HARD
                diff_mod = 25
            else:
                db_q.difficulty = DifficultyLevel.MEDIUM
                diff_mod = 0

            # Asset / Passage Modifier
            extra_mod = 25 if (db_q.has_image or db_q.passage_id) else 0
            computed_time = min(max(blooms_time + diff_mod + extra_mod, 30), 180)
            db_q.expected_time_seconds = computed_time

            # Transition Question status to PUBLISHED
            db_q.status = QuestionStatus.PUBLISHED
            session.add(db_q)

            # Save QuestionMetadata & Calculate IRT Parameters
            meta_stmt = select(QuestionMetadata).where(
                QuestionMetadata.question_id == q_id
            )
            q_meta = (await session.exec(meta_stmt)).first()
            cog_skill = (
                english_schema.cognitive_skill[:100]
                if english_schema.cognitive_skill
                else "Conceptual Reasoning"
            )

            # Compute Item Response Theory (IRT) metrics
            if db_q.difficulty == DifficultyLevel.EASY:
                calc_irt_b = -1.00
            elif db_q.difficulty == DifficultyLevel.HARD:
                calc_irt_b = 1.50
            else:
                calc_irt_b = 0.00

            if blooms_enum in (BloomsLevel.ANALYZE, BloomsLevel.EVALUATE):
                calc_irt_a = 1.80
            elif blooms_enum == BloomsLevel.APPLY:
                calc_irt_a = 1.50
            else:
                calc_irt_a = 1.20

            calc_irt_c = 0.25

            if not q_meta:
                q_meta = QuestionMetadata(
                    question_id=q_id,
                    blooms_level=blooms_enum,
                    cognitive_skill=cog_skill,
                    primary_concept_tag=english_schema.topic[:50].upper(),
                    historical_accuracy=english_schema.historical_accuracy or 50.0,
                    pyq_frequency=english_schema.pyq_frequency or 1,
                    irt_discrimination_a=calc_irt_a,
                    irt_difficulty_b=calc_irt_b,
                    irt_pseudo_guessing_c=calc_irt_c,
                )
            else:
                q_meta.blooms_level = blooms_enum
                q_meta.cognitive_skill = cog_skill
                q_meta.primary_concept_tag = english_schema.topic[:50].upper()
                q_meta.historical_accuracy = english_schema.historical_accuracy or 50.0
                q_meta.pyq_frequency = english_schema.pyq_frequency or 1
                q_meta.irt_discrimination_a = calc_irt_a
                q_meta.irt_difficulty_b = calc_irt_b
                q_meta.irt_pseudo_guessing_c = calc_irt_c
            session.add(q_meta)

            # Resolve Syllabus Version
            syl_stmt = select(SyllabusVersion).where(
                SyllabusVersion.exam_id == db_q.exam_id
            )
            syl = (await session.exec(syl_stmt)).first()
            if not syl and db_q.exam_id:
                syl = SyllabusVersion(
                    exam_id=db_q.exam_id,
                    version_code="DEFAULT_v1",
                    title="Default Syllabus",
                )
                session.add(syl)
                await session.commit()
                await session.refresh(syl)

            if syl:
                primary_subj = english_schema.subject.strip()
                primary_topic = english_schema.topic.strip()
                primary_subtop = (
                    english_schema.subtopic.strip()
                    if english_schema.subtopic
                    else "General Concept"
                )

                subtop_record, top_record, subj_record = await _get_or_create_subtopic(
                    session, syl.id, primary_subj, primary_topic, primary_subtop
                )
                db_q.subtopic_id = subtop_record.id
                session.add(db_q)

                # Process Multi-Concept Items (Subjects / Topics / Subtopics)
                concepts_list = (
                    english_schema.concepts if english_schema.concepts else []
                )
                if not concepts_list:
                    concepts_list.append(
                        MultiConceptItemSchema(
                            subject=primary_subj,
                            topic=primary_topic,
                            subtopic=primary_subtop,
                            is_primary=True,
                            relevance_weight=1.0,
                            concept_name=primary_topic,
                        )
                    )

                for concept in concepts_list:
                    c_subj = concept.subject.strip()
                    c_top = concept.topic.strip()
                    c_subtop = (
                        concept.subtopic.strip()
                        if concept.subtopic
                        else "General Concept"
                    )

                    c_subtop_rec, c_top_rec, c_subj_rec = await _get_or_create_subtopic(
                        session, syl.id, c_subj, c_top, c_subtop
                    )

                    link_stmt = select(QuestionHierarchyLink).where(
                        QuestionHierarchyLink.question_id == q_id,
                        QuestionHierarchyLink.subtopic_id == c_subtop_rec.id,
                    )
                    link = (await session.exec(link_stmt)).first()
                    if not link:
                        link = QuestionHierarchyLink(
                            question_id=q_id,
                            subtopic_id=c_subtop_rec.id,
                            topic_id=c_top_rec.id,
                            subject_id=c_subj_rec.id,
                            is_primary=concept.is_primary,
                            relevance_weight=concept.relevance_weight,
                            concept_name=concept.concept_name or c_top,
                        )
                        session.add(link)
                    else:
                        link.is_primary = concept.is_primary
                        link.relevance_weight = concept.relevance_weight
                        link.concept_name = concept.concept_name or c_top
                        session.add(link)

            await session.commit()

    return True


async def node_generate_and_save_explanations(
    state: ExplanationPipelineState,
) -> Dict[str, Any]:
    """Generates explanations, distractor analyses, multi-concepts, and progress metrics."""
    exam_id = uuid.UUID(state["exam_id"])
    target_q_ids = state.get("question_ids")
    lang_str = state.get("language", "ENGLISH").upper()
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    try:
        lang_enum = LanguageCode(lang_str)
    except ValueError:
        lang_enum = LanguageCode.ENGLISH

    async with async_session_factory() as session:
        stmt = select(Question.id).where(Question.exam_id == exam_id)
        if target_q_ids:
            q_uuids = [uuid.UUID(qid) for qid in target_q_ids]
            stmt = stmt.where(col(Question.id).in_(q_uuids))

        res = await session.exec(stmt)
        q_ids = res.all()

    total_generated = 0
    failed_ids = []
    total_count = len(q_ids) if q_ids else 1

    for idx, q_id in enumerate(q_ids, 1):
        try:
            log.info(f"🤖 [LLM AGENT] Generating Explanation for Question ID {q_id} ({idx}/{total_count})...")
            success = await _generate_and_save_single_question_explanation(
                q_id, lang_enum, log
            )
            if success:
                total_generated += 1
            else:
                failed_ids.append(str(q_id))

            # Update PipelineRun progress percentage dynamically
            async with async_session_factory() as session:
                pm_service = PipelineManagementService(session)
                pct = 10.0 + (80.0 * (idx / total_count))
                await pm_service.update_pipeline_status(
                    exam_id=exam_id,
                    pipeline_type="EXPLANATION_INDEXING",
                    status="RUNNING",
                    current_step=f"GENERATING_EXPLANATIONS_({idx}/{total_count})",
                    progress_percent=pct,
                )
        except Exception as exc:
            log.error(
                f"❌ [EXPLANATION FAILED] Question ID {q_id}: {exc}", exc_info=True
            )
            failed_ids.append(str(q_id))

    log.info(
        f"✨ [EXPLANATIONS COMPLETE] Generated: {total_generated}/{len(q_ids)} | Failed: {len(failed_ids)}"
    )

    return {
        "total_explanations_generated": total_generated,
        "failed_question_ids": failed_ids,
    }


async def node_explanation_validator_and_hitl(
    state: ExplanationPipelineState,
) -> Dict[str, Any]:
    """Validates explanation completeness and updates final PipelineRun status to COMPLETED."""
    exam_id = uuid.UUID(state["exam_id"])
    t_id = state.get("task_id", "N/A")
    log = TaskLoggerAdapter(logger, task_id=t_id)

    async with async_session_factory() as session:
        stmt = select(Question).where(Question.exam_id == exam_id)
        questions = (await session.exec(stmt)).all()

        for q in questions:
            failure_reasons = []

            expl_stmt = select(QuestionExplanation).where(
                QuestionExplanation.question_id == q.id
            )
            expl = (await session.exec(expl_stmt)).first()

            if not expl:
                failure_reasons.append("Missing QuestionExplanation record")
            else:
                if not expl.core_concept or len(expl.core_concept.strip()) < 5:
                    failure_reasons.append("Core concept empty or truncated")
                if not expl.detailed_solution or len(expl.detailed_solution.strip()) < 10:
                    failure_reasons.append("Detailed solution incomplete")

            opt_stmt = select(QuestionOption).where(QuestionOption.question_id == q.id)
            options = (await session.exec(opt_stmt)).all()

            for opt in options:
                ot_stmt = select(OptionTranslation).where(
                    OptionTranslation.option_id == opt.id
                )
                o_trans = (await session.exec(ot_stmt)).all()
                if not any(ot.distractor_analysis for ot in o_trans):
                    failure_reasons.append(
                        f"Missing distractor analysis for Option '{opt.option_label}'"
                    )

            if failure_reasons:
                log.warning(
                    f"⚠️ [HITL FLAG] Question ID {q.id} flagged with {len(failure_reasons)} warning(s)."
                )

            rt_stmt = select(HumanReviewTask).where(
                HumanReviewTask.question_id == q.id
            )
            existing_task = (await session.exec(rt_stmt)).first()

            if existing_task:
                existing_reasons = (
                    existing_task.failure_reasons_json
                    if isinstance(existing_task.failure_reasons_json, list)
                    else json.loads(existing_task.failure_reasons_json or "[]")
                )
                combined = list(set(existing_reasons + failure_reasons))
                existing_task.is_flagged_by_validator = bool(combined)
                existing_task.failure_reasons_json = combined
                session.add(existing_task)
            else:
                task = HumanReviewTask(
                    question_id=q.id,
                    exam_id=exam_id,
                    review_status="PENDING_REVIEW",
                    is_flagged_by_validator=bool(failure_reasons),
                    failure_reasons_json=failure_reasons,
                )
                session.add(task)

        await session.commit()

        # Update PipelineRun status to COMPLETED
        pm_service = PipelineManagementService(session)
        await pm_service.update_pipeline_status(
            exam_id=exam_id,
            pipeline_type="EXPLANATION_INDEXING",
            status="COMPLETED",
            current_step="PIPELINE_3_EXPLANATION_AND_INDEXING_COMPLETE",
            progress_percent=100.0,
        )

    return {}


def build_explanation_pipeline():
    """Builds and compiles Phase 3 Explanation & Knowledge Base LangGraph pipeline."""
    graph = StateGraph(ExplanationPipelineState)

    graph.add_node("load_questions", node_load_exam_questions)
    graph.add_node("generate_explanations", node_generate_and_save_explanations)
    graph.add_node("validate_and_hitl", node_explanation_validator_and_hitl)

    graph.add_edge(START, "load_questions")
    graph.add_edge("load_questions", "generate_explanations")
    graph.add_edge("generate_explanations", "validate_and_hitl")
    graph.add_edge("validate_and_hitl", END)

    return graph.compile()
