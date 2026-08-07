import uuid
import json
from typing import Optional, Dict, Any, List
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from app.db.models import (
    Question,
    QuestionTranslation,
    QuestionOption,
    OptionTranslation,
    QuestionExplanation,
    Subtopic,
    Topic,
    Subject,
    LanguageCode,
)


class ExplanationRepository:
    """Repository handling database queries for Question Knowledge Base & Explanations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_explanation_for_question(
        self, question_id: uuid.UUID, language: LanguageCode = LanguageCode.ENGLISH
    ) -> Optional[QuestionExplanation]:
        stmt = select(QuestionExplanation).where(
            QuestionExplanation.question_id == question_id,
            QuestionExplanation.language == language,
        )
        res = await self.session.exec(stmt)
        return res.first()

    async def get_full_question_knowledge_base(
        self, question_id: uuid.UUID, language: LanguageCode = LanguageCode.ENGLISH
    ) -> Optional[Dict[str, Any]]:
        """Retrieves full per-question & per-option knowledge base and taxonomy hierarchy for reports."""
        q = await self.session.get(Question, question_id)
        if not q:
            return None

        # Check canonical question fallback
        effective_q_id = q.canonical_question_id or q.id

        # Fetch Question Text
        qt_stmt = select(QuestionTranslation).where(
            QuestionTranslation.question_id == effective_q_id,
            QuestionTranslation.language == language,
        )
        qt_res = await self.session.exec(qt_stmt)
        q_trans = qt_res.first()

        # Fetch QuestionExplanation
        expl = await self.get_explanation_for_question(effective_q_id, language)

        # Fetch Options & Option Translations
        opt_stmt = select(QuestionOption).where(
            QuestionOption.question_id == effective_q_id
        )
        opt_res = await self.session.exec(opt_stmt)
        options = sorted(opt_res.all(), key=lambda o: o.display_order)

        options_breakdown = []
        for opt in options:
            ot_stmt = select(OptionTranslation).where(
                OptionTranslation.option_id == opt.id,
                OptionTranslation.language == language,
            )
            ot_res = await self.session.exec(ot_stmt)
            o_trans = ot_res.first()

            options_breakdown.append(
                {
                    "option_id": str(opt.id),
                    "option_key": opt.option_label,
                    "is_correct": opt.is_correct,
                    "option_text": o_trans.option_text if o_trans else None,
                    "explanation": o_trans.distractor_analysis if o_trans else None,
                }
            )

        # Taxonomy Hierarchy Resolution
        subject_name = "General Subject"
        topic_name = "General Topic"
        subtopic_name = "General Subtopic"

        if q.subtopic_id:
            subtop = await self.session.get(Subtopic, q.subtopic_id)
            if subtop:
                subtopic_name = subtop.name
                top = await self.session.get(Topic, subtop.topic_id)
                if top:
                    topic_name = top.name
                    subj = await self.session.get(Subject, top.subject_id)
                    if subj:
                        subject_name = subj.name

        def parse_json_list(val: Any) -> List[str]:
            if not val:
                return []
            if isinstance(val, list):
                return val
            if isinstance(val, str):
                try:
                    res = json.loads(val)
                    return res if isinstance(res, list) else []
                except Exception:
                    return []
            return []

        return {
            "question_id": str(q.id),
            "canonical_question_id": str(q.canonical_question_id)
            if q.canonical_question_id
            else None,
            "language": language.value,
            "question_text": q_trans.question_text if q_trans else None,
            "core_concept": expl.core_concept if expl else None,
            "detailed_solution": expl.detailed_solution if expl else None,
            "common_traps": parse_json_list(expl.common_traps_json) if expl else [],
            "key_takeaways": parse_json_list(expl.key_takeaways_json) if expl else [],
            "options_breakdown": options_breakdown,
            "subject": subject_name,
            "topic": topic_name,
            "subtopic": subtopic_name,
            "difficulty": q.difficulty.value if q.difficulty else "MEDIUM",
        }

    async def set_canonical_question(
        self, question_id: uuid.UUID, canonical_question_id: uuid.UUID
    ) -> bool:
        q = await self.session.get(Question, question_id)
        if not q:
            return False
        q.canonical_question_id = canonical_question_id
        self.session.add(q)
        await self.session.commit()
        return True
