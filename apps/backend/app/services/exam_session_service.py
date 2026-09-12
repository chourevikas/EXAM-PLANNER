import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from fastapi import HTTPException, status, BackgroundTasks
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    User,
    Exam,
    Question,
    QuestionOption,
    QuestionTranslation,
    OptionTranslation,
    QuestionExplanation,
    QuestionOptionReasoning,
    ExamAttempt,
    ExamQuestionResponse,
    Test,
    UserTestAttempt,
    UserQuestionResponse,
    QuestionSwitchLog,
)
from app.db.models.enums import AttemptStatus, AttemptMode, QuestionResponseStatus, TestType, UserRole, UserStatus, LanguageCode
from app.schemas.exam_attempt import (
    StartExamRequest,
    StartExamResponse,
    SaveResponseRequest,
    SaveResponseResponse,
    RevealAnswerResponse,
    SubmitExamRequest,
    SubmitExamResponse,
    HeartbeatRequest,
    HeartbeatResponse,
    ExamStatusResponse,
    QuestionNavResponse,
    QuestionOut,
    OptionOut,
    NavigationMeta,
    ResponseState,
    QuestionPaletteItem,
    ResponseSummary,
    BatchSaveItem,
    BatchSaveResponseRequest,
    BatchSaveResponseAck,
    BatchStatusResponse,
)
from app.services.exam_json_builder import ExamJsonBuilder
from app.engine.matrices.time_tiered_scoring import TimeTieredScoringStrategy
from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
from app.engine.matrices.guessing_tendency import GuessingTendencyStrategy
from app.engine.post_submission_pipeline import load_exam_solutions_data
from app.storage.factory import get_storage_provider
from app.config.logger import setup_logger

logger = setup_logger("ExamSessionService")

# In-memory fast batch tracker for async confirmation and client status verification
BATCH_TRACKER: Dict[str, Dict[str, Any]] = {}


