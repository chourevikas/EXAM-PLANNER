import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict

from fastapi import HTTPException
from sqlalchemy import func, case
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.db.models.user import User
from app.db.models.question import Question, QuestionTranslation, QuestionOption, OptionTranslation
from app.db.models.hierarchy import Subject, Topic, Subtopic
from app.db.models.enums import QuestionStatus, LanguageCode
from app.db.models.challenge import (
    Challenge,
    ChallengeQuestion,
    ChallengeInvite,
    ChallengeInviteStatus,
    ChallengeAttempt,
    ChallengeAttemptStatus,
    ChallengeResponse,
    ChallengeVisibility,
)
from app.schemas.challenge import (
    CreateChallengeRequest,
    ChallengeSummary,
    ChallengePublicPreview,
    ChallengeQuestionOut,
    ChallengeQuestionOption,
    StartChallengeAttemptResponse,
    SubmitChallengeAttemptResponse,
    LeaderboardEntry,
    ChallengeDuration,
)

DURATION_DELTAS: Dict[ChallengeDuration, Optional[timedelta]] = {
    ChallengeDuration.ONE_DAY: timedelta(days=1),
    ChallengeDuration.THREE_DAYS: timedelta(days=3),
    ChallengeDuration.ONE_WEEK: timedelta(weeks=1),
    ChallengeDuration.TWO_WEEKS: timedelta(weeks=2),
    ChallengeDuration.ONE_MONTH: timedelta(days=30),
    ChallengeDuration.NO_LIMIT: None,
}


