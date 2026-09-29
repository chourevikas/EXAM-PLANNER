"""Knowledge Layer enrichment: turns a stored question into canonical concept/entity/relationship links.

Runs after extraction (never inside it). Inputs, all optional:
- `questions.knowledge_tags_ai` — concepts/entities/relationships extracted by the LLM (the main
  source; the content team does not tag questions), plus Subject > Microtheme > Nano Theme and
  difficulty for questions the PDF left untagged. Stored per question and reused while the question text and
  prompt version are unchanged, so re-runs don't call the model again.
- `questions.knowledge_tags_raw` — authored [Concepts]/[Entities]/[Relationships] tags + Related refs
- English stem, options and correct answer
- English solution (detailed_solution)

Each run replaces the question's links, so it is idempotent and safe to repeat after the
dictionaries grow. Invalid items are dropped and reported; nothing here raises into ingestion.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Tuple

from sqlalchemy import delete, func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models import (
    DifficultyLevel,
    Exam,
    LanguageCode,
    OptionTranslation,
    Question,
    QuestionHierarchyLink,
    QuestionExplanation,
    QuestionOption,
    QuestionTranslation,
    Subject,
    Subtopic,
    Topic,
)
from app.db.models.knowledge import (
    KnowledgeAlias,
    KnowledgeConcept,
    KnowledgeEntity,
    KnowledgeRelationship,
    QuestionConcept,
    QuestionEntity,
    QuestionRelationship,
)
from app.knowledge.ai_extractor import (
    MAX_SYLLABUS_LINES,
    PROMPT_FINGERPRINT,
    PROMPT_VERSION,
    SYLLABUS_LEVELS,
    KnowledgeAIExtractor,
    QuestionTexts,
    Vocabulary,
)
from app.knowledge.extractor import AliasScanner, extract_names, related_refs_from_solution
from app.llm.usage import llm_usage_scope
from app.knowledge.normalize import normalize_key
from app.knowledge.resolver import KnowledgeResolver, NodeRef, infer_entity_type
from app.knowledge.vocabulary import (
    LINK_WEIGHTS,
    NODE_CONCEPT,
    NODE_ENTITY,
    SOURCE_AI,
    SOURCE_AUTHORED,
    SOURCE_RULE,
    STATUS_ACTIVE,
    normalize_relation,
)

logger = setup_logger("KnowledgeEnrichment")

# Relative link weights (multiplied into similarity scores)
PARENT_LINK_FACTOR = 0.7  # Article 15 implied by an authored Article 15(4)
SUPPORTING_RULE_WEIGHT = 0.35  # rule match found only in the solution / related refs

# EnrichmentResult.ai values
AI_EXTRACTED = "extracted"
AI_CACHED = "cached"  # stored tags reused: same text, same prompt version
AI_FAILED = "failed"  # provider error; rule-based links still applied
AI_SKIPPED = "skipped"  # nothing to send (no English stem)
AI_OFF = "off"  # no extractor configured


@dataclass
class EnrichmentResult:
    question_id: int
    concepts: int = 0
    entities: int = 0
    relationships: int = 0
    ai: str = AI_OFF
    syllabus: Optional[str] = None  # "Subject > Microtheme > Nano Theme" when AI filled missing tags
    difficulty: Optional[str] = None  # set when AI rated a question the PDF gave no difficulty
    issues: List[str] = field(default_factory=list)


@dataclass
class SyllabusState:
    """Where a question sits in the syllabus and which levels the PDF left untagged."""
    known: Dict[str, str]  # authored levels
    missing: List[str]  # untagged levels, in SYLLABUS_LEVELS order
    current: Optional[Tuple[str, str, str]]  # subject, microtheme, nano theme names in the DB
    version_id: Optional[int]
    # Still on the upload pipeline's fallback rows (Subject = exam name, Microtheme = Subject, ...);
    # only then is the AI syllabus applied, so a reviewer's manual fix is never overwritten.
    is_placeholder: bool


class KnowledgeEnrichmentService:
    """`ai_extractor` enables LLM extraction (see KnowledgeAIExtractor.from_settings); without it only
    authored tags, previously stored AI tags and rule-based extraction are used."""

    def __init__(
        self,
        session_factory: Callable[[], AsyncSession],
        ai_extractor: Optional[KnowledgeAIExtractor] = None,
    ):
        self.session_factory = session_factory
        self.ai_extractor = ai_extractor
        self._scanner: Optional[AliasScanner] = None

    async def _get_scanner(self, session: AsyncSession) -> AliasScanner:
        if self._scanner is None:
            keys = (await session.exec(select(KnowledgeAlias.normalized_alias))).all()
            self._scanner = AliasScanner(keys)
        return self._scanner

    async def enrich_exam(
        self, exam_id: int, refresh_ai: bool = False, on_progress: Optional[Callable[[int, int], object]] = None
    ) -> List[EnrichmentResult]:
        async with self.session_factory() as session:
            question_ids = (
                await session.exec(select(Question.id).where(Question.exam_id == exam_id).order_by(Question.id))
            ).all()
        with llm_usage_scope(exam_id=exam_id):
            return await self.enrich_questions(list(question_ids), refresh_ai=refresh_ai, on_progress=on_progress)

    async def enrich_questions(
        self,
        question_ids: List[int],
        refresh_ai: bool = False,
        on_progress: Optional[Callable[[int, int], object]] = None,
    ) -> List[EnrichmentResult]:
        """AI extraction (batched) for the questions that need it, then links for each question."""
        ai_status: Dict[int, str] = {}
        if self.ai_extractor:
            ai_status = await self.extract_with_ai(question_ids, refresh=refresh_ai, on_progress=on_progress)
        results = []
        for qid in question_ids:
            result = await self.enrich_question(qid)
            result.ai = ai_status.get(qid, AI_OFF)
            if result.ai == AI_FAILED:
                result.issues.append("AI_EXTRACTION_FAILED")
            results.append(result)
        return results

    async def extract_with_ai(
        self,
        question_ids: List[int],
        refresh: bool = False,
        on_progress: Optional[Callable[[int, int], object]] = None,
    ) -> Dict[int, str]:
        """Runs the LLM over questions whose stored AI tags are missing or stale and stores the result.

        A failed batch is logged and skipped (those questions keep any older AI tags); it never raises.
        """
        status: Dict[int, str] = {}
        pending: List[QuestionTexts] = []
        async with self.session_factory() as session:
            for qid in question_ids:
                texts = await self._load_question_texts(session, qid)
                if texts is None or not texts.stem.strip():
                    status[qid] = AI_SKIPPED
                    continue
                stored = (await session.get(Question, qid)).knowledge_tags_ai or {}
                if (
                    not refresh
                    and stored.get("prompt_version") == PROMPT_VERSION
                    and stored.get("input_hash") == texts.input_hash()
                ):
                    status[qid] = AI_CACHED
                    continue
                pending.append(texts)
            vocabulary = await self._load_vocabulary(session) if pending else Vocabulary()

        size = self.ai_extractor.batch_size
        for start in range(0, len(pending), size):
            batch = pending[start:start + size]
            try:
                extracted = await self.ai_extractor.extract_batch(batch, vocabulary)
            except Exception as err:
                logger.warning(f"[KNOWLEDGE-AI] Batch of {len(batch)} questions failed: {err}")
                extracted = {}
            async with self.session_factory() as session:
                for texts in batch:
                    tags = extracted.get(texts.question_id)
                    if tags is None:
                        status[texts.question_id] = AI_FAILED
                        continue
                    question = await session.get(Question, texts.question_id)
                    question.knowledge_tags_ai = {
                        **tags,
                        "model": self.ai_extractor.model_name,
                        "prompt_version": PROMPT_VERSION,
                        "prompt_fingerprint": PROMPT_FINGERPRINT,
                        "input_hash": texts.input_hash(),
                        "extracted_at": datetime.now(timezone.utc).isoformat(),
                    }
                    session.add(question)
                    status[texts.question_id] = AI_EXTRACTED
                await session.commit()
            if on_progress:
                await _maybe_await(on_progress(min(start + size, len(pending)), len(pending)))
        return status

    async def enrich_question(self, question_id: int) -> EnrichmentResult:
        """Rebuilds one question's links from its stored inputs (no LLM call)."""
        result = EnrichmentResult(question_id=question_id)
        async with self.session_factory() as session:
            try:
                await self._enrich(session, question_id, result)
                await session.commit()
            except Exception as err:  # enrichment must never break ingestion or a backfill run
                await session.rollback()
                logger.warning(f"[KNOWLEDGE] Enrichment failed for question {question_id}: {err}")
                result.issues.append(f"ENRICHMENT_FAILED: {err}")
        return result

    async def _enrich(self, session: AsyncSession, question_id: int, result: EnrichmentResult) -> None:
        question = await session.get(Question, question_id)
        if not question:
            result.issues.append("QUESTION_NOT_FOUND")
            return

        raw = question.knowledge_tags_raw or {}
        ai = question.knowledge_tags_ai or {}
        if ai.get("syllabus"):
            state = await self._syllabus_state(session, question)
            if state.is_placeholder and state.version_id:
                result.syllabus = await self._assign_syllabus(session, question, state.version_id, ai["syllabus"])
        # AI difficulty replaces only the upload default (MEDIUM when the PDF had no tag), so a PDF
        # tag or a reviewer's other choice is kept
        ai_difficulty = ai.get("difficulty")
        if (
            ai_difficulty in DifficultyLevel.__members__
            and not (question.difficulty_raw or "").strip()
            and question.difficulty == DifficultyLevel.MEDIUM
            and ai_difficulty != DifficultyLevel.MEDIUM.value
        ):
            question.difficulty = DifficultyLevel(ai_difficulty)
            session.add(question)
            result.difficulty = ai_difficulty
        stem, options, answer, solution = await self._load_texts(session, question_id)
        resolver = KnowledgeResolver(session)
        scanner = await self._get_scanner(session)

        # node -> (weight, source); the strongest evidence for a node wins
        links: Dict[Tuple[str, int], Tuple[float, str, NodeRef]] = {}

        def _link(node: Optional[NodeRef], weight: float, source: str) -> None:
            if not node:
                return
            key = (node.kind, node.id)
            if key not in links or links[key][0] < weight:
                links[key] = (weight, source, node)

        tagged_entities = {normalize_key(n) for n in [*raw.get("entities", []), *ai.get("entities", [])]}
        tagged_concepts = {normalize_key(n) for n in [*raw.get("concepts", []), *ai.get("concepts", [])]}

        for name in raw.get("concepts", []):
            _link(await resolver.resolve(name, NODE_CONCEPT), LINK_WEIGHTS[SOURCE_AUTHORED], SOURCE_AUTHORED)
        for name in raw.get("entities", []):
            node = await resolver.resolve(name, NODE_ENTITY)
            _link(node, LINK_WEIGHTS[SOURCE_AUTHORED], SOURCE_AUTHORED)

        # AI tags: same handling as authored ones, at a lower weight (authored wins when both exist)
        ai_types = ai.get("entity_types") or {}
        for name in ai.get("concepts", []):
            _link(await resolver.resolve(name, NODE_CONCEPT), LINK_WEIGHTS[SOURCE_AI], SOURCE_AI)
        for name in ai.get("entities", []):
            _link(await resolver.resolve(name, NODE_ENTITY, ai_types.get(name)), LINK_WEIGHTS[SOURCE_AI], SOURCE_AI)

        # Rule-based names: always run; authored links keep their higher weight
        related_refs = raw.get("related_refs") or related_refs_from_solution(solution)
        names = extract_names([stem, *options, answer], [solution], related_refs, scanner)
        for name, weight in [(n, LINK_WEIGHTS[SOURCE_RULE]) for n in names.core] + [
            (n, SUPPORTING_RULE_WEIGHT) for n in names.supporting
        ]:
            existing = await resolver.lookup(name)
            # Only explicit Article/Act/case shapes may create new nodes from text; everything else must be known
            node = existing or await resolver.resolve(name, create=_is_creatable(name))
            _link(node, weight, SOURCE_RULE)

        # A sub-provision implies its parent provision ("Article 15(4)" -> "Article 15")
        for weight, source, node in list(links.values()):
            if node.kind == NODE_ENTITY and node.parent_id:
                parent = await resolver.load(NODE_ENTITY, node.parent_id)
                _link(parent, weight * PARENT_LINK_FACTOR, source)

        relationship_ids = []
        for rel in [*raw.get("relationships", []), *ai.get("relationships", [])]:
            src_name, tgt_name = (rel.get("source") or "").strip(), (rel.get("target") or "").strip()
            if not src_name or not tgt_name:
                result.issues.append(f"EMPTY_RELATIONSHIP_END: {rel}")
                continue
            relation, known = normalize_relation(rel.get("relation"))
            if not known:
                result.issues.append(f"UNKNOWN_RELATION '{rel.get('relation')}' stored as related_to")
            src = await resolver.resolve(src_name, _preferred_kind(src_name, tagged_entities, tagged_concepts))
            tgt = await resolver.resolve(tgt_name, _preferred_kind(tgt_name, tagged_entities, tagged_concepts))
            if not src or not tgt or (src.kind, src.id) == (tgt.kind, tgt.id):
                result.issues.append(f"INVALID_RELATIONSHIP: {src_name} -> {tgt_name}")
                continue
            relationship_ids.append(await self._upsert_relationship(session, src, relation, tgt, question_id))

        # Replace this question's links
        await session.exec(delete(QuestionConcept).where(col(QuestionConcept.question_id) == question_id))
        await session.exec(delete(QuestionEntity).where(col(QuestionEntity.question_id) == question_id))
        await session.exec(delete(QuestionRelationship).where(col(QuestionRelationship.question_id) == question_id))
        for (kind, node_id), (weight, source, _node) in links.items():
            if kind == NODE_CONCEPT:
                session.add(QuestionConcept(question_id=question_id, concept_id=node_id, weight=weight, source=source))
                result.concepts += 1
            else:
                session.add(QuestionEntity(question_id=question_id, entity_id=node_id, relevance=weight, source=source))
                result.entities += 1
        for rel_id in dict.fromkeys(relationship_ids):
            session.add(QuestionRelationship(question_id=question_id, relationship_id=rel_id))
            result.relationships += 1
        result.issues.extend(raw.get("issues", []))

    async def _upsert_relationship(
        self, session: AsyncSession, src: NodeRef, relation: str, tgt: NodeRef, question_id: int
    ) -> int:
        edge = (
            await session.exec(
                select(KnowledgeRelationship).where(
                    KnowledgeRelationship.source_kind == src.kind,
                    KnowledgeRelationship.source_id == src.id,
                    KnowledgeRelationship.relation_type == relation,
                    KnowledgeRelationship.target_kind == tgt.kind,
                    KnowledgeRelationship.target_id == tgt.id,
                )
            )
        ).first()
        if edge:
            return edge.id
        edge = KnowledgeRelationship(
            source_kind=src.kind, source_id=src.id, relation_type=relation,
            target_kind=tgt.kind, target_id=tgt.id, source_question_id=question_id,
        )
        session.add(edge)
        await session.flush()
        return edge.id

    async def _load_question_texts(self, session: AsyncSession, question_id: int) -> Optional[QuestionTexts]:
        question = await session.get(Question, question_id)
        if not question:
            return None
        stem, options, answer, solution = await self._load_texts(session, question_id)
        state = await self._syllabus_state(session, question)
        subject, topic, subtopic = state.current or (None, None, None)
        return QuestionTexts(
            question_id=question_id, stem=stem, options=options, answer=answer, solution=solution,
            subject=subject, topic=topic, subtopic=subtopic,
            # Based on the PDF's tags (not the current rows), so the hash stays stable after assignment
            syllabus_known=state.known, syllabus_missing=state.missing,
            pdf_section=(question.knowledge_tags_raw or {}).get("section"),
            source=(question.knowledge_tags_raw or {}).get("source"),
            difficulty_missing=not (question.difficulty_raw or "").strip(),
        )

    async def _syllabus_state(self, session: AsyncSession, question: Question) -> SyllabusState:
        raws = [(question.subject_raw or "").strip(), (question.topic_raw or "").strip(), (question.subtopic_raw or "").strip()]
        known = {level: value for level, value in zip(SYLLABUS_LEVELS, raws) if value}
        missing = [level for level, value in zip(SYLLABUS_LEVELS, raws) if not value]

        current, version_id = None, None
        if question.subtopic_id:
            row = (
                await session.exec(
                    select(Subject.name, Topic.name, Subtopic.name, Subject.version_id)
                    .join(Topic, Topic.id == Subtopic.topic_id)
                    .join(Subject, Subject.id == Topic.subject_id)
                    .where(Subtopic.id == question.subtopic_id)
                )
            ).first()
            if row:
                current, version_id = (row[0], row[1], row[2]), row[3]

        is_placeholder = False
        if missing and current:
            exam_name = (await session.get(Exam, question.exam_id)).name if question.exam_id else ""
            # Mirrors BatchQuestionRegistrar: subject -> exam name, microtheme -> subject, nano -> microtheme
            s_name = raws[0] or (exam_name or "").strip()
            t_name = raws[1] or s_name
            st_name = raws[2] or t_name
            is_placeholder = tuple(n.strip().lower() for n in current) == (s_name.lower(), t_name.lower(), st_name.lower())
        return SyllabusState(known, missing, current, version_id, is_placeholder)

    async def _assign_syllabus(
        self, session: AsyncSession, question: Question, version_id: int, syllabus: Dict[str, str]
    ) -> Optional[str]:
        """Moves the question to Subject > Microtheme > Nano Theme in its exam's syllabus version,
        reusing rows by case-insensitive name and creating missing ones like the upload pipeline does."""
        names = [(syllabus.get(level) or "").strip()[:200] for level in SYLLABUS_LEVELS]
        if not all(names):
            return None

        async def _get_or_create(model, parent_field: str, parent_id: int, name: str):
            parent_col = getattr(model, parent_field)
            row = (
                await session.exec(select(model).where(parent_col == parent_id, func.lower(model.name) == name.lower()))
            ).first()
            if row:
                return row
            # New in this exam's syllabus version: keep the spelling other papers already use ("Polity")
            name = (
                await session.exec(select(model.name).where(func.lower(model.name) == name.lower()).order_by(model.id))
            ).first() or name
            count = (await session.exec(select(func.count(model.id)).where(parent_col == parent_id))).one()
            row = model(**{parent_field: parent_id}, name=name, code=name[:10].upper().replace(" ", "_"), display_order=count + 1)
            session.add(row)
            await session.flush()
            return row

        subject = await _get_or_create(Subject, "version_id", version_id, names[0])
        topic = await _get_or_create(Topic, "subject_id", subject.id, names[1])
        subtopic = await _get_or_create(Subtopic, "topic_id", topic.id, names[2])

        old_subtopic_id = question.subtopic_id
        if old_subtopic_id != subtopic.id:
            question.subtopic_id = subtopic.id
            session.add(question)
            links = (
                await session.exec(select(QuestionHierarchyLink).where(QuestionHierarchyLink.question_id == question.id))
            ).all()
            existing = next((link for link in links if link.subtopic_id == subtopic.id), None)
            for link in links:
                if link.subtopic_id != old_subtopic_id:
                    continue
                if existing:  # (question, subtopic) is unique: keep the one row, carry over primary
                    existing.is_primary = existing.is_primary or link.is_primary
                    await session.delete(link)
                else:
                    link.subtopic_id = subtopic.id
                    existing = link
            if existing:
                existing.topic_id, existing.subject_id = topic.id, subject.id
                session.add(existing)
            await session.flush()
            await self._remove_unused_placeholder(session, old_subtopic_id)
        return " > ".join(names)

    async def _remove_unused_placeholder(self, session: AsyncSession, subtopic_id: Optional[int]) -> None:
        """Deletes an upload fallback row ("UPPCS > UPPCS > UPPCS") once nothing points at it, then its
        Microtheme and Subject if they are left empty, so the syllabus and admin catalog don't fill up
        with empty placeholders. Rows referenced by passages or student progress are always kept."""
        from app.db.models.analytics import UserMemoryState
        from app.db.models.passage import Passage
        from app.db.models.telemetry import UserConceptRetention

        subtopic = await session.get(Subtopic, subtopic_id) if subtopic_id else None
        if not subtopic:
            return
        for model in (Question, QuestionHierarchyLink, Passage, UserConceptRetention, UserMemoryState):
            if (await session.exec(select(model.id).where(model.subtopic_id == subtopic_id).limit(1))).first():
                return
        topic_id = subtopic.topic_id
        await session.delete(subtopic)
        await session.flush()
        if (await session.exec(select(Subtopic.id).where(Subtopic.topic_id == topic_id).limit(1))).first():
            return
        topic = await session.get(Topic, topic_id)
        subject_id = topic.subject_id
        await session.delete(topic)
        await session.flush()
        if not (await session.exec(select(Topic.id).where(Topic.subject_id == subject_id).limit(1))).first():
            await session.delete(await session.get(Subject, subject_id))
            await session.flush()

    async def _load_vocabulary(self, session: AsyncSession) -> Vocabulary:
        """Existing canonical names (curated first) so the model reuses them instead of inventing variants."""
        def _names(model):
            return (
                select(model.canonical_name)
                .order_by((model.status != STATUS_ACTIVE), model.id)
                .limit(400)
            )

        return Vocabulary(
            concepts=list((await session.exec(_names(KnowledgeConcept))).all()),
            entities=list((await session.exec(_names(KnowledgeEntity))).all()),
            syllabus=await self._load_syllabus_lines(session),
        )

    async def _load_syllabus_lines(self, session: AsyncSession) -> List[str]:
        """Distinct "Subject > Microtheme > Nano Theme" lines across all papers, most-used first.

        Skips the upload pipeline's fallback rows (Subject named after an exam, Microtheme equal to
        its Subject, Nano Theme equal to its Microtheme) so the model isn't nudged towards them."""
        exam_names = {(n or "").strip().lower() for n in (await session.exec(select(Exam.name))).all()}
        rows = (
            await session.exec(
                select(Subject.name, Topic.name, Subtopic.name, func.count(Question.id))
                .join(Topic, Topic.subject_id == Subject.id)
                .join(Subtopic, Subtopic.topic_id == Topic.id)
                .join(Question, Question.subtopic_id == Subtopic.id, isouter=True)
                .group_by(Subject.name, Topic.name, Subtopic.name)
                .order_by(func.count(Question.id).desc(), Subject.name, Topic.name, Subtopic.name)
            )
        ).all()
        counts: Dict[Tuple[str, str, str], int] = {}
        display: Dict[Tuple[str, str, str], str] = {}
        for s_name, t_name, st_name, n in rows:
            s_l, t_l, st_l = (s_name or "").strip().lower(), (t_name or "").strip().lower(), (st_name or "").strip().lower()
            if not (s_l and t_l and st_l) or s_l in exam_names or t_l == s_l or st_l == t_l:
                continue
            key = (s_l, t_l, st_l)
            counts[key] = counts.get(key, 0) + n
            display.setdefault(key, f"{s_name.strip()} > {t_name.strip()} > {st_name.strip()}")
        ranked = sorted(counts, key=lambda k: (-counts[k], k))
        return [display[k] for k in ranked[:MAX_SYLLABUS_LINES]]

    async def _load_texts(self, session: AsyncSession, question_id: int) -> Tuple[str, List[str], str, str]:
        stem = (
            await session.exec(
                select(QuestionTranslation.question_text).where(
                    QuestionTranslation.question_id == question_id,
                    QuestionTranslation.language == LanguageCode.ENGLISH,
                )
            )
        ).first() or ""
        option_rows = (
            await session.exec(
                select(OptionTranslation.option_text, QuestionOption.is_correct)
                .join(QuestionOption, QuestionOption.id == OptionTranslation.option_id)
                .where(QuestionOption.question_id == question_id, OptionTranslation.language == LanguageCode.ENGLISH)
                .order_by(QuestionOption.display_order)
            )
        ).all()
        options = [text for text, _ in option_rows]
        answer = next((text for text, correct in option_rows if correct), "")
        solution = (
            await session.exec(
                select(QuestionExplanation.detailed_solution).where(
                    QuestionExplanation.question_id == question_id,
                    QuestionExplanation.language == LanguageCode.ENGLISH,
                )
            )
        ).first() or ""
        return stem, options, answer, solution


async def _maybe_await(value) -> None:
    if hasattr(value, "__await__"):
        await value


def _is_creatable(name: str) -> bool:
    return infer_entity_type(name) is not None


def _preferred_kind(name: str, tagged_entities: set, tagged_concepts: set) -> Optional[str]:
    key = normalize_key(name)
    if key in tagged_entities:
        return NODE_ENTITY
    if key in tagged_concepts:
        return NODE_CONCEPT
    return None  # inferred from the name's shape