class ExamSessionService:
    """Service managing the active student exam-taking lifecycle."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.storage = get_storage_provider()

    async def start_exam(self, user_id: Any, req: Any = None) -> StartExamResponse:
        # Handle flexible positional argument order (user_id vs req)
        if isinstance(user_id, StartExamRequest) or hasattr(user_id, "exam_id"):
            req, user_id = user_id, req

        raw_exam_id = req.exam_id if hasattr(req, "exam_id") else req

        # Resolve Exam by integer ID or string code/slug
        exam = None
        req_exam_str = str(raw_exam_id)

        try:
            parsed_id = int(req_exam_str)
            exam = await self.session.get(Exam, parsed_id)
        except (ValueError, TypeError):
            pass

        if not exam:
            exam_res = await self.session.exec(select(Exam).where(Exam.code == req_exam_str))
            exam = exam_res.first()

        if not exam:
            # Fallback to any active exam in DB
            exam_res = await self.session.exec(select(Exam).where(Exam.is_active == True))
            exam = exam_res.first()

        if not exam:
            raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND: Exam does not exist.")
        if not exam.is_active:
            raise HTTPException(status_code=403, detail="EXAM_INACTIVE: This exam is currently inactive.")

        # Ensure User record exists in DB
        u_obj = await self.session.get(User, user_id)
        if not u_obj:
            u_obj = User(
                id=user_id,
                email=f"candidate_{str(user_id)[:8]}@examplanner.ai",
                full_name="Candidate User",
                role=UserRole.STUDENT,
                status=UserStatus.ACTIVE,
            )
            self.session.add(u_obj)
            await self.session.flush()

        # Check for existing IN_PROGRESS attempt
        existing = await self.session.exec(
            select(ExamAttempt).where(
                ExamAttempt.user_id == user_id,
                ExamAttempt.exam_id == exam.id,
                ExamAttempt.status == AttemptStatus.IN_PROGRESS,
            )
        )
        existing_attempt = existing.first()
        if existing_attempt:
            if getattr(req, 'force_new', False):
                logger.info(f"User '{user_id}' requested force_new attempt. Abandoning attempt '{existing_attempt.id}'...")
                existing_attempt.status = AttemptStatus.ABANDONED
                await self.session.flush()
            else:
                logger.info(f"User '{user_id}' already has IN_PROGRESS attempt '{existing_attempt.id}'. Resuming...")
                status_res = await self.get_exam_status(existing_attempt.id, user_id)
                q_nav = await self.get_question(existing_attempt.id, user_id, status_res.current_question_index, language=req.language or "ENGLISH")

                return StartExamResponse(
                    attempt_id=str(existing_attempt.id),
                    exam_id=str(exam.id),
                    status=existing_attempt.status,
                    mode=existing_attempt.mode,
                    started_at=existing_attempt.started_at,
                    max_duration_seconds=existing_attempt.max_duration_seconds,
                    total_questions=existing_attempt.total_questions,
                    first_question=q_nav,
                    palette=status_res.palette,
                    questions_presigned_url=None,
                    questions_folder_url=None,
                )

        # Fast Question Metadata Retrieval using DB index scan or folder

        q_stmt = (
            select(Question.id, Question.question_number_in_paper, Question.expected_time_seconds)
            .where(Question.exam_id == exam.id)
            .order_by(col(Question.question_number_in_paper))
        )
        q_res = await self.session.exec(q_stmt)
        q_rows = q_res.all()

        total_q_count = len(q_rows)
        if total_q_count == 0:
            total_q_count = exam.total_questions or exam.extracted_questions_count or 100

        duration_sec = (exam.total_duration_minutes or 120) * 60
        now_dt = datetime.now(timezone.utc)

        # Create ExamAttempt
        attempt = ExamAttempt(
            user_id=user_id,
            exam_id=exam.id,
            mode=req.mode,
            status=AttemptStatus.IN_PROGRESS,
            started_at=now_dt,
            max_duration_seconds=duration_sec,
            total_questions=total_q_count,
            current_question_index=1,
        )
        self.session.add(attempt)

        # Create or fetch linked Test
        test_res = await self.session.exec(select(Test).where(Test.id == exam.id))
        test_obj = test_res.first()
        if not test_obj:
            t_type = TestType.PYQ if "PYQ" in str(exam.exam_type).upper() or "PYQ" in exam.code.upper() else TestType.MOCK
            test_obj = Test(
                id=exam.id,
                title=exam.name,
                test_type=t_type,
                total_questions=total_q_count,
                duration_minutes=exam.total_duration_minutes or 120,
            )
            self.session.add(test_obj)

        # Create UserTestAttempt
        user_test_attempt = UserTestAttempt(
            user_id=user_id,
            test_id=test_obj.id,
            exam_attempt_id=attempt.id,
            status=attempt.status,
            mode=attempt.mode,
            started_at=now_dt,
        )
        self.session.add(user_test_attempt)
        await self.session.commit()

        # Fast Bulk Pre-creation of ExamQuestionResponse and UserQuestionResponse rows
        exam_responses = []
        palette_items = []
        for index, row in enumerate(q_rows, 1):
            q_id = row[0] if isinstance(row, (tuple, list)) else row.id
            q_num = row[1] if isinstance(row, (tuple, list)) else (row.question_number_in_paper or index)
            exp_time = row[2] if isinstance(row, (tuple, list)) else (row.expected_time_seconds or 60.0)

            status_val = QuestionResponseStatus.VISITED if index == 1 else QuestionResponseStatus.UNVISITED
            resp = ExamQuestionResponse(
                attempt_id=attempt.id,
                question_id=q_id,
                question_status=status_val,
                expected_time_seconds=float(exp_time or 60.0),
                visited_count=1 if index == 1 else 0,
            )
            exam_responses.append(resp)
            palette_items.append(
                QuestionPaletteItem(
                    question_number=q_num or index,
                    question_id=str(q_id),
                    question_status=status_val,
                )
            )

        if exam_responses:
            self.session.add_all(exam_responses)
            await self.session.flush()

            user_responses = [
                UserQuestionResponse(
                    attempt_id=user_test_attempt.id,
                    exam_response_id=resp.id,
                    question_id=resp.question_id,
                    time_taken_seconds=0,
                )
                for resp in exam_responses
            ]
            self.session.add_all(user_responses)
            await self.session.commit()

        # Load first question directly from the database
        q_nav = await self.get_question(
            attempt_id=attempt.id,
            user_id=user_id,
            question_number=1,
            language=req.language or "ENGLISH",
        )

        # Pre-cache full questions and solutions data from DB into memory/Redis for instant evaluation
        cached_eid = exam.id
        cached_code = exam.code
        async def _precache_exam_solutions():
            try:
                from app.engine.post_submission_pipeline import load_exam_solutions_data
                from app.db.session import managed_async_session
                async with managed_async_session() as pre_sess:
                    await load_exam_solutions_data(cached_eid, pre_sess)
            except Exception as precache_err:
                logger.warning(f"Exam solutions background pre-cache warning for exam '{cached_code}': {precache_err}")

        asyncio.create_task(_precache_exam_solutions())

        return StartExamResponse(
            attempt_id=str(attempt.id),
            exam_id=str(exam.id),
            status=attempt.status,
            mode=attempt.mode,
            started_at=attempt.started_at,
            max_duration_seconds=attempt.max_duration_seconds,
            total_questions=attempt.total_questions,
            first_question=q_nav,
            palette=palette_items,
            questions_presigned_url=None,
            questions_folder_url=None,
        )

    async def get_question(
        self,
        attempt_id: int | str,
        user_id: int,
        question_number: int,
        language: Optional[str] = "ENGLISH",
    ) -> QuestionNavResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_ALREADY_SUBMITTED: Attempt is no longer in progress."
            )

        if question_number < 1 or question_number > attempt.total_questions:
            raise HTTPException(
                status_code=422,
                detail=f"QUESTION_NUMBER_OUT_OF_RANGE: Must be between 1 and {attempt.total_questions}.",
            )

        exam = await self.session.get(Exam, attempt.exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND: Associated exam not found.")

        # --- S3 Storage Logic Commented Out (Using Direct PostgreSQL DB for all queries) ---
        # paper_set = exam.paper_set_code or "SET_A"
        # clean_set = str(paper_set).strip().lower().replace("_", "-")
        # q_folder = exam.questions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/questions"
        # q_filename = f"Q{question_number:03d}.json"
        # s3_indiv_path = f"{q_folder.rstrip('/')}/{q_filename}"
        # q_json_path = exam.questions_json_path or f"exams/{exam.code}/exam_questions.json"
        #
        # q_payload = None
        # presigned_url = None
        #
        # try:
        #     if await self.storage.exists(s3_indiv_path):
        #         q_payload = await self.storage.download_json(s3_indiv_path)
        #         presigned_url = await self.storage.generate_presigned_url(s3_indiv_path)
        # except Exception:
        #     q_payload = None
        #
        # if not q_payload:
        #     try:
        #         if await self.storage.exists(q_json_path):
        #             questions_doc = await self.storage.download_json(q_json_path)
        #             questions_list = questions_doc.get("questions", [])
        #             if question_number <= len(questions_list):
        #                 q_payload = questions_list[question_number - 1]
        #     except Exception:
        #         q_payload = None

        q_payload = None
        presigned_url = None

        # 2. Database Question Lookup & Synchronization
        q_stmt = select(Question).where(
            Question.exam_id == exam.id,
            Question.question_number_in_paper == question_number,
        )
        q_res = await self.session.exec(q_stmt)
        q_model = q_res.first()

        if not q_model:
            # Fallback for papers with non-contiguous numbering: lookup question via attempt responses
            resp_order_stmt = (
                select(ExamQuestionResponse)
                .where(ExamQuestionResponse.attempt_id == attempt.id)
                .order_by(col(ExamQuestionResponse.id).asc())
            )
            all_attempt_resps = (await self.session.exec(resp_order_stmt)).all()
            if 1 <= question_number <= len(all_attempt_resps):
                target_q_id = all_attempt_resps[question_number - 1].question_id
                q_model = await self.session.get(Question, target_q_id)

        db_opts = []
        if q_model:
            opts_stmt = (
                select(QuestionOption)
                .where(QuestionOption.question_id == q_model.id)
                .order_by(col(QuestionOption.display_order))
            )
            opts_res = await self.session.exec(opts_stmt)
            db_opts = opts_res.all()

        if not q_payload:
            if q_model:
                from app.core.languages import normalize_language
                target_iso, target_enum = normalize_language(language)

                # Pre-load all existing translations for this question + its options into maps
                # so _ensure_translations_on_demand can detect "fake" translations (English text
                # stored in a Hindi/Marathi slot) and re-translate them correctly.
                pre_qt_map: Dict[int, Dict[str, str]] = {}
                pre_ot_map: Dict[int, Dict[str, Any]] = {}

                pre_q_trans_stmt = select(QuestionTranslation).where(QuestionTranslation.question_id == q_model.id)
                pre_q_trans_res = await self.session.exec(pre_q_trans_stmt)
                for t in pre_q_trans_res.all():
                    l_val = t.language.value if hasattr(t.language, "value") else str(t.language)
                    pre_qt_map.setdefault(q_model.id, {})[l_val] = t.question_text or ""
                    iso_c, _ = normalize_language(l_val)
                    if iso_c:
                        pre_qt_map[q_model.id][iso_c] = t.question_text or ""

                if db_opts:
                    pre_opt_trans_stmt = select(OptionTranslation).where(
                        col(OptionTranslation.option_id).in_([o.id for o in db_opts])
                    )
                    pre_opt_trans_res = await self.session.exec(pre_opt_trans_stmt)
                    for ot in pre_opt_trans_res.all():
                        l_val = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                        pre_ot_map.setdefault(ot.option_id, {})[l_val] = (ot.option_text or "", None)
                        iso_c, _ = normalize_language(l_val)
                        if iso_c:
                            pre_ot_map[ot.option_id][iso_c] = (ot.option_text or "", None)

                # On-demand translation for non-English targets (also fixes previously wrong translations)
                if target_enum != "ENGLISH":
                    from app.services.question_service import QuestionService
                    try:
                        q_svc = QuestionService(self.session)
                        await q_svc._ensure_translations_on_demand(
                            questions=[q_model],
                            options=db_opts,
                            passages=[],
                            target_iso=target_iso,
                            target_enum=target_enum,
                            qt_map=pre_qt_map,
                            ot_map=pre_ot_map,
                            pt_map={},
                        )
                    except Exception as trans_err:
                        logger.warning(f"On-demand translation warning for Q{q_model.id}: {trans_err}")

                # Re-query translations fresh from DB (the ensure call writes to a separate session)
                from app.db.session import async_session_factory
                async with async_session_factory() as fresh_session:
                    q_trans_stmt = select(QuestionTranslation).where(QuestionTranslation.question_id == q_model.id)
                    db_q_trans = (await fresh_session.exec(q_trans_stmt)).all()

                    opt_trans_by_option: Dict[int, list] = {}
                    if db_opts:
                        all_opt_trans_stmt = select(OptionTranslation).where(
                            col(OptionTranslation.option_id).in_([o.id for o in db_opts])
                        )
                        for ot in (await fresh_session.exec(all_opt_trans_stmt)).all():
                            opt_trans_by_option.setdefault(ot.option_id, []).append(ot)

                trans_map: Dict[str, Any] = {}
                for t in db_q_trans:
                    l_val = t.language.value if hasattr(t.language, "value") else str(t.language)
                    trans_map[l_val] = {"question_text": t.question_text}
                    iso_c, _ = normalize_language(l_val)
                    if iso_c:
                        trans_map[iso_c] = {"question_text": t.question_text}

                opts_list = []
                for o in db_opts:
                    db_opt_trans = opt_trans_by_option.get(o.id, [])
                    opt_trans_map: Dict[str, str] = {}
                    for ot in db_opt_trans:
                        l_name = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                        opt_trans_map[l_name] = ot.option_text
                        iso_c, _ = normalize_language(l_name)
                        if iso_c:
                            opt_trans_map[iso_c] = ot.option_text

                    # Pick the best available text for the requested target language
                    chosen_opt_text = (
                        opt_trans_map.get(target_enum)
                        or opt_trans_map.get(target_iso)
                        or opt_trans_map.get("ENGLISH")
                        or opt_trans_map.get("en")
                        or (db_opt_trans[0].option_text if db_opt_trans else f"Option {o.option_label}")
                    )
                    hi_text = opt_trans_map.get("HINDI") or opt_trans_map.get("hi")
                    mr_text = opt_trans_map.get("MARATHI") or opt_trans_map.get("mr")
                    opts_list.append({
                        "option_id": str(o.id),
                        "option_label": o.option_label,
                        "text": chosen_opt_text,
                        "text_hindi": hi_text,
                        "text_marathi": mr_text,
                        "display_order": o.display_order,
                        "translations": opt_trans_map,
                    })

                # Pick the best available question text for the requested target language
                chosen_q_text = (
                    (trans_map.get(target_enum) or {}).get("question_text")
                    or (trans_map.get(target_iso) or {}).get("question_text")
                    or (trans_map.get("ENGLISH") or {}).get("question_text")
                    or (trans_map.get("en") or {}).get("question_text")
                    or f"Question #{q_model.question_number_in_paper}"
                )
                q_hi_text = (trans_map.get("HINDI") or {}).get("question_text") or (trans_map.get("hi") or {}).get("question_text")
                q_mr_text = (trans_map.get("MARATHI") or {}).get("question_text") or (trans_map.get("mr") or {}).get("question_text")
                q_payload = {
                    "question_id": str(q_model.id),
                    "question_number": question_number,
                    "paper_question_number": q_model.question_number_in_paper,
                    "section_code": q_model.section_code or "GENERAL",
                    "text": chosen_q_text,
                    "text_hindi": q_hi_text,
                    "text_marathi": q_mr_text,
                    "translations": trans_map,
                    "options": opts_list,
                    "marks": q_model.marks,
                    "negative_marks": q_model.negative_marks,
                    "expected_time_seconds": q_model.expected_time_seconds or 60.0,
                }

        else:
            # Synchronize S3 payload with DB question and option IDs
            if q_model:
                q_payload["question_id"] = str(q_model.id)
                if db_opts and "options" in q_payload and isinstance(q_payload["options"], list):
                    db_opt_map = {o.option_label.upper(): o.id for o in db_opts if o.option_label}
                    for idx, o in enumerate(q_payload["options"], 1):
                        if isinstance(o, dict):
                            lbl = (o.get("option_label") or o.get("label") or chr(64 + idx)).strip().upper()
                            matched_id = db_opt_map.get(lbl)
                            if matched_id:
                                o["option_id"] = str(matched_id)
                                o["id"] = str(matched_id)
                            elif idx <= len(db_opts):
                                o["option_id"] = str(db_opts[idx - 1].id)
                                o["id"] = str(db_opts[idx - 1].id)

        # 3. If neither S3 nor Database has the question, throw 404
        if not q_payload:
            raise HTTPException(
                status_code=404,
                detail=f"QUESTION_NOT_FOUND: Question #{question_number} could not be retrieved from S3 or database.",
            )

        # Resolve DB question ID safely (never bind non-integer to BigInt column)
        resolved_db_qid = None
        if q_model:
            resolved_db_qid = q_model.id
        elif str(q_payload.get("question_id", "")).isdigit():
            resolved_db_qid = int(q_payload["question_id"])

        # Fetch DB response record
        resp = None
        if resolved_db_qid is not None:
            r_stmt = select(ExamQuestionResponse).where(
                ExamQuestionResponse.attempt_id == attempt.id,
                ExamQuestionResponse.question_id == resolved_db_qid,
            )
            r_res = await self.session.exec(r_stmt)
            resp = r_res.first()

        if not resp:
            all_res = await self.session.exec(
                select(ExamQuestionResponse)
                .where(ExamQuestionResponse.attempt_id == attempt.id)
                .order_by(col(ExamQuestionResponse.created_at).asc(), col(ExamQuestionResponse.id).asc())
            )
            all_resps = all_res.all()
            if 1 <= question_number <= len(all_resps):
                resp = all_resps[question_number - 1]
                if resp and not resolved_db_qid:
                    q_payload["question_id"] = str(resp.question_id)

        if resp:
            resp.visited_count += 1
            if resp.question_status == QuestionResponseStatus.UNVISITED:
                resp.question_status = QuestionResponseStatus.VISITED
            self.session.add(resp)

        attempt.current_question_index = question_number
        self.session.add(attempt)
        await self.session.commit()

        return self._build_question_nav_response(
            q_item=q_payload,
            nav_current=question_number,
            nav_total=attempt.total_questions,
            resp=resp,
            language=language,
            presigned_url=presigned_url,
        )

    def _build_question_nav_response(
        self,
        q_item: Dict[str, Any],
        nav_current: int,
        nav_total: int,
        resp: Optional[ExamQuestionResponse],
        language: Optional[str] = "ENGLISH",
        presigned_url: Optional[str] = None,
    ) -> QuestionNavResponse:
        raw_opts = q_item.get("options", [])
        opts_out = []
        for idx, o in enumerate(raw_opts, 1):
            if isinstance(o, dict):
                opts_out.append(
                    OptionOut(
                        option_id=str(o.get("option_id") or o.get("id") or idx),
                        option_label=o.get("option_label") or o.get("label") or chr(64 + idx),
                        text=o.get("text") or o.get("option_text") or f"Option {chr(64 + idx)}",
                        display_order=o.get("display_order") or idx,
                        translations=o.get("translations"),
                        text_hindi=o.get("text_hindi") or o.get("option_text_hindi"),
                    )
                )
            elif isinstance(o, str):
                opts_out.append(
                    OptionOut(
                        option_id=str(idx),
                        option_label=chr(64 + idx),
                        text=o,
                        display_order=idx,
                    )
                )

        q_id_val = str(q_item.get("question_id") or (resp.question_id if resp else nav_current))

        q_out = QuestionOut(
            question_id=q_id_val,
            question_number=q_item.get("question_number") or nav_current,
            text=q_item.get("text") or q_item.get("question_text") or "",
            options=opts_out,
            subject=q_item.get("subject", "General Knowledge"),
            topic=q_item.get("topic", "General Studies"),
            subtopic=q_item.get("subtopic", "Core Concepts"),
            difficulty=q_item.get("difficulty", "MEDIUM"),
            marks=float(q_item.get("marks", 2.0)),
            negative_marks=float(q_item.get("negative_marks", 0.66)),
            expected_time_seconds=int(q_item.get("expected_time_seconds", 60)),
            section_code=q_item.get("section_code", "DEFAULT"),
            has_image=bool(q_item.get("has_image", False)),
            assets=q_item.get("assets", []),
            passage_text=q_item.get("passage_text") or q_item.get("passage"),
            translations=q_item.get("translations"),
            passage_translations=q_item.get("passage_translations"),
            text_hindi=q_item.get("text_hindi") or q_item.get("question_text_hindi"),
            passage_text_hindi=q_item.get("passage_text_hindi"),
        )

        nav_meta = NavigationMeta(
            current=nav_current,
            total=nav_total,
            has_next=nav_current < nav_total,
            has_prev=nav_current > 1,
        )

        resp_state = ResponseState(
            selected_option_id=str(resp.selected_option_id) if (resp and resp.selected_option_id is not None) else None,
            is_marked_for_review=resp.is_marked_for_review if resp else False,
            time_spent_seconds=resp.time_taken_seconds if resp else 0.0,
            question_status=resp.question_status if resp else QuestionResponseStatus.UNVISITED,
            answer_revealed=resp.answer_revealed if resp else False,
        )

        return QuestionNavResponse(
            question=q_out,
            navigation=nav_meta,
            response_state=resp_state,
            presigned_url=presigned_url,
        )

    async def get_all_questions_bulk(
        self,
        attempt_id: int | str,
        user_id: int,
        language: Optional[str] = "ENGLISH",
    ) -> Dict[str, Any]:
        """
        Loads all questions for an attempt in bulk.
        Checks master JSON -> folder JSONs -> dynamic DB fallback via ExamJsonBuilder.
        Synchronizes all question and option IDs with the database BigInt IDs.
        """
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        exam = await self.session.get(Exam, attempt.exam_id)
        if not exam:
            raise HTTPException(
                status_code=404, detail="EXAM_NOT_FOUND: Associated exam not found."
            )

        # 1. Direct High-Performance Database Query (Loads all questions for the exam without solutions)
        from app.services.exam_json_builder import ExamJsonBuilder
        builder = ExamJsonBuilder(self.session)

        stmt = (
            select(Question)
            .where(Question.exam_id == exam.id)
            .order_by(col(Question.question_number_in_paper))
        )
        res = await self.session.exec(stmt)
        questions = res.all()

        if questions:
            preloaded_data = await builder.preload_batch_question_data(
                questions, include_solution_data=False, target_language=language
            )
            questions_payload = []
            for q in questions:
                # q_card contains question text, metadata, and options WITHOUT is_correct or solutions
                q_card, _ = await builder.build_single_question_cards(
                    q, preloaded=preloaded_data, include_solution_data=False, target_language=language
                )
                questions_payload.append(q_card)

            return {
                "exam_id": str(exam.id),
                "exam_code": exam.code,
                "total_questions": len(questions_payload),
                "questions": questions_payload,
            }

        # --- S3 Storage Fallback Logic Commented Out (PostgreSQL DB is used as single source of truth) ---
        # q_json_path = exam.questions_json_path or f"exams/{exam.code}/exam_questions.json"
        # try:
        #     if await self.storage.exists(q_json_path):
        #         doc = await self.storage.download_json(q_json_path)
        #         if doc and doc.get("questions"):
        #             doc["questions"] = _sync_question_ids(doc["questions"])
        #             return doc
        # except Exception as err:
        #     logger.debug(f"Master questions json load failed: {err}")
        #
        # paper_set = exam.paper_set_code or "SET_A"
        # clean_set = str(paper_set).strip().lower().replace("_", "-")
        # q_folder = exam.questions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/questions"
        # alt_q_folder = f"exams/{exam.code}/questions"
        # try:
        #     q_count = attempt.total_questions or exam.total_questions or 100
        #     async def _fetch_single_q(q_num: int):
        #         for q_prefix in [q_folder, alt_q_folder]:
        #             for pattern in [f"Q{q_num:03d}.json", f"Q{q_num:03d} Question.json", f"Q{q_num}.json"]:
        #                 q_file = f"{q_prefix.rstrip('/')}/{pattern}"
        #                 try:
        #                     if await self.storage.exists(q_file):
        #                         q_data = await self.storage.download_json(q_file)
        #                         if q_data and isinstance(q_data, dict):
        #                             q_data["question_number"] = q_data.get("question_number") or q_num
        #                             q_data["text"] = q_data.get("text") or q_data.get("question_text")
        #                             return q_data
        #                 except Exception:
        #                     pass
        #         return None
        #
        #     q_tasks = [_fetch_single_q(i) for i in range(1, q_count + 1)]
        #     q_results = await asyncio.gather(*q_tasks, return_exceptions=True)
        #     q_list = [r for r in q_results if isinstance(r, dict) and r]
        #     if q_list:
        #         q_list = _sync_question_ids(q_list)
        #         return {
        #             "exam_id": str(exam.id),
        #             "exam_code": exam.code,
        #             "total_questions": len(q_list),
        #             "questions": q_list,
        #         }
        # except Exception as err:
        #     logger.debug(f"Folder questions load failed: {err}")

        return {
            "exam_id": str(exam.id),
            "exam_code": exam.code,
            "total_questions": 0,
            "questions": [],
        }

    async def save_response(
        self, attempt_id: int | str, user_id: int, req: SaveResponseRequest
    ) -> SaveResponseResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_ALREADY_SUBMITTED: Attempt is no longer in progress."
            )

        # Resolve question_id safely
        q_id = None
        if req.question_id is not None:
            try:
                q_id = int(req.question_id)
            except (ValueError, TypeError):
                q_id = None

        # Resolve selected_option_id safely
        opt_id = None
        if req.selected_option_id is not None:
            try:
                opt_id = int(req.selected_option_id)
            except (ValueError, TypeError):
                opt_id = None

        resp = None
        if q_id is not None:
            r_stmt = select(ExamQuestionResponse).where(
                ExamQuestionResponse.attempt_id == attempt.id,
                ExamQuestionResponse.question_id == q_id,
            )
            r_res = await self.session.exec(r_stmt)
            resp = r_res.first()

        if not resp:
            all_res = await self.session.exec(
                select(ExamQuestionResponse)
                .where(ExamQuestionResponse.attempt_id == attempt.id)
                .order_by(col(ExamQuestionResponse.created_at).asc(), col(ExamQuestionResponse.id).asc())
            )
            all_responses = all_res.all()
            if 1 <= attempt.current_question_index <= len(all_responses):
                resp = all_responses[attempt.current_question_index - 1]
            elif all_responses:
                resp = all_responses[0]

        if not resp:
            raise HTTPException(
                status_code=422, detail="INVALID_QUESTION_ID: Question does not belong to this exam attempt."
            )

        # If opt_id is still None but selected_option_id string (e.g. 'A', 'B', 'C', 'D') was sent
        if opt_id is None and req.selected_option_id is not None and resp.question_id:
            lbl_str = str(req.selected_option_id).strip().upper()
            if len(lbl_str) <= 2:
                opt_obj = (await self.session.exec(
                    select(QuestionOption).where(
                        QuestionOption.question_id == resp.question_id,
                        QuestionOption.option_label == lbl_str,
                    )
                )).first()
                if opt_obj:
                    opt_id = opt_obj.id

        prev_opt_id = resp.selected_option_id

        # Update options and tracking
        if req.selected_option_id is not None:
            if resp.selected_option_id is None:
                resp.initial_option_id = opt_id
                resp.selected_option_id = opt_id
            elif resp.selected_option_id != opt_id:
                resp.selected_option_id = opt_id
                resp.is_switched = True
                resp.option_switch_count += 1
        else:
            resp.selected_option_id = None

        resp.is_marked_for_review = req.is_marked_for_review
        resp.time_taken_seconds = max(0.0, req.time_spent_seconds)
        if req.option_switch_count > resp.option_switch_count:
            resp.option_switch_count = req.option_switch_count

        # Compute status
        if resp.selected_option_id is not None:
            resp.question_status = (
                QuestionResponseStatus.ANSWERED_AND_MARKED
                if req.is_marked_for_review
                else QuestionResponseStatus.ANSWERED
            )
        else:
            resp.question_status = (
                QuestionResponseStatus.MARKED_FOR_REVIEW
                if req.is_marked_for_review
                else QuestionResponseStatus.VISITED
            )

        # Real-time scoring and closeness evaluation for visited question
        try:
            exam_obj = await self.session.get(Exam, attempt.exam_id)
            if exam_obj and resp.selected_option_id:
                sol_doc = await load_exam_solutions_data(exam_obj, self.session, self.storage)
                sol_list = sol_doc.get("questions", [])
                sol_map = {str(s.get("question_id")): s for s in sol_list if "question_id" in s}
                sol_num_map = {int(s["question_number"]): s for s in sol_list if s.get("question_number") is not None}
                
                q_sol = sol_map.get(str(resp.question_id))
                if not q_sol and resp.question_id:
                    q_model = await self.session.get(Question, resp.question_id)
                    if q_model and q_model.question_number_in_paper:
                        q_sol = sol_num_map.get(int(q_model.question_number_in_paper))

                if q_sol:
                    correct_opt_id = q_sol.get("correct_option_id")
                    is_corr = str(resp.selected_option_id) == str(correct_opt_id) if correct_opt_id else False
                    distractors = q_sol.get("distractor_scores", {})
                    user_dist = distractors.get(str(resp.selected_option_id), {})
                    c_score = float(user_dist.get("closeness_score", 1.0 if is_corr else 0.0))

                    resp.is_correct = is_corr
                    resp.closeness_score_awarded = c_score

                    irt_p = q_sol.get("irt_params", {"a": 1.5, "b": 0.0, "c": 0.25})
                    resp.gti_item_score = GuessingTendencyStrategy.compute_item_guessing(
                        time_taken_sec=resp.time_taken_seconds,
                        expected_time_sec=resp.expected_time_seconds or 60.0,
                        option_closeness=c_score,
                        is_correct=is_corr,
                        irt_difficulty_b=float(irt_p.get("b", 0.0)),
                        irt_pseudo_guessing_c=float(irt_p.get("c", 0.25)),
                    )

                    scoring_eval = TimeTieredScoringStrategy.calculate_score(
                        is_correct=is_corr,
                        time_taken_sec=resp.time_taken_seconds,
                        expected_time_sec=resp.expected_time_seconds or 60.0,
                        closeness_score=c_score,
                    )
                    resp.final_score = scoring_eval["final_score"]
        except Exception as eval_err:
            logger.debug(f"Real-time evaluation pass skipped: {eval_err}")

        self.session.add(resp)

        # Sync UserQuestionResponse & Log QuestionSwitchLog
        u_resp_res = await self.session.exec(
            select(UserQuestionResponse).where(UserQuestionResponse.exam_response_id == resp.id)
        )
        u_resp = u_resp_res.first()
        if u_resp:
            u_resp.selected_option_id = resp.selected_option_id
            u_resp.initial_selected_option_id = resp.initial_option_id
            u_resp.option_switch_count = resp.option_switch_count
            u_resp.time_taken_seconds = int(resp.time_taken_seconds)
            u_resp.is_flagged_for_review = resp.is_marked_for_review
            self.session.add(u_resp)

        if prev_opt_id != resp.selected_option_id:
            switch_log = QuestionSwitchLog(
                response_id=u_resp.id if u_resp else None,
                exam_response_id=resp.id,
                from_option_id=prev_opt_id,
                to_option_id=resp.selected_option_id,
                timestamp_offset_sec=int(resp.time_taken_seconds),
                created_at=datetime.now(timezone.utc),
            )
            self.session.add(switch_log)
        await self.session.commit()

        summary = await self._compute_response_summary(attempt.id)
        return SaveResponseResponse(
            status="SAVED",
            saved_at=datetime.now(timezone.utc),
            response_summary=summary,
        )

    async def save_responses_batch(
        self,
        attempt_id: int | str,
        user_id: int,
        req: BatchSaveResponseRequest,
    ) -> BatchSaveResponseAck:
        """
        Asynchronously persists a batch of user responses with tracking batch_id and zero data loss.
        """
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_ALREADY_SUBMITTED: Attempt is no longer in progress."
            )

        batch_key = str(req.batch_id)
        BATCH_TRACKER[batch_key] = {
            "batch_id": batch_key,
            "attempt_id": str(attempt_id),
            "status": "ACCEPTED",
            "received_count": len(req.responses),
            "processed_count": 0,
            "error": None,
            "updated_at": datetime.now(timezone.utc),
        }

        logger.info(f"[BATCH:INGEST_START] Ingesting batch '{batch_key}' with {len(req.responses)} responses for attempt {attempt_id}")

        try:
            # Preload all exam responses for this attempt in 1 query
            eq_res = await self.session.exec(
                select(ExamQuestionResponse)
                .where(ExamQuestionResponse.attempt_id == attempt.id)
                .order_by(col(ExamQuestionResponse.created_at).asc(), col(ExamQuestionResponse.id).asc())
            )
            all_resps = eq_res.all()
            resp_by_qid = {r.question_id: r for r in all_resps}

            # Batch preload solutions & exam once (not in loop)
            sol_map: Dict[str, Any] = {}
            sol_num_map: Dict[int, Any] = {}
            try:
                exam_obj = await self.session.get(Exam, attempt.exam_id)
                if exam_obj:
                    sol_doc = await load_exam_solutions_data(exam_obj, self.session, self.storage)
                    sol_list = sol_doc.get("questions", [])
                    sol_map = {str(s.get("question_id")): s for s in sol_list if "question_id" in s}
                    sol_num_map = {int(s["question_number"]): s for s in sol_list if s.get("question_number") is not None}
            except Exception as e_load_err:
                logger.debug(f"Batch sol load skipped: {e_load_err}")

            # Batch preload UserQuestionResponses in 1 single query
            all_resp_ids = [r.id for r in all_resps if r.id]
            u_resp_map: Dict[int, UserQuestionResponse] = {}
            if all_resp_ids:
                u_resp_res = await self.session.exec(
                    select(UserQuestionResponse).where(col(UserQuestionResponse.exam_response_id).in_(all_resp_ids))
                )
                u_resp_map = {u.exam_response_id: u for u in u_resp_res.all() if u.exam_response_id}

            # Batch preload QuestionOption mappings for label-to-id resolution in 1 single query
            all_q_ids = list({r.question_id for r in all_resps if r.question_id})
            for item in req.responses:
                if item.question_id is not None:
                    try:
                        all_q_ids.append(int(item.question_id))
                    except (ValueError, TypeError):
                        pass
            all_q_ids = list(set(all_q_ids))
            opt_label_map: Dict[Tuple[int, str], int] = {}
            if all_q_ids:
                opts_res = await self.session.exec(
                    select(QuestionOption).where(col(QuestionOption.question_id).in_(all_q_ids))
                )
                for opt in opts_res.all():
                    if opt.option_label and opt.id is not None and opt.question_id is not None:
                        opt_label_map[(opt.question_id, opt.option_label.strip().upper())] = opt.id

            switch_logs_to_add: List[QuestionSwitchLog] = []

            for idx, item in enumerate(req.responses):
                q_id = None
                if item.question_id is not None:
                    try:
                        q_id = int(item.question_id)
                    except (ValueError, TypeError):
                        q_id = None

                resp = resp_by_qid.get(q_id) if q_id is not None else None
                if not resp and idx < len(all_resps):
                    resp = all_resps[idx]

                if not resp:
                    continue

                opt_id = None
                if item.selected_option_id is not None:
                    try:
                        opt_id = int(item.selected_option_id)
                    except (ValueError, TypeError):
                        opt_id = None

                # Fallback to label lookup from preloaded in-memory map
                if opt_id is None and item.selected_option_id is not None and resp.question_id:
                    lbl_str = str(item.selected_option_id).strip().upper()
                    if len(lbl_str) <= 2:
                        opt_id = opt_label_map.get((resp.question_id, lbl_str))

                prev_opt_id = resp.selected_option_id

                if item.selected_option_id is not None:
                    if resp.selected_option_id is None:
                        resp.initial_option_id = opt_id
                        resp.selected_option_id = opt_id
                    elif resp.selected_option_id != opt_id:
                        resp.selected_option_id = opt_id
                        resp.is_switched = True
                        resp.option_switch_count += 1
                else:
                    resp.selected_option_id = None

                resp.is_marked_for_review = item.is_marked_for_review
                resp.time_taken_seconds = max(resp.time_taken_seconds, float(item.time_spent_seconds or 0.0))
                if item.option_switch_count > resp.option_switch_count:
                    resp.option_switch_count = item.option_switch_count

                if resp.selected_option_id is not None:
                    resp.question_status = (
                        QuestionResponseStatus.ANSWERED_AND_MARKED
                        if item.is_marked_for_review
                        else QuestionResponseStatus.ANSWERED
                    )
                else:
                    resp.question_status = (
                        QuestionResponseStatus.MARKED_FOR_REVIEW
                        if item.is_marked_for_review
                        else QuestionResponseStatus.VISITED
                    )

                # Real-time scoring and closeness evaluation in-memory
                if resp.selected_option_id and sol_map:
                    q_sol = sol_map.get(str(resp.question_id))
                    if q_sol:
                        correct_opt_id = q_sol.get("correct_option_id")
                        is_corr = str(resp.selected_option_id) == str(correct_opt_id) if correct_opt_id else False
                        distractors = q_sol.get("distractor_scores", {})
                        user_dist = distractors.get(str(resp.selected_option_id), {})
                        c_score = float(user_dist.get("closeness_score", 1.0 if is_corr else 0.0))

                        resp.is_correct = is_corr
                        resp.closeness_score_awarded = c_score

                        irt_p = q_sol.get("irt_params", {"a": 1.5, "b": 0.0, "c": 0.25})
                        resp.gti_item_score = GuessingTendencyStrategy.compute_item_guessing(
                            time_taken_sec=resp.time_taken_seconds,
                            expected_time_sec=resp.expected_time_seconds or 60.0,
                            option_closeness=c_score,
                            is_correct=is_corr,
                            irt_difficulty_b=float(irt_p.get("b", 0.0)),
                            irt_pseudo_guessing_c=float(irt_p.get("c", 0.25)),
                        )

                        scoring_eval = TimeTieredScoringStrategy.calculate_score(
                            is_correct=is_corr,
                            time_taken_sec=resp.time_taken_seconds,
                            expected_time_sec=resp.expected_time_seconds or 60.0,
                            closeness_score=c_score,
                        )
                        resp.final_score = scoring_eval["final_score"]

                self.session.add(resp)

                u_resp = u_resp_map.get(resp.id)
                if u_resp:
                    u_resp.selected_option_id = resp.selected_option_id
                    u_resp.initial_selected_option_id = resp.initial_option_id
                    u_resp.option_switch_count = resp.option_switch_count
                    u_resp.time_taken_seconds = int(resp.time_taken_seconds)
                    u_resp.is_flagged_for_review = resp.is_marked_for_review
                    self.session.add(u_resp)

                if prev_opt_id != resp.selected_option_id:
                    switch_logs_to_add.append(
                        QuestionSwitchLog(
                            response_id=u_resp.id if u_resp else None,
                            exam_response_id=resp.id,
                            from_option_id=prev_opt_id,
                            to_option_id=resp.selected_option_id,
                            timestamp_offset_sec=int(resp.time_taken_seconds),
                            created_at=item.client_timestamp or datetime.now(timezone.utc),
                        )
                    )

            if switch_logs_to_add:
                self.session.add_all(switch_logs_to_add)

            await self.session.flush()
            await self.session.commit()

            BATCH_TRACKER[batch_key]["status"] = "PROCESSED"
            BATCH_TRACKER[batch_key]["processed_count"] = len(req.responses)
            BATCH_TRACKER[batch_key]["updated_at"] = datetime.now(timezone.utc)

            # Instant in-memory summary calculation without extra DB queries
            ans_count = sum(1 for r in all_resps if r.selected_option_id is not None)
            mrk_count = sum(1 for r in all_resps if r.is_marked_for_review)
            tot_count = len(all_resps) or attempt.total_questions
            unatt_count = max(0, tot_count - ans_count)

            summary = ResponseSummary(
                answered_count=ans_count,
                marked_for_review_count=mrk_count,
                unattempted_count=unatt_count,
                total=tot_count,
            )
            logger.info(f"[BATCH:INGEST_SUCCESS] Successfully persisted batch '{batch_key}' ({len(req.responses)} items). Answered={summary.answered_count}, Marked={summary.marked_for_review_count}")

            return BatchSaveResponseAck(
                batch_id=batch_key,
                status="PROCESSED",
                received_count=len(req.responses),
                response_summary=summary,
            )
        except Exception as e:
            logger.error(f"[BATCH:INGEST_ERROR] Failed to persist batch '{batch_key}': {e}", exc_info=True)
            BATCH_TRACKER[batch_key]["status"] = "FAILED"
            BATCH_TRACKER[batch_key]["error"] = str(e)
            BATCH_TRACKER[batch_key]["updated_at"] = datetime.now(timezone.utc)
            raise HTTPException(
                status_code=500, detail=f"BATCH_PROCESSING_FAILED: {str(e)}"
            )

    def get_batch_status(self, batch_id: str) -> BatchStatusResponse:
        logger.info(f"[BATCH:STATUS_CHECK] Checking status for batch '{batch_id}'")
        info = BATCH_TRACKER.get(str(batch_id))
        if not info:
            return BatchStatusResponse(
                batch_id=str(batch_id),
                status="PROCESSED",
                processed_count=0,
                error=None,
                updated_at=datetime.now(timezone.utc),
            )
        return BatchStatusResponse(
            batch_id=info["batch_id"],
            status=info["status"],
            processed_count=info.get("processed_count", 0),
            error=info.get("error"),
            updated_at=info.get("updated_at", datetime.now(timezone.utc)),
        )


    async def reveal_answer(
        self, attempt_id: int | str, user_id: int, question_id: int | str
    ) -> RevealAnswerResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_ALREADY_SUBMITTED: Attempt is no longer in progress."
            )

        if attempt.mode == AttemptMode.EXAM:
            raise HTTPException(
                status_code=403,
                detail="REVEAL_BLOCKED_IN_EXAM_MODE: Answer reveal is blocked in real EXAM simulation mode.",
            )

        q_id = None
        if question_id is not None:
            try:
                q_id = int(question_id)
            except (ValueError, TypeError):
                q_id = None

        resp = None
        if q_id is not None:
            r_stmt = select(ExamQuestionResponse).where(
                ExamQuestionResponse.attempt_id == attempt.id,
                ExamQuestionResponse.question_id == q_id,
            )
            r_res = await self.session.exec(r_stmt)
            resp = r_res.first()

        if not resp:
            all_res = await self.session.exec(
                select(ExamQuestionResponse)
                .where(ExamQuestionResponse.attempt_id == attempt.id)
                .order_by(col(ExamQuestionResponse.created_at).asc(), col(ExamQuestionResponse.id).asc())
            )
            all_resps = all_res.all()
            if 1 <= attempt.current_question_index <= len(all_resps):
                resp = all_resps[attempt.current_question_index - 1]
            elif all_resps:
                resp = all_resps[0]
            if resp:
                q_id = resp.question_id

        if not resp or resp.selected_option_id is None:
            raise HTTPException(
                status_code=422,
                detail="NO_OPTION_SELECTED: You must select an option before revealing the answer.",
            )

        exam = await self.session.get(Exam, attempt.exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND: Associated exam not found.")

        q_model = await self.session.get(Question, resp.question_id) if resp.question_id else None
        q_num = q_model.question_number_in_paper if q_model else attempt.current_question_index

        # --- S3 Solutions Storage Commented Out (Using Direct PostgreSQL DB) ---
        # paper_set = exam.paper_set_code or "SET_A"
        # clean_set = str(paper_set).strip().lower().replace("_", "-")
        # s_folder = exam.solutions_json_folder_path or f"artifacts/{exam.code}/{clean_set}/json/solutions"
        # s_filename = f"Q{q_num:03d}.json"
        # s3_indiv_sol_path = f"{s_folder.rstrip('/')}/{s_filename}"
        # s_json_path = exam.solutions_json_path or f"exams/{exam.code}/exam_solutions.json"
        #
        # q_sol = None
        # try:
        #     if await self.storage.exists(s3_indiv_sol_path):
        #         q_sol = await self.storage.download_json(s3_indiv_sol_path)
        # except Exception:
        #     q_sol = None
        #
        # if not q_sol:
        #     try:
        #         if await self.storage.exists(s_json_path):
        #             solutions_doc = await self.storage.download_json(s_json_path)
        #             sol_list = solutions_doc.get("questions", [])
        #             q_sol = next((s for s in sol_list if str(s.get("question_id")) == str(resp.question_id)), None)
        #             if not q_sol and q_num:
        #                 q_sol = next((s for s in sol_list if s.get("question_number") == q_num), None)
        #     except Exception:
        #         q_sol = None

        q_sol = None

        # 2. Database Query for Solution & Distractor Analysis
        if not q_sol:
            if not q_model:
                raise HTTPException(status_code=404, detail="Question not found in S3 or database.")
            opts_res = await self.session.exec(
                select(QuestionOption)
                .where(QuestionOption.question_id == q_model.id)
                .order_by(col(QuestionOption.display_order).asc())
            )
            db_opts = opts_res.all()
            correct_opt = next((o for o in db_opts if o.is_correct), None)
            if not correct_opt:
                raise HTTPException(status_code=404, detail="Correct option not configured for this question.")

            opt_ids = [o.id for o in db_opts]
            trans_by_opt = {}
            qr_by_opt = {}
            if opt_ids:
                t_stmt = select(OptionTranslation).where(OptionTranslation.option_id.in_(opt_ids))
                t_res = (await self.session.exec(t_stmt)).all()
                for t in t_res:
                    existing = trans_by_opt.get(t.option_id)
                    if not existing:
                        trans_by_opt[t.option_id] = t
                    elif t.language == LanguageCode.ENGLISH or (t.distractor_analysis and not existing.distractor_analysis):
                        trans_by_opt[t.option_id] = t

                qr_stmt = select(QuestionOptionReasoning).where(QuestionOptionReasoning.question_option_id.in_(opt_ids))
                qr_res = (await self.session.exec(qr_stmt)).all()
                qr_by_opt = {qr.question_option_id: qr for qr in qr_res}

            expl_res = await self.session.exec(
                select(QuestionExplanation).where(QuestionExplanation.question_id == q_model.id)
            )
            db_expl = expl_res.first()
            detailed_sol = (
                db_expl.detailed_solution
                if (db_expl and db_expl.detailed_solution)
                else f"**Option ({correct_opt.option_label}) is correct.**\n\nStandard constitutional and syllabus reasoning."
            )
            core_concept = db_expl.core_concept if (db_expl and db_expl.core_concept) else "Core conceptual analysis"
            common_traps = (
                db_expl.common_traps_json
                if (db_expl and db_expl.common_traps_json)
                else ([db_expl.common_mistake] if (db_expl and db_expl.common_mistake) else [])
            )
            key_takeaways = db_expl.key_takeaways_json if (db_expl and db_expl.key_takeaways_json) else []

            expl_dict = {
                "detailed_solution": detailed_sol,
                "detailed_text": detailed_sol,
                "text": detailed_sol,
                "core_concept": core_concept,
                "common_traps": common_traps,
                "traps": common_traps,
                "key_takeaways": key_takeaways,
                "key_takeaway": key_takeaways[0] if key_takeaways else (db_expl.common_mistake or ""),
            }

            distractor_map = {}
            for o in db_opts:
                t = trans_by_opt.get(o.id)
                qr = qr_by_opt.get(o.id)
                da = None
                if t and t.distractor_analysis:
                    da = t.distractor_analysis
                elif qr:
                    why_t = (qr.why_tempting or "").strip()
                    whats_t = (qr.whats_actually_true or "").strip()
                    if why_t and whats_t:
                        da = f"Why it seems tempting — {why_t}\n\nWhat's actually true — {whats_t}"
                    elif whats_t:
                        da = whats_t
                    elif why_t:
                        da = why_t

                c_score = o.closeness_score if o.closeness_score is not None else (1.0 if o.is_correct else 0.0)
                opt_text = t.option_text if t else f"Option {o.option_label}"

                distractor_map[str(o.id)] = {
                    "option_id": str(o.id),
                    "label": o.option_label,
                    "text": opt_text,
                    "closeness_score": c_score,
                    "is_correct": o.is_correct,
                    "classification": ClosenessEvaluator.classify_option(c_score),
                    "distractor_analysis": da or "",
                    "analysis": da or "",
                }

            q_sol = {
                "question_id": str(q_model.id),
                "question_number": q_model.question_number_in_paper,
                "correct_option_id": str(correct_opt.id),
                "correct_option_label": correct_opt.option_label,
                "distractor_scores": distractor_map,
                "explanation": expl_dict,
            }

        if not q_sol:
            raise HTTPException(status_code=404, detail="Solution record not found for this question.")

        correct_opt_id = str(q_sol["correct_option_id"])
        user_opt_id = str(resp.selected_option_id)
        is_corr = user_opt_id == correct_opt_id

        distractors = q_sol.get("distractor_scores", {})
        user_dist = distractors.get(user_opt_id, {})
        c_score = float(user_dist.get("closeness_score", 1.0 if is_corr else 0.0))
        c_class = ClosenessEvaluator.classify_option(c_score)

        user_label = user_dist.get("label", "A")

        # Update DB response record immediately
        resp.answer_revealed = True
        resp.is_correct = is_corr
        resp.closeness_score_awarded = c_score

        scoring_eval = TimeTieredScoringStrategy.calculate_score(
            is_correct=is_corr,
            time_taken_sec=resp.time_taken_seconds,
            expected_time_sec=resp.expected_time_seconds,
            closeness_score=c_score,
        )
        resp.final_score = scoring_eval["final_score"]

        self.session.add(resp)
        await self.session.commit()

        return RevealAnswerResponse(
            question_id=str(question_id),
            question_number=q_sol.get("question_number", 1),
            correct_option_id=correct_opt_id,
            correct_option_label=q_sol.get("correct_option_label", "A"),
            is_user_correct=is_corr,
            user_selected_option_id=user_opt_id,
            user_selected_label=user_label,
            marks_awarded=resp.final_score,
            closeness_score=c_score,
            closeness_classification=c_class,
            explanation=q_sol.get("explanation", {}),
            distractor_scores=distractors,
        )

    async def heartbeat(
        self, attempt_id: int | str, user_id: int, req: HeartbeatRequest
    ) -> HeartbeatResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_ALREADY_SUBMITTED: Attempt is no longer in progress."
            )

        now_dt = datetime.now(timezone.utc)
        start_dt = attempt.started_at.replace(tzinfo=timezone.utc) if attempt.started_at.tzinfo is None else attempt.started_at
        elapsed = (now_dt - start_dt).total_seconds()

        server_remaining = max(0, attempt.max_duration_seconds - int(elapsed))
        final_remaining = min(req.remaining_time_seconds, server_remaining)

        attempt.time_spent_seconds = elapsed
        self.session.add(attempt)
        await self.session.commit()

        # Check for auto-submit
        if final_remaining <= 0:
            submit_res = await self.submit_exam(
                attempt_id=attempt.id,
                user_id=user_id,
                req=SubmitExamRequest(submission_reason="TIMER_EXPIRED"),
            )
            return HeartbeatResponse(
                server_time=now_dt,
                remaining_time_seconds=0,
                status=AttemptStatus.SUBMITTED,
                auto_submitted=True,
                submission_summary=submit_res,
            )

        return HeartbeatResponse(
            server_time=now_dt,
            remaining_time_seconds=final_remaining,
            status=attempt.status,
            auto_submitted=False,
        )

    async def get_exam_status(
        self, attempt_id: int | str, user_id: int
    ) -> ExamStatusResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        exam = await self.session.get(Exam, attempt.exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND: Associated exam not found.")

        now_dt = datetime.now(timezone.utc)
        start_dt = attempt.started_at.replace(tzinfo=timezone.utc) if attempt.started_at.tzinfo is None else attempt.started_at
        elapsed = (now_dt - start_dt).total_seconds()
        remaining = max(0, attempt.max_duration_seconds - int(elapsed)) if attempt.status == AttemptStatus.IN_PROGRESS else 0

        # Fetch responses & palette
        resp_res = await self.session.exec(
            select(ExamQuestionResponse)
            .where(ExamQuestionResponse.attempt_id == attempt.id)
            .order_by(col(ExamQuestionResponse.created_at).asc())
        )
        responses = resp_res.all()

        palette = []
        for index, r in enumerate(responses, 1):
            palette.append(
                QuestionPaletteItem(
                    question_number=index,
                    question_id=str(r.question_id),
                    question_status=r.question_status,
                )
            )

        summary = await self._compute_response_summary(attempt.id)

        return ExamStatusResponse(
            attempt_id=str(attempt.id),
            exam_id=str(exam.id),
            exam_name=exam.name,
            status=attempt.status,
            mode=attempt.mode,
            started_at=attempt.started_at,
            max_duration_seconds=attempt.max_duration_seconds,
            remaining_seconds=remaining,
            current_question_index=attempt.current_question_index,
            total_questions=attempt.total_questions,
            response_summary=summary,
            palette=palette,
            questions_presigned_url=None,
            questions_folder_url=None,
        )

    async def submit_exam(
        self,
        attempt_id: int | str,
        user_id: int,
        req: SubmitExamRequest,
        background_tasks: Optional[BackgroundTasks] = None,
    ) -> SubmitExamResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)

        # Parameter 7: Idempotency Check
        if attempt.status in (AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED):
            acc_pct = round((attempt.total_correct / max(1, attempt.total_questions)) * 100.0, 1)
            eval_stat = "COMPLETED" if attempt.status == AttemptStatus.EVALUATED else "PROCESSING"
            return SubmitExamResponse(
                attempt_id=str(attempt.id),
                status=attempt.status,
                submitted_at=attempt.submitted_at or datetime.now(timezone.utc),
                submission_reason=attempt.submission_reason or "USER_CLICKED_SUBMIT",
                raw_score=attempt.total_score,
                max_score=attempt.max_possible_score,
                accuracy_percentage=acc_pct,
                correct_count=attempt.total_correct,
                incorrect_count=attempt.total_incorrect,
                unattempted_count=attempt.total_unattempted,
                time_taken_seconds=attempt.time_spent_seconds,
                max_duration_seconds=attempt.max_duration_seconds,
                evaluation_status=eval_stat,
                evaluation_message="Attempt has already been submitted and processed.",
            )

        exam = await self.session.get(Exam, attempt.exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND: Associated exam not found.")

        now_dt = datetime.now(timezone.utc)
        start_dt = attempt.started_at.replace(tzinfo=timezone.utc) if attempt.started_at.tzinfo is None else attempt.started_at
        total_time_spent = (now_dt - start_dt).total_seconds()
        server_remaining = attempt.max_duration_seconds - int(total_time_spent)

        # Parameter 12: Validate submission_reason server-side
        final_reason = req.submission_reason
        if final_reason == "TIMER_EXPIRED" and server_remaining > 10:
            final_reason = "USER_CLICKED_SUBMIT"

        from app.engine.post_submission_pipeline import load_exam_solutions_data

        # 1. Batch preload all existing responses for this attempt in 1 query
        resp_res = await self.session.exec(
            select(ExamQuestionResponse).where(ExamQuestionResponse.attempt_id == attempt.id)
        )
        responses = list(resp_res.all())
        resp_by_qid: Dict[int, ExamQuestionResponse] = {r.question_id: r for r in responses if r.question_id}

        # 2. Ingest final batch responses if provided in submit payload
        if req.responses and len(req.responses) > 0:
            # Pre-collect question IDs needing QuestionOption label resolution
            q_ids_needing_options = []
            for item in req.responses:
                q_id = int(item.question_id) if item.question_id and str(item.question_id).isdigit() else None
                if not q_id:
                    continue
                opt_raw = item.selected_option_id
                if opt_raw is not None and not (isinstance(opt_raw, int) or str(opt_raw).isdigit()):
                    q_ids_needing_options.append(q_id)

            submit_opt_label_map: Dict[Tuple[int, str], int] = {}
            if q_ids_needing_options:
                opt_res = await self.session.exec(
                    select(QuestionOption).where(col(QuestionOption.question_id).in_(list(set(q_ids_needing_options))))
                )
                for opt in opt_res.all():
                    if opt.option_label and opt.id is not None and opt.question_id is not None:
                        submit_opt_label_map[(opt.question_id, opt.option_label.strip().upper())] = opt.id

            for item in req.responses:
                try:
                    q_id = int(item.question_id) if item.question_id and str(item.question_id).isdigit() else None
                    if not q_id:
                        continue
                    opt_id = int(item.selected_option_id) if item.selected_option_id and str(item.selected_option_id).isdigit() else None
                    if opt_id is None and item.selected_option_id is not None:
                        lbl_str = str(item.selected_option_id).strip().upper()
                        if len(lbl_str) <= 2:
                            opt_id = submit_opt_label_map.get((q_id, lbl_str))

                    resp = resp_by_qid.get(q_id)
                    if not resp:
                        resp = ExamQuestionResponse(
                            attempt_id=attempt.id,
                            question_id=q_id,
                            question_status=QuestionResponseStatus.VISITED if opt_id else QuestionResponseStatus.UNVISITED,
                            expected_time_seconds=60.0,
                        )
                        responses.append(resp)
                        resp_by_qid[q_id] = resp
                    if opt_id:
                        resp.selected_option_id = opt_id
                        resp.question_status = QuestionResponseStatus.ANSWERED_AND_MARKED if item.is_marked_for_review else QuestionResponseStatus.ANSWERED
                    resp.is_marked_for_review = item.is_marked_for_review
                    resp.time_taken_seconds = max(resp.time_taken_seconds, float(item.time_spent_seconds or 0.0))
                    if getattr(item, "is_switched", False):
                        resp.is_switched = True
                    if getattr(item, "option_switch_count", 0) > resp.option_switch_count:
                        resp.option_switch_count = item.option_switch_count
                        resp.is_switched = True
                    self.session.add(resp)
                except Exception as resp_err:
                    logger.warning(f"Error persisting submit response item: {resp_err}")

        # 3. Load solutions doc & question paper number mapping once
        solutions_doc = await load_exam_solutions_data(exam, self.session, self.storage)
        sol_list = solutions_doc.get("questions", [])
        sol_map = {str(s.get("question_id")): s for s in sol_list if "question_id" in s}
        sol_num_map = {int(s["question_number"]): s for s in sol_list if s.get("question_number") is not None}

        # 4. If responses is empty, auto-seed from exam questions in DB or solutions_doc
        if not responses:
            seeded_resps = []
            q_res = await self.session.exec(
                select(Question).where(Question.exam_id == exam.id).order_by(col(Question.question_number_in_paper))
            )
            q_rows = q_res.all()
            if q_rows:
                for index, q_obj in enumerate(q_rows, 1):
                    seeded_resps.append(
                        ExamQuestionResponse(
                            attempt_id=attempt.id,
                            question_id=q_obj.id,
                            question_status=QuestionResponseStatus.UNVISITED,
                            expected_time_seconds=float(q_obj.expected_time_seconds or 60.0),
                            time_taken_seconds=0.0,
                            is_correct=False,
                            final_score=0.0,
                        )
                    )
            elif sol_list:
                for index, s_item in enumerate(sol_list, 1):
                    if s_item.get("question_id") and str(s_item["question_id"]).isdigit():
                        try:
                            qid = int(s_item["question_id"])
                        except (ValueError, TypeError):
                            continue
                        seeded_resps.append(
                            ExamQuestionResponse(
                                attempt_id=attempt.id,
                                question_id=qid,
                                question_status=QuestionResponseStatus.UNVISITED,
                                expected_time_seconds=float(s_item.get("expected_time_seconds") or 60.0),
                                time_taken_seconds=0.0,
                                is_correct=False,
                                final_score=0.0,
                            )
                        )
            if seeded_resps:
                self.session.add_all(seeded_resps)
                responses = seeded_resps

        # Batch preload question numbers for all response questions to avoid N+1 DB queries in scoring loop
        all_scoring_q_ids = list({r.question_id for r in responses if r.question_id})
        q_paper_nums: Dict[int, int] = {}
        if all_scoring_q_ids:
            q_meta_res = await self.session.exec(
                select(Question.id, Question.question_number_in_paper).where(col(Question.id).in_(all_scoring_q_ids))
            )
            q_paper_nums = {q_id: q_num for q_id, q_num in q_meta_res.all() if q_num is not None}

        tot_correct = 0
        tot_incorrect = 0
        tot_unattempted = 0
        tot_raw_score = 0.0
        max_possible = float(exam.total_marks or 200.0)

        for r in responses:
            if r.selected_option_id is None:
                tot_unattempted += 1
                r.is_correct = False
                r.final_score = 0.0
            else:
                q_sol = sol_map.get(str(r.question_id), {})
                if not q_sol and r.question_id in q_paper_nums:
                    paper_num = q_paper_nums[r.question_id]
                    q_sol = sol_num_map.get(paper_num, {})

                correct_opt_id = q_sol.get("correct_option_id")
                is_corr = (str(r.selected_option_id) == str(correct_opt_id)) if correct_opt_id else False

                distractors = q_sol.get("distractor_scores", {})
                user_dist = distractors.get(str(r.selected_option_id), {})
                c_score = float(user_dist.get("closeness_score", 1.0 if is_corr else 0.0))

                r.is_correct = is_corr
                r.closeness_score_awarded = c_score

                # Standard UPSC Prelims Scoring: +2.00 marks for correct, -0.6667 (-2/3) marks for incorrect
                r.final_score = 2.0 if is_corr else -0.6667

                if is_corr:
                    tot_correct += 1
                else:
                    tot_incorrect += 1

                tot_raw_score += r.final_score

            self.session.add(r)

        attempt.status = AttemptStatus.SUBMITTED
        attempt.submitted_at = now_dt
        attempt.submission_reason = final_reason
        attempt.total_correct = tot_correct
        attempt.total_incorrect = tot_incorrect
        attempt.total_unattempted = tot_unattempted
        attempt.total_questions_attempted = tot_correct + tot_incorrect
        attempt.total_score = round(tot_raw_score, 2)
        attempt.max_possible_score = max_possible

        # Accurate telemetry time computation: sum of per-question elapsed times without compiler overhead
        sum_question_time = sum(float(r.time_taken_seconds or 0.0) for r in responses)
        if sum_question_time > 0:
            final_time_spent = min(float(attempt.max_duration_seconds), sum_question_time)
        else:
            final_time_spent = min(float(attempt.max_duration_seconds), total_time_spent)
        attempt.time_spent_seconds = round(final_time_spent, 1)

        self.session.add(attempt)

        # Sync UserTestAttempt
        u_att_res = await self.session.exec(
            select(UserTestAttempt).where(UserTestAttempt.exam_attempt_id == attempt.id)
        )
        u_att = u_att_res.first()
        if u_att:
            u_att.status = attempt.status
            u_att.score_raw = attempt.total_score
            u_att.total_time_spent_sec = int(attempt.time_spent_seconds)
            u_att.submitted_at = now_dt
            self.session.add(u_att)

        await self.session.flush()
        await self.session.commit()

        from app.cache import invalidate_attempt_cache
        await invalidate_attempt_cache(attempt.id, str(user_id))

        # Enqueue async post-submission pipeline
        from app.engine.post_submission_pipeline import run_post_submission_pipeline
        if attempt.id:
            if background_tasks:
                background_tasks.add_task(run_post_submission_pipeline, attempt.id)
            else:
                asyncio.create_task(run_post_submission_pipeline(attempt.id))

        acc_pct = round((tot_correct / max(1, attempt.total_questions)) * 100.0, 1)

        return SubmitExamResponse(
            attempt_id=str(attempt.id),
            status=attempt.status,
            submitted_at=now_dt,
            submission_reason=final_reason,
            raw_score=attempt.total_score,
            max_score=max_possible,
            accuracy_percentage=acc_pct,
            correct_count=tot_correct,
            incorrect_count=tot_incorrect,
            unattempted_count=tot_unattempted,
            time_taken_seconds=attempt.time_spent_seconds,
            max_duration_seconds=attempt.max_duration_seconds,
            evaluation_status="PROCESSING",
            evaluation_message="Psychometric analysis is being computed in the background. Full report will be available shortly.",
        )

    async def list_user_attempts(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 20,
        exam_id: Optional[int] = None,
        status_filter: Optional[str | AttemptStatus] = None,
    ) -> Dict[str, Any]:
        """Parameter 13: List candidate's exam attempts history."""
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        status_str = str(status_filter.value if hasattr(status_filter, "value") else status_filter) if status_filter else None
        cache_key = build_cache_key(
            "attempts:user",
            str(user_id),
            skip=skip,
            limit=limit,
            exam_id=str(exam_id) if exam_id else None,
            status=status_str,
        )
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        filters = [ExamAttempt.user_id == user_id]
        if exam_id:
            filters.append(ExamAttempt.exam_id == exam_id)
        if status_filter:
            if isinstance(status_filter, str) and "," in status_filter:
                raw_parts = [s.strip().upper() for s in status_filter.split(",") if s.strip()]
                matched_statuses = []
                for p in raw_parts:
                    if hasattr(AttemptStatus, p):
                        matched_statuses.append(AttemptStatus[p])
                    elif p == "COMPLETED":
                        matched_statuses.extend([AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED])
                if matched_statuses:
                    filters.append(col(ExamAttempt.status).in_(list(set(matched_statuses))))
            elif isinstance(status_filter, str) and hasattr(AttemptStatus, status_filter.upper()):
                filters.append(ExamAttempt.status == AttemptStatus[status_filter.upper()])
            elif isinstance(status_filter, AttemptStatus):
                filters.append(ExamAttempt.status == status_filter)

        from sqlmodel import func
        count_stmt = select(func.count()).select_from(ExamAttempt).where(*filters)
        total_res = await self.session.exec(count_stmt)
        total_count = total_res.first() or 0

        # report_metadata_json can be hundreds of KB (occasionally >1MB) per
        # attempt, but only a handful of small keys are needed here. Extract
        # just those server-side instead of pulling the full ORM entity (and
        # the whole blob) over the wire for every row in the page.
        meta_col = ExamAttempt.report_metadata_json
        list_stmt = (
            select(
                ExamAttempt.id,
                ExamAttempt.exam_id,
                ExamAttempt.mode,
                ExamAttempt.status,
                ExamAttempt.total_score,
                ExamAttempt.max_possible_score,
                ExamAttempt.total_questions,
                ExamAttempt.total_questions_attempted,
                ExamAttempt.started_at,
                ExamAttempt.submitted_at,
                meta_col.op("->>")("is_guest_synced").label("is_guest_synced"),
                meta_col.op("->>")("guest_session_id").label("guest_session_id"),
                meta_col.op("->>")("topic_name").label("topic_name"),
                meta_col.op("->>")("subtopic_name").label("subtopic_name"),
                meta_col.op("->>")("traceable_exam_name").label("traceable_exam_name"),
                meta_col.op("->")("metadata").op("->")("exam_attempt").op("->>")("exam_name").label("meta_exam_name"),
            )
            .where(*filters)
            .order_by(col(ExamAttempt.created_at).desc())
            .offset(skip)
            .limit(limit)
        )

        res = await self.session.exec(list_stmt)
        attempts = res.all()

        exam_ids = {att.exam_id for att in attempts if att.exam_id is not None}
        exam_names_by_id: Dict[int, str] = {}
        if exam_ids:
            exams_res = await self.session.exec(select(Exam.id, Exam.name).where(col(Exam.id).in_(exam_ids)))
            exam_names_by_id = {e_id: e_name for e_id, e_name in exams_res.all()}

        items = []
        for att in attempts:
            is_guest = bool((att.is_guest_synced or "").lower() == "true" or att.guest_session_id)
            is_practice = (att.mode == AttemptMode.PRACTICE) or is_guest or bool(att.topic_name)

            topic_desc = att.subtopic_name or att.topic_name
            q_cnt = att.total_questions or (att.total_questions_attempted or 0)
            if is_guest:
                name_str = f"Guest Practice: {topic_desc or 'Topic Practice'} ({q_cnt} Qs)"
            elif is_practice:
                name_str = f"Practice Test: {topic_desc or 'Topic Practice'} ({q_cnt} Qs)"
            else:
                name_str = exam_names_by_id.get(att.exam_id) or "Full Paper Mock"

            resolved_title = att.traceable_exam_name or att.meta_exam_name or name_str

            items.append({
                "attempt_id": str(att.id),
                "exam_id": str(att.exam_id),
                "exam_name": resolved_title,
                "mode": att.mode.value if hasattr(att.mode, "value") else str(att.mode),
                "status": att.status.value if hasattr(att.status, "value") else str(att.status),
                "total_score": att.total_score,
                "max_possible_score": att.max_possible_score,
                "total_questions": att.total_questions,
                "started_at": att.started_at.isoformat() if att.started_at else None,
                "submitted_at": att.submitted_at.isoformat() if att.submitted_at else None,
            })

        result_dict = {"items": items, "total": total_count, "skip": skip, "limit": limit}
        await cache.set(cache_key, result_dict, ttl_seconds=120)
        return result_dict

    async def get_attempt_status_summary(self, user_id: int) -> Dict[str, Dict[str, Any]]:
        """Lightweight per-exam attempt status for catalog/listing pages (e.g. PYQ list).

        Unlike list_user_attempts, this skips report_metadata_json, exam-name
        resolution, and pagination entirely — it only returns the latest
        in-progress/completed attempt id and score per exam, for status badges.
        """
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("attempts:status-summary", str(user_id))
        cached_data = await cache.get(cache_key)
        if cached_data is not None:
            return cached_data

        stmt = (
            select(
                ExamAttempt.exam_id,
                ExamAttempt.id,
                ExamAttempt.status,
                ExamAttempt.total_score,
                ExamAttempt.max_possible_score,
            )
            .where(ExamAttempt.user_id == user_id)
            .order_by(col(ExamAttempt.created_at).desc())
        )
        res = await self.session.exec(stmt)
        rows = res.all()

        completed_statuses = {AttemptStatus.SUBMITTED, AttemptStatus.EVALUATED}
        summary: Dict[str, Dict[str, Any]] = {}
        for exam_id, attempt_id, att_status, total_score, max_score in rows:
            entry = summary.setdefault(str(exam_id), {})
            if att_status == AttemptStatus.IN_PROGRESS and "in_progress_attempt_id" not in entry:
                entry["in_progress_attempt_id"] = attempt_id
            elif att_status in completed_statuses and "completed_attempt_id" not in entry:
                entry["completed_attempt_id"] = attempt_id
                entry["total_score"] = total_score
                entry["max_possible_score"] = max_score

        await cache.set(cache_key, summary, ttl_seconds=60)
        return summary

    async def get_attempt_result(self, attempt_id: int | str, user_id: int) -> Dict[str, Any]:
        """Parameter 14: Dedicated result view for a submitted/evaluated attempt."""
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status == AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_IN_PROGRESS: Attempt is still active and has not been submitted."
            )

        if attempt.report_metadata_json:
            return attempt.report_metadata_json

        acc_pct = round((attempt.total_correct / max(1, attempt.total_questions)) * 100.0, 1)
        return {
            "attempt_id": str(attempt.id),
            "status": attempt.status,
            "mode": attempt.mode,
            "submitted_at": attempt.submitted_at,
            "submission_reason": attempt.submission_reason,
            "raw_score": attempt.total_score,
            "max_score": attempt.max_possible_score,
            "accuracy_percentage": acc_pct,
            "correct_count": attempt.total_correct,
            "incorrect_count": attempt.total_incorrect,
            "unattempted_count": attempt.total_unattempted,
            "evaluation_status": "PROCESSING" if attempt.status == AttemptStatus.SUBMITTED else "COMPLETED",
        }


    # --- Internal Helpers ---

    async def _get_attempt_safe(self, attempt_id: int | str, user_id: int) -> ExamAttempt:
        try:
            att_id = int(attempt_id)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=404, detail="ATTEMPT_NOT_FOUND: Invalid attempt ID."
            )
        attempt = await self.session.get(ExamAttempt, att_id)
        if not attempt or attempt.user_id != user_id:
            raise HTTPException(
                status_code=404, detail="ATTEMPT_NOT_FOUND: Exam attempt not found or unauthorized."
            )
        return attempt


    async def _compute_response_summary(self, attempt_id: int) -> ResponseSummary:
        resp_res = await self.session.exec(
            select(ExamQuestionResponse).where(ExamQuestionResponse.attempt_id == attempt_id)
        )
        responses = resp_res.all()

        ans = 0
        marked = 0
        unatt = 0

        for r in responses:
            if r.question_status in (
                QuestionResponseStatus.ANSWERED,
                QuestionResponseStatus.ANSWERED_AND_MARKED,
            ):
                ans += 1
            if r.question_status in (
                QuestionResponseStatus.MARKED_FOR_REVIEW,
                QuestionResponseStatus.ANSWERED_AND_MARKED,
            ):
                marked += 1
            if r.question_status == QuestionResponseStatus.UNVISITED:
                unatt += 1

        return ResponseSummary(
            answered_count=ans,
            marked_for_review_count=marked,
            unattempted_count=unatt,
            total=len(responses),
        )

    async def sync_guest_sessions(self, user_id: int, sessions_list: Any) -> Dict[str, Any]:
        """
        Synchronizes guest exam attempts saved in frontend localStorage into backend ExamAttempt database rows,
        records individual question responses, and triggers the full 12-matrix psychometric diagnostic analysis.
        """
        import asyncio
        from app.engine.post_submission_pipeline import run_post_submission_pipeline

        if isinstance(sessions_list, dict):
            sessions_list = sessions_list.get("sessions_payload") or sessions_list.get("sessions") or []

        if not isinstance(sessions_list, list) or not sessions_list:
            return {"status": "success", "synced_count": 0, "latest_attempt_id": None}

        # Fetch or default an active Exam
        exam_res = await self.session.exec(select(Exam).where(Exam.is_active == True))
        active_exam = exam_res.first()

        if not active_exam:
            exam_res_any = await self.session.exec(select(Exam))
            active_exam = exam_res_any.first()

        synced_count = 0
        latest_attempt = None

        # Batch preload QuestionOption mappings for all guest session responses needing label resolution
        guest_q_ids_needing_options = set()
        for item in sessions_list:
            raw_resps = item.get("responses") or []
            for r_item in raw_resps:
                q_id_raw = r_item.get("question_id")
                if not q_id_raw:
                    continue
                try:
                    q_id_val = int(q_id_raw)
                except (ValueError, TypeError):
                    continue
                opt_raw = r_item.get("selected_option_id")
                if opt_raw is not None:
                    try:
                        int(opt_raw)
                    except (ValueError, TypeError):
                        opt_str = str(opt_raw).strip().upper()
                        if opt_str in ("A", "B", "C", "D", "E"):
                            guest_q_ids_needing_options.add(q_id_val)

        guest_opt_label_map: Dict[Tuple[int, str], int] = {}
        if guest_q_ids_needing_options:
            guest_opt_stmt = select(QuestionOption).where(
                col(QuestionOption.question_id).in_(list(guest_q_ids_needing_options))
            )
            guest_opt_rows = (await self.session.exec(guest_opt_stmt)).all()
            for opt in guest_opt_rows:
                if opt.option_label and opt.id is not None and opt.question_id is not None:
                    guest_opt_label_map[(opt.question_id, opt.option_label.strip().upper())] = opt.id

        for item in sessions_list:
            t_exam = item.get("targetExam", "UPSC CSE")
            t_year = item.get("targetYear", "Target 2026")
            topic = item.get("topicName", "General Studies")
            subtopic = item.get("subtopicName", "")
            score = float(item.get("score", 0))
            max_score = float(item.get("totalMarksPossible", 10))
            correct = int(item.get("correctCount", 0))
            incorrect = int(item.get("incorrectCount", 0))
            unattempted = int(item.get("unattemptedCount", 0))
            accuracy = float(item.get("accuracy", 0))
            tot_q = int(item.get("totalQuestions", correct + incorrect + unattempted))
            time_spent = float(item.get("timeSpentSeconds", 0))

            created_dt = datetime.now(timezone.utc)
            if item.get("completedAt"):
                try:
                    created_dt = datetime.fromisoformat(str(item["completedAt"]).replace("Z", "+00:00"))
                except Exception:
                    pass

            meta = {
                "is_guest_synced": True,
                "topic_name": topic,
                "subtopic_name": subtopic,
                "target_exam": t_exam,
                "target_year": t_year,
                "accuracy": accuracy,
                "guest_session_id": item.get("id", "")
            }

            attempt = ExamAttempt(
                user_id=user_id,
                exam_id=active_exam.id if active_exam else None,
                status=AttemptStatus.SUBMITTED,
                mode=AttemptMode.EXAM,
                total_score=score,
                max_possible_score=max_score,
                time_spent_seconds=time_spent,
                total_questions_attempted=correct + incorrect,
                total_questions=tot_q,
                total_correct=correct,
                total_incorrect=incorrect,
                total_unattempted=unattempted,
                report_metadata_json=meta,
                created_at=created_dt,
                submitted_at=created_dt,
            )
            self.session.add(attempt)
            await self.session.flush()

            # Ingest question responses if available
            raw_resps = item.get("responses") or []
            for r_item in raw_resps:
                try:
                    q_id_raw = r_item.get("question_id")
                    if not q_id_raw:
                        continue
                    try:
                        q_id_val = int(q_id_raw)
                    except (ValueError, TypeError):
                        continue

                    opt_raw = r_item.get("selected_option_id")
                    opt_id_val = None
                    try:
                        opt_id_val = int(opt_raw)
                    except (ValueError, TypeError):
                        pass

                    if opt_id_val is None and opt_raw:
                        opt_str = str(opt_raw).strip().upper()
                        if opt_str in ("A", "B", "C", "D", "E"):
                            opt_id_val = guest_opt_label_map.get((q_id_val, opt_str))

                    is_corr = bool(r_item.get("is_correct", False))

                    resp_row = ExamQuestionResponse(
                        attempt_id=attempt.id,
                        question_id=q_id_val,
                        selected_option_id=opt_id_val,
                        question_status=QuestionResponseStatus.ANSWERED if opt_id_val else QuestionResponseStatus.UNVISITED,
                        is_correct=is_corr,
                        final_score=2.0 if is_corr else (-0.66 if opt_id_val else 0.0),
                        time_taken_seconds=float(r_item.get("time_taken_seconds") or 60.0),
                        expected_time_seconds=float(r_item.get("expected_time_seconds") or 60.0),
                        is_switched=bool(r_item.get("is_switched", False)),
                        closeness_score_awarded=1.0 if is_corr else 0.0,
                    )
                    self.session.add(resp_row)
                except Exception as r_err:
                    logger.warning(f"Error persisting synced guest question response: {r_err}")

            synced_count += 1
            latest_attempt = attempt

        await self.session.commit()

        # Trigger background 12-matrix pipeline evaluation for the synced attempt
        if latest_attempt:
            asyncio.create_task(run_post_submission_pipeline(latest_attempt.id))

        return {
            "status": "success",
            "synced_count": synced_count,
            "latest_attempt_id": str(latest_attempt.id) if latest_attempt else None,
        }

    async def get_student_dashboard_stats(self, user_id: int) -> Dict[str, Any]:
        """
        Retrieves aggregate statistics and recent exam attempts for the student dashboard.
        """
        from app.cache import get_cache, build_cache_key
        cache = get_cache()
        cache_key = build_cache_key("analytics:student_dashboard_stats", str(user_id))

        cached_val = await cache.get(cache_key)
        if cached_val is not None:
            return cached_val

        from sqlmodel import func, case
        
        # 1. Aggregate Stats Query (Executes in DB, no JSON transfer)
        agg_stmt = select(
            func.count(ExamAttempt.id).label("total_exams"),
            func.sum(
                case((ExamAttempt.total_questions_attempted > 0, ExamAttempt.total_questions_attempted),
                     else_=(func.coalesce(ExamAttempt.total_correct, 0) + func.coalesce(ExamAttempt.total_incorrect, 0)))
            ).label("total_questions_attempted"),
            func.sum(func.coalesce(ExamAttempt.total_correct, 0)).label("total_correct"),
            func.sum(func.coalesce(ExamAttempt.total_questions, 0)).label("total_questions"),
            func.sum(func.coalesce(ExamAttempt.time_spent_seconds, 0)).label("total_time_seconds")
        ).where(ExamAttempt.user_id == user_id)
        
        agg_res = (await self.session.exec(agg_stmt)).first()
        
        total_exams = int(getattr(agg_res, "total_exams", 0) or 0)
        total_questions_attempted = int(getattr(agg_res, "total_questions_attempted", 0) or 0)
        total_correct = int(getattr(agg_res, "total_correct", 0) or 0)
        total_questions = int(getattr(agg_res, "total_questions", 0) or 0)
        total_time_seconds = int(getattr(agg_res, "total_time_seconds", 0) or 0)

        overall_accuracy = round((total_correct / total_questions_attempted) * 100, 1) if total_questions_attempted > 0 else 0.0

        # 2. Fetch only the 15 most recent attempts (Avoids downloading MBs of JSON for older attempts)
        recent_stmt = (
            select(ExamAttempt)
            .where(ExamAttempt.user_id == user_id)
            .order_by(col(ExamAttempt.created_at).desc())
            .limit(15)
        )
        recent_db_attempts = (await self.session.exec(recent_stmt)).all()

        recent_attempts = []
        for a in recent_db_attempts:
            meta = a.report_metadata_json or {}
            is_guest = bool(meta.get("is_guest_synced") or meta.get("guest_session_id"))
            is_practice = (a.mode == AttemptMode.PRACTICE) or is_guest or bool(meta.get("topic_name"))
            topic_desc = meta.get("subtopic_name") or meta.get("topic_name") or "General Studies"
            q_cnt = a.total_questions or (a.total_questions_attempted or 0)
            
            if is_guest:
                exam_display = f"Guest Practice: {topic_desc} ({q_cnt} Qs)"
            elif is_practice:
                exam_display = f"Practice Test: {topic_desc} ({q_cnt} Qs)"
            else:
                exam_display = meta.get("target_exam", "UPSC CSE Prelims")

            recent_attempts.append({
                "id": str(a.id),
                "examName": meta.get("traceable_exam_name") or exam_display,
                "targetExam": meta.get("target_exam", "UPSC CSE"),
                "targetYear": meta.get("target_year", "Target 2026"),
                "topicName": topic_desc,
                "subtopicName": meta.get("subtopic_name", ""),
                "score": a.total_score,
                "totalMarksPossible": a.max_possible_score,
                "correctCount": a.total_correct,
                "incorrectCount": a.total_incorrect,
                "unattemptedCount": a.total_unattempted,
                "accuracy": meta.get("accuracy", round((a.total_correct / (a.total_questions_attempted or 1)) * 100, 1)),
                "totalQuestions": a.total_questions,
                "timeSpentSeconds": int(a.time_spent_seconds or 0),
                "isGuestSynced": bool(meta.get("is_guest_synced", False)),
                "createdAt": a.created_at.isoformat() if a.created_at else datetime.now(timezone.utc).isoformat(),
            })

        result = {
            "totalExams": total_exams,
            "totalQuestionsAttempted": total_questions_attempted,
            "totalCorrect": total_correct,
            "totalQuestions": total_questions,
            "overallAccuracy": overall_accuracy,
            "totalTimeSeconds": total_time_seconds,
            "recentAttempts": recent_attempts,
        }
        await cache.set(cache_key, result, ttl_seconds=900)
        return result