class ChallengeService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def _sample_questions(
        self, subject_name: Optional[str], difficulty, question_count: int
    ) -> List[Question]:
        query = select(Question).where(Question.status == QuestionStatus.PUBLISHED)
        if subject_name:
            query = (
                query.join(Subtopic, Subtopic.id == Question.subtopic_id)
                .join(Topic, Topic.id == Subtopic.topic_id)
                .join(Subject, Subject.id == Topic.subject_id)
                .where(Subject.name.ilike(f"%{subject_name.strip()}%"))
            )
        if difficulty:
            query = query.where(Question.difficulty == difficulty)
        query = query.order_by(func.random()).limit(question_count)
        res = await self.session.exec(query)
        return list(res.all())

    async def create_challenge(
        self, creator: User, payload: CreateChallengeRequest
    ) -> ChallengeSummary:
        questions = await self._sample_questions(
            payload.subject_name, payload.difficulty, payload.question_count
        )
        if not questions:
            raise HTTPException(
                status_code=400,
                detail="No published questions match the selected subject/difficulty. Try broadening your filters.",
            )

        delta = DURATION_DELTAS[payload.duration]
        expires_at = (datetime.now(timezone.utc) + delta) if delta else None

        challenge = Challenge(
            creator_id=creator.id,
            title=payload.title,
            description=payload.description,
            question_count=len(questions),
            difficulty=payload.difficulty,
            subject_name=payload.subject_name,
            time_limit_minutes=payload.time_limit_minutes,
            visibility=payload.visibility,
            share_token=secrets.token_urlsafe(12),
            expires_at=expires_at,
        )
        self.session.add(challenge)
        await self.session.flush()

        for idx, q in enumerate(questions):
            self.session.add(
                ChallengeQuestion(challenge_id=challenge.id, question_id=q.id, order_index=idx)
            )

        await self.session.commit()
        await self.session.refresh(challenge)

        return ChallengeSummary(
            id=challenge.id,
            title=challenge.title,
            description=challenge.description,
            question_count=challenge.question_count,
            time_limit_minutes=challenge.time_limit_minutes,
            visibility=challenge.visibility,
            status=challenge.status,
            share_token=challenge.share_token,
            creator_id=challenge.creator_id,
            creator_name=creator.full_name,
            created_at=challenge.created_at,
            expires_at=challenge.expires_at,
        )

    async def _get_challenge_or_404(self, challenge_id: int) -> Challenge:
        challenge = await self.session.get(Challenge, challenge_id)
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        return challenge

    async def _resolve_challenge(self, id_or_token: str) -> Challenge:
        if str(id_or_token).isdigit():
            challenge = await self.session.get(Challenge, int(id_or_token))
        else:
            res = await self.session.exec(
                select(Challenge).where(Challenge.share_token == id_or_token)
            )
            challenge = res.first()
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        return challenge

    async def _assert_can_view(self, challenge: Challenge, user: User) -> None:
        if challenge.visibility == ChallengeVisibility.PUBLIC:
            return
        if challenge.creator_id == user.id:
            return
        res = await self.session.exec(
            select(ChallengeInvite).where(
                ChallengeInvite.challenge_id == challenge.id,
                ChallengeInvite.invited_user_id == user.id,
            )
        )
        if res.first():
            return
        raise HTTPException(status_code=403, detail="You do not have access to this challenge")

    async def get_public_preview(self, share_token: str) -> ChallengePublicPreview:
        res = await self.session.exec(select(Challenge).where(Challenge.share_token == share_token))
        challenge = res.first()
        if not challenge:
            raise HTTPException(status_code=404, detail="Challenge not found")
        creator = await self.session.get(User, challenge.creator_id)
        is_expired = bool(challenge.expires_at and challenge.expires_at < datetime.now(timezone.utc))
        return ChallengePublicPreview(
            id=challenge.id,
            title=challenge.title,
            description=challenge.description,
            question_count=challenge.question_count,
            time_limit_minutes=challenge.time_limit_minutes,
            creator_name=creator.full_name if creator else None,
            share_token=challenge.share_token,
            expires_at=challenge.expires_at,
            is_expired=is_expired,
        )

    async def list_my_challenges(self, user: User) -> List[ChallengeSummary]:
        created_res = await self.session.exec(
            select(Challenge).where(Challenge.creator_id == user.id).order_by(Challenge.created_at.desc())
        )
        created = list(created_res.all())

        invited_res = await self.session.exec(
            select(Challenge)
            .join(ChallengeInvite, ChallengeInvite.challenge_id == Challenge.id)
            .where(ChallengeInvite.invited_user_id == user.id)
            .order_by(Challenge.created_at.desc())
        )
        invited = list(invited_res.all())

        seen_ids = set()
        combined: List[Challenge] = []
        for c in created + invited:
            if c.id not in seen_ids:
                seen_ids.add(c.id)
                combined.append(c)

        summaries: List[ChallengeSummary] = []
        c_ids = [c.id for c in combined if c.id is not None]

        # 1. Bulk aggregate attempt counts and user best scores
        stats_map: Dict[int, tuple] = {}
        if c_ids:
            stats_stmt = (
                select(
                    ChallengeAttempt.challenge_id,
                    func.count().label("attempt_count"),
                    func.max(case((ChallengeAttempt.user_id == user.id, ChallengeAttempt.total_score), else_=None)).label("my_best"),
                )
                .where(
                    ChallengeAttempt.challenge_id.in_(c_ids),
                    ChallengeAttempt.status == ChallengeAttemptStatus.SUBMITTED,
                )
                .group_by(ChallengeAttempt.challenge_id)
            )
            for row in (await self.session.exec(stats_stmt)).all():
                stats_map[row[0]] = (row[1] or 0, row[2])

        # 2. Bulk load external creators in 1 query
        other_creator_ids = list({c.creator_id for c in combined if c.creator_id and c.creator_id != user.id})
        creators_map: Dict[int, User] = {}
        if other_creator_ids:
            users_res = await self.session.exec(select(User).where(User.id.in_(other_creator_ids)))
            creators_map = {u.id: u for u in users_res.all()}

        for c in combined:
            attempt_count, my_best = stats_map.get(c.id, (0, None))
            creator = user if c.creator_id == user.id else creators_map.get(c.creator_id)
            summaries.append(
                ChallengeSummary(
                    id=c.id,
                    title=c.title,
                    description=c.description,
                    question_count=c.question_count,
                    time_limit_minutes=c.time_limit_minutes,
                    visibility=c.visibility,
                    status=c.status,
                    share_token=c.share_token,
                    creator_id=c.creator_id,
                    creator_name=creator.full_name if creator else None,
                    created_at=c.created_at,
                    expires_at=c.expires_at,
                    attempt_count=attempt_count,
                    my_best_score=my_best,
                )
            )
        return summaries

    async def get_challenge_summary(self, challenge_id: int, user: User) -> ChallengeSummary:
        challenge = await self._get_challenge_or_404(challenge_id)
        await self._assert_can_view(challenge, user)

        creator = user if challenge.creator_id == user.id else await self.session.get(User, challenge.creator_id)
        attempt_count = (await self.session.exec(
            select(func.count()).select_from(ChallengeAttempt).where(
                ChallengeAttempt.challenge_id == challenge.id,
                ChallengeAttempt.status == ChallengeAttemptStatus.SUBMITTED.value,
            )
        )).one()
        my_best = (await self.session.exec(
            select(func.max(ChallengeAttempt.total_score)).where(
                ChallengeAttempt.challenge_id == challenge.id,
                ChallengeAttempt.user_id == user.id,
                ChallengeAttempt.status == ChallengeAttemptStatus.SUBMITTED.value,
            )
        )).one()
        return ChallengeSummary(
            id=challenge.id,
            title=challenge.title,
            description=challenge.description,
            question_count=challenge.question_count,
            time_limit_minutes=challenge.time_limit_minutes,
            visibility=challenge.visibility,
            status=challenge.status,
            share_token=challenge.share_token,
            creator_id=challenge.creator_id,
            creator_name=creator.full_name if creator else None,
            created_at=challenge.created_at,
            expires_at=challenge.expires_at,
            attempt_count=attempt_count or 0,
            my_best_score=my_best,
        )

    async def invite_user(self, challenge_id: int, inviter: User, email: str) -> None:
        challenge = await self._get_challenge_or_404(challenge_id)
        if challenge.creator_id != inviter.id:
            raise HTTPException(status_code=403, detail="Only the creator can invite users")

        res = await self.session.exec(select(User).where(User.email == email))
        invited_user = res.first()
        if not invited_user:
            raise HTTPException(status_code=404, detail="No user found with that email")

        existing = await self.session.exec(
            select(ChallengeInvite).where(
                ChallengeInvite.challenge_id == challenge_id,
                ChallengeInvite.invited_user_id == invited_user.id,
            )
        )
        if existing.first():
            return

        self.session.add(
            ChallengeInvite(
                challenge_id=challenge_id,
                invited_user_id=invited_user.id,
                invited_by_id=inviter.id,
                status=ChallengeInviteStatus.PENDING,
            )
        )
        await self.session.commit()

    async def _build_question_cards(
        self, questions: List[ChallengeQuestion], language: LanguageCode = LanguageCode.ENGLISH
    ) -> List[ChallengeQuestionOut]:
        q_ids = [cq.question_id for cq in questions]
        if not q_ids:
            return []

        qt_res = await self.session.exec(
            select(QuestionTranslation).where(QuestionTranslation.question_id.in_(q_ids))
        )
        qt_map: Dict[int, Dict[str, str]] = {}
        for qt in qt_res.all():
            qt_map.setdefault(qt.question_id, {})[qt.language] = qt.question_text

        opt_res = await self.session.exec(
            select(QuestionOption)
            .where(QuestionOption.question_id.in_(q_ids))
            .order_by(QuestionOption.question_id, QuestionOption.display_order)
        )
        options = list(opt_res.all())
        opt_ids = [o.id for o in options]

        ot_map: Dict[int, Dict[str, str]] = {}
        if opt_ids:
            ot_res = await self.session.exec(
                select(OptionTranslation).where(OptionTranslation.option_id.in_(opt_ids))
            )
            for ot in ot_res.all():
                ot_map.setdefault(ot.option_id, {})[ot.language] = ot.option_text

        opt_by_question: Dict[int, list] = {}
        for o in options:
            opt_by_question.setdefault(o.question_id, []).append(o)

        lang_key = language.value if hasattr(language, "value") else str(language)
        cards: List[ChallengeQuestionOut] = []
        for cq in questions:
            q_trans = qt_map.get(cq.question_id, {})
            text = q_trans.get(lang_key) or (next(iter(q_trans.values())) if q_trans else "")
            opts_out = []
            for o in opt_by_question.get(cq.question_id, []):
                o_trans = ot_map.get(o.id, {})
                o_text = o_trans.get(lang_key) or (next(iter(o_trans.values())) if o_trans else o.option_label)
                opts_out.append(
                    ChallengeQuestionOption(option_id=o.id, option_label=o.option_label, text=o_text)
                )
            cards.append(
                ChallengeQuestionOut(
                    question_id=cq.question_id,
                    order_index=cq.order_index,
                    text=text,
                    options=opts_out,
                )
            )
        cards.sort(key=lambda c: c.order_index)
        return cards

    async def start_attempt(self, id_or_token: str, user: User) -> StartChallengeAttemptResponse:
        challenge = await self._resolve_challenge(id_or_token)
        await self._assert_can_view(challenge, user)

        existing_res = await self.session.exec(
            select(ChallengeAttempt).where(
                ChallengeAttempt.challenge_id == challenge.id,
                ChallengeAttempt.user_id == user.id,
                ChallengeAttempt.status == ChallengeAttemptStatus.IN_PROGRESS,
            )
        )
        attempt = existing_res.first()
        if not attempt:
            if challenge.expires_at and challenge.expires_at < datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=400,
                    detail=f"This challenge closed on {challenge.expires_at.isoformat()} and is no longer accepting new attempts.",
                )
            attempt = ChallengeAttempt(challenge_id=challenge.id, user_id=user.id)
            self.session.add(attempt)
            await self.session.commit()
            await self.session.refresh(attempt)

        cq_res = await self.session.exec(
            select(ChallengeQuestion)
            .where(ChallengeQuestion.challenge_id == challenge.id)
            .order_by(ChallengeQuestion.order_index)
        )
        questions = await self._build_question_cards(list(cq_res.all()))

        return StartChallengeAttemptResponse(
            attempt_id=attempt.id,
            challenge_id=challenge.id,
            questions=questions,
            time_limit_minutes=challenge.time_limit_minutes,
        )

    async def _get_attempt_or_404(self, attempt_id: int, user: User) -> ChallengeAttempt:
        attempt = await self.session.get(ChallengeAttempt, attempt_id)
        if not attempt or attempt.user_id != user.id:
            raise HTTPException(status_code=404, detail="Attempt not found")
        return attempt

    async def save_response(
        self, attempt_id: int, user: User, question_id: int,
        selected_option_id: Optional[int], time_spent_seconds: float,
    ) -> None:
        attempt = await self._get_attempt_or_404(attempt_id, user)
        if attempt.status != ChallengeAttemptStatus.IN_PROGRESS:
            raise HTTPException(status_code=400, detail="Attempt already submitted")

        belongs_res = await self.session.exec(
            select(ChallengeQuestion).where(
                ChallengeQuestion.challenge_id == attempt.challenge_id,
                ChallengeQuestion.question_id == question_id,
            )
        )
        if not belongs_res.first():
            raise HTTPException(status_code=400, detail="Question does not belong to this challenge")

        is_correct = False
        if selected_option_id is not None:
            option = await self.session.get(QuestionOption, selected_option_id)
            is_correct = bool(option and option.is_correct and option.question_id == question_id)

        res = await self.session.exec(
            select(ChallengeResponse).where(
                ChallengeResponse.attempt_id == attempt_id,
                ChallengeResponse.question_id == question_id,
            )
        )
        response = res.first()
        if response:
            response.selected_option_id = selected_option_id
            response.is_correct = is_correct
            response.time_spent_seconds = time_spent_seconds
            response.answered_at = datetime.now(timezone.utc)
        else:
            response = ChallengeResponse(
                attempt_id=attempt_id,
                question_id=question_id,
                selected_option_id=selected_option_id,
                is_correct=is_correct,
                time_spent_seconds=time_spent_seconds,
            )
        self.session.add(response)
        await self.session.commit()

    async def submit_attempt(self, attempt_id: int, user: User) -> SubmitChallengeAttemptResponse:
        attempt = await self._get_attempt_or_404(attempt_id, user)
        if attempt.status == ChallengeAttemptStatus.SUBMITTED:
            return SubmitChallengeAttemptResponse(
                attempt_id=attempt.id,
                total_score=attempt.total_score,
                total_correct=attempt.total_correct,
                total_incorrect=attempt.total_incorrect,
                total_unattempted=attempt.total_unattempted,
                time_spent_seconds=attempt.time_spent_seconds,
            )

        total_questions = (await self.session.exec(
            select(func.count()).select_from(ChallengeQuestion).where(
                ChallengeQuestion.challenge_id == attempt.challenge_id
            )
        )).one()
        responses_res = await self.session.exec(
            select(ChallengeResponse).where(ChallengeResponse.attempt_id == attempt_id)
        )
        responses = list(responses_res.all())

        correct = sum(1 for r in responses if r.is_correct)
        answered = sum(1 for r in responses if r.selected_option_id is not None)
        incorrect = answered - correct
        unattempted = max(0, (total_questions or 0) - answered)
        time_spent = sum(r.time_spent_seconds for r in responses)

        attempt.total_correct = correct
        attempt.total_incorrect = incorrect
        attempt.total_unattempted = unattempted
        attempt.total_score = float(correct)
        attempt.time_spent_seconds = time_spent
        attempt.status = ChallengeAttemptStatus.SUBMITTED
        attempt.submitted_at = datetime.now(timezone.utc)
        self.session.add(attempt)
        await self.session.commit()
        await self.session.refresh(attempt)

        return SubmitChallengeAttemptResponse(
            attempt_id=attempt.id,
            total_score=attempt.total_score,
            total_correct=attempt.total_correct,
            total_incorrect=attempt.total_incorrect,
            total_unattempted=attempt.total_unattempted,
            time_spent_seconds=attempt.time_spent_seconds,
        )

    async def get_leaderboard(self, challenge_id: int, user: User) -> List[LeaderboardEntry]:
        challenge = await self._get_challenge_or_404(challenge_id)
        await self._assert_can_view(challenge, user)

        res = await self.session.exec(
            select(ChallengeAttempt)
            .where(
                ChallengeAttempt.challenge_id == challenge_id,
                ChallengeAttempt.status == ChallengeAttemptStatus.SUBMITTED.value,
            )
            .order_by(ChallengeAttempt.total_score.desc(), ChallengeAttempt.time_spent_seconds.asc())
        )
        attempts = list(res.all())
        user_ids = list({a.user_id for a in attempts})
        users_map: Dict[int, User] = {}
        if user_ids:
            u_res = await self.session.exec(select(User).where(User.id.in_(user_ids)))
            users_map = {u.id: u for u in u_res.all()}

        entries: List[LeaderboardEntry] = []
        for a in attempts:
            u = users_map.get(a.user_id)
            entries.append(
                LeaderboardEntry(
                    user_id=a.user_id,
                    user_name=u.full_name if u else "Unknown",
                    total_score=a.total_score,
                    total_correct=a.total_correct,
                    time_spent_seconds=a.time_spent_seconds,
                    submitted_at=a.submitted_at,
                    is_current_user=(a.user_id == user.id),
                )
            )
        return entries
