import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, status, BackgroundTasks
from sqlmodel import select, col
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models import (
    User,
    Exam,
    Question,
    ExamAttempt,
    ExamQuestionResponse,
    Test,
    UserTestAttempt,
    UserQuestionResponse,
    QuestionSwitchLog,
)
from app.db.models.enums import AttemptStatus, AttemptMode, QuestionResponseStatus, TestType, UserRole, UserStatus
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
)
from app.services.exam_json_builder import ExamJsonBuilder
from app.engine.matrices.time_tiered_scoring import TimeTieredScoringStrategy
from app.engine.matrices.closeness_evaluator import ClosenessEvaluator
from app.storage.factory import get_storage_provider
from app.config.logger import setup_logger

logger = setup_logger("ExamSessionService")


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

        # Resolve Exam by UUID or string code/slug
        exam = None
        req_exam_str = str(raw_exam_id)

        if isinstance(raw_exam_id, uuid.UUID):
            exam = await self.session.get(Exam, raw_exam_id)
        else:
            try:
                parsed_uuid = uuid.UUID(req_exam_str)
                exam = await self.session.get(Exam, parsed_uuid)
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
            logger.info(f"User '{user_id}' already has IN_PROGRESS attempt '{existing_attempt.id}'. Resuming...")
            status_res = await self.get_exam_status(existing_attempt.id, user_id)
            q_nav = await self.get_question(existing_attempt.id, user_id, status_res.current_question_index)
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
            )

        # Ensure Questions JSON exists or build it
        q_json_path = exam.questions_json_path or f"exams/{exam.code}/exam_questions.json"
        try:
            questions_doc = await self.storage.download_json(q_json_path)
        except Exception:
            logger.info(f"Questions JSON missing for exam '{exam.code}'. Generating now...")
            builder = ExamJsonBuilder(self.session)
            paths = await builder.generate_and_upload(exam.id)
            if not paths.get("questions_json_path"):
                raise HTTPException(status_code=422, detail="EXAM_NOT_READY: Exam has no questions.")
            questions_doc = await self.storage.download_json(paths["questions_json_path"])

        questions_list = questions_doc.get("questions", [])
        if not questions_list:
            raise HTTPException(status_code=422, detail="EXAM_NOT_READY: Exam questions list is empty.")

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
            total_questions=len(questions_list),
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
                total_questions=len(questions_list),
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
        await self.session.refresh(attempt)
        await self.session.refresh(user_test_attempt)

        # Pre-create ExamQuestionResponse AND UserQuestionResponse rows
        palette_items = []
        for index, q_item in enumerate(questions_list, 1):
            q_id = uuid.UUID(q_item["question_id"])
            resp = ExamQuestionResponse(
                attempt_id=attempt.id,
                question_id=q_id,
                question_status=QuestionResponseStatus.UNVISITED,
                expected_time_seconds=float(q_item.get("expected_time_seconds", 60)),
            )
            self.session.add(resp)
            await self.session.flush()

            u_resp = UserQuestionResponse(
                attempt_id=user_test_attempt.id,
                exam_response_id=resp.id,
                question_id=q_id,
                time_taken_seconds=0,
            )
            self.session.add(u_resp)

            palette_items.append(
                QuestionPaletteItem(
                    question_number=index,
                    question_id=str(q_id),
                    question_status=QuestionResponseStatus.UNVISITED,
                )
            )

        await self.session.commit()

        # Mark question 1 as VISITED
        first_q_payload = questions_list[0]
        first_q_id = uuid.UUID(first_q_payload["question_id"])
        r_stmt = select(ExamQuestionResponse).where(
            ExamQuestionResponse.attempt_id == attempt.id,
            ExamQuestionResponse.question_id == first_q_id,
        )
        r_res = await self.session.exec(r_stmt)
        first_resp = r_res.first()
        if first_resp:
            first_resp.question_status = QuestionResponseStatus.VISITED
            first_resp.visited_count = 1
            self.session.add(first_resp)
            await self.session.commit()
            palette_items[0].question_status = QuestionResponseStatus.VISITED

        nav_first = self._build_question_nav_response(
            q_item=first_q_payload,
            nav_current=1,
            nav_total=len(questions_list),
            resp=first_resp,
        )

        return StartExamResponse(
            attempt_id=str(attempt.id),
            exam_id=str(exam.id),
            status=attempt.status,
            mode=attempt.mode,
            started_at=attempt.started_at,
            max_duration_seconds=attempt.max_duration_seconds,
            total_questions=attempt.total_questions,
            first_question=nav_first,
            palette=palette_items,
        )

    async def get_question(
        self,
        attempt_id: uuid.UUID,
        user_id: uuid.UUID,
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
        q_json_path = exam.questions_json_path or f"exams/{exam.code}/exam_questions.json"
        questions_doc = await self.storage.download_json(q_json_path)
        questions_list = questions_doc.get("questions", [])

        q_payload = questions_list[question_number - 1]
        q_id = uuid.UUID(q_payload["question_id"])

        # Fetch DB response record
        r_stmt = select(ExamQuestionResponse).where(
            ExamQuestionResponse.attempt_id == attempt.id,
            ExamQuestionResponse.question_id == q_id,
        )
        r_res = await self.session.exec(r_stmt)
        resp = r_res.first()

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
            nav_total=len(questions_list),
            resp=resp,
            language=language,
        )

    async def save_response(
        self, attempt_id: uuid.UUID, user_id: uuid.UUID, req: SaveResponseRequest
    ) -> SaveResponseResponse:
        attempt = await self._get_attempt_safe(attempt_id, user_id)
        if attempt.status != AttemptStatus.IN_PROGRESS:
            raise HTTPException(
                status_code=403, detail="ATTEMPT_ALREADY_SUBMITTED: Attempt is no longer in progress."
            )

        # Resolve question_id UUID
        q_uuid = None
        if isinstance(req.question_id, uuid.UUID):
            q_uuid = req.question_id
        else:
            try:
                q_uuid = uuid.UUID(str(req.question_id))
            except (ValueError, TypeError):
                q_uuid = None

        # Resolve selected_option_id UUID
        opt_uuid = None
        if req.selected_option_id is not None:
            if isinstance(req.selected_option_id, uuid.UUID):
                opt_uuid = req.selected_option_id
            else:
                try:
                    opt_uuid = uuid.UUID(str(req.selected_option_id))
                except (ValueError, TypeError):
                    opt_uuid = None

        r_stmt = select(ExamQuestionResponse).where(
            ExamQuestionResponse.attempt_id == attempt.id
        )
        if q_uuid:
            r_stmt = r_stmt.where(ExamQuestionResponse.question_id == q_uuid)

        r_res = await self.session.exec(r_stmt)
        resp = r_res.first()

        if not resp:
            all_res = await self.session.exec(
                select(ExamQuestionResponse).where(ExamQuestionResponse.attempt_id == attempt.id)
            )
            all_responses = all_res.all()
            if attempt.current_question_index <= len(all_responses) and attempt.current_question_index > 0:
                resp = all_responses[attempt.current_question_index - 1]
            elif all_responses:
                resp = all_responses[0]

        if not resp:
            raise HTTPException(
                status_code=422, detail="INVALID_QUESTION_ID: Question does not belong to this exam attempt."
            )

        prev_opt_id = resp.selected_option_id

        # Update options and tracking
        if req.selected_option_id is not None:
            if resp.selected_option_id is None:
                resp.initial_option_id = opt_uuid
                resp.selected_option_id = opt_uuid
            elif resp.selected_option_id != opt_uuid:
                resp.selected_option_id = opt_uuid
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


    async def reveal_answer(
        self, attempt_id: uuid.UUID, user_id: uuid.UUID, question_id: uuid.UUID
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

        r_stmt = select(ExamQuestionResponse).where(
            ExamQuestionResponse.attempt_id == attempt.id,
            ExamQuestionResponse.question_id == question_id,
        )
        r_res = await self.session.exec(r_stmt)
        resp = r_res.first()

        if not resp or resp.selected_option_id is None:
            raise HTTPException(
                status_code=422,
                detail="NO_OPTION_SELECTED: You must select an option before revealing the answer.",
            )

        exam = await self.session.get(Exam, attempt.exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="EXAM_NOT_FOUND: Associated exam not found.")
        s_json_path = exam.solutions_json_path or f"exams/{exam.code}/exam_solutions.json"
        solutions_doc = await self.storage.download_json(s_json_path)

        sol_list = solutions_doc.get("questions", [])
        q_sol = next((s for s in sol_list if s["question_id"] == str(question_id)), None)

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
        self, attempt_id: uuid.UUID, user_id: uuid.UUID, req: HeartbeatRequest
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
        self, attempt_id: uuid.UUID, user_id: uuid.UUID
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
        )

    async def submit_exam(
        self,
        attempt_id: uuid.UUID,
        user_id: uuid.UUID,
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

        s_json_path = exam.solutions_json_path or f"exams/{exam.code}/exam_solutions.json"

        try:
            solutions_doc = await self.storage.download_json(s_json_path)
            sol_list = solutions_doc.get("questions", [])
        except Exception:
            sol_list = []

        sol_map = {s["question_id"]: s for s in sol_list}

        # Synchronous scoring pass
        resp_res = await self.session.exec(
            select(ExamQuestionResponse).where(ExamQuestionResponse.attempt_id == attempt.id)
        )
        responses = resp_res.all()

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
                correct_opt_id = q_sol.get("correct_option_id")
                is_corr = (str(r.selected_option_id) == str(correct_opt_id)) if correct_opt_id else False

                distractors = q_sol.get("distractor_scores", {})
                user_dist = distractors.get(str(r.selected_option_id), {})
                c_score = float(user_dist.get("closeness_score", 1.0 if is_corr else 0.0))

                r.is_correct = is_corr
                r.closeness_score_awarded = c_score

                scoring_eval = TimeTieredScoringStrategy.calculate_score(
                    is_correct=is_corr,
                    time_taken_sec=r.time_taken_seconds,
                    expected_time_sec=r.expected_time_seconds,
                    closeness_score=c_score,
                )
                r.final_score = scoring_eval["final_score"]

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
        attempt.total_score = round(tot_raw_score, 2)
        attempt.max_possible_score = max_possible
        attempt.time_spent_seconds = round(total_time_spent, 1)

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

        await self.session.commit()

        # Enqueue async post-submission pipeline
        if background_tasks:
            from app.engine.post_submission_pipeline import run_post_submission_pipeline

            background_tasks.add_task(run_post_submission_pipeline, attempt.id)

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
        user_id: uuid.UUID,
        skip: int = 0,
        limit: int = 20,
        exam_id: Optional[uuid.UUID] = None,
        status_filter: Optional[AttemptStatus] = None,
    ) -> Dict[str, Any]:
        """Parameter 13: List candidate's exam attempts history."""
        stmt = select(ExamAttempt).where(ExamAttempt.user_id == user_id)
        if exam_id:
            stmt = stmt.where(ExamAttempt.exam_id == exam_id)
        if status_filter:
            stmt = stmt.where(ExamAttempt.status == status_filter)

        stmt = stmt.order_by(col(ExamAttempt.created_at).desc()).offset(skip).limit(limit)
        res = await self.session.exec(stmt)
        attempts = res.all()

        items = []
        for att in attempts:
            exam = await self.session.get(Exam, att.exam_id)
            items.append({
                "attempt_id": str(att.id),
                "exam_id": str(att.exam_id),
                "exam_name": exam.name if exam else "Exam",
                "mode": att.mode,
                "status": att.status,
                "total_score": att.total_score,
                "max_possible_score": att.max_possible_score,
                "total_questions": att.total_questions,
                "started_at": att.started_at,
                "submitted_at": att.submitted_at,
            })

        return {"items": items, "skip": skip, "limit": limit}

    async def get_attempt_result(self, attempt_id: uuid.UUID, user_id: uuid.UUID) -> Dict[str, Any]:
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

    async def _get_attempt_safe(self, attempt_id: uuid.UUID | str, user_id: uuid.UUID) -> ExamAttempt:
        att_uuid = attempt_id if isinstance(attempt_id, uuid.UUID) else uuid.UUID(str(attempt_id))
        attempt = await self.session.get(ExamAttempt, att_uuid)
        if not attempt or attempt.user_id != user_id:
            raise HTTPException(
                status_code=404, detail="ATTEMPT_NOT_FOUND: Exam attempt not found or unauthorized."
            )
        return attempt


    async def _compute_response_summary(self, attempt_id: uuid.UUID) -> ResponseSummary:
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

    def _build_question_nav_response(
        self,
        q_item: Dict[str, Any],
        nav_current: int,
        nav_total: int,
        resp: Optional[ExamQuestionResponse],
        language: Optional[str] = "ENGLISH",
    ) -> QuestionNavResponse:
        target_lang = (language or "ENGLISH").upper()

        # Resolve question statement text
        q_trans_dict = q_item.get("translations", {})
        q_text = q_item.get("text", "")
        if target_lang in q_trans_dict and q_trans_dict[target_lang].get("question_text"):
            q_text = q_trans_dict[target_lang]["question_text"]

        # Resolve passage text
        pass_trans_dict = q_item.get("passage_translations", {})
        passage_text = q_item.get("passage_text")
        if target_lang in pass_trans_dict and pass_trans_dict[target_lang]:
            passage_text = pass_trans_dict[target_lang]

        # Resolve options text
        opts = []
        for idx, o in enumerate(q_item.get("options", []), 1):
            opt_trans_dict = o.get("translations", {})
            opt_text = o.get("text", "")
            if target_lang in opt_trans_dict and opt_trans_dict[target_lang]:
                opt_text = opt_trans_dict[target_lang]

            opts.append(
                OptionOut(
                    option_id=o["option_id"],
                    option_label=o["option_label"],
                    text=opt_text,
                    display_order=o.get("display_order", idx),
                )
            )

        q_out = QuestionOut(
            question_id=q_item["question_id"],
            question_number=q_item["question_number"],
            text=q_text,
            options=opts,
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
            passage_text=passage_text,
        )

        nav_meta = NavigationMeta(
            current=nav_current,
            total=nav_total,
            has_next=nav_current < nav_total,
            has_prev=nav_current > 1,
        )

        resp_state = ResponseState(
            selected_option_id=str(resp.selected_option_id) if resp and resp.selected_option_id else None,
            is_marked_for_review=resp.is_marked_for_review if resp else False,
            time_spent_seconds=resp.time_taken_seconds if resp else 0.0,
            question_status=resp.question_status if resp else QuestionResponseStatus.UNVISITED,
            answer_revealed=resp.answer_revealed if resp else False,
        )

        return QuestionNavResponse(
            question=q_out,
            navigation=nav_meta,
            response_state=resp_state,
        )
