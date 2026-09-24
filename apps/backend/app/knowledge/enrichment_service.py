"""Knowledge Layer enrichment: turns a stored question into canonical concept/entity/relationship links.

Runs after extraction (never inside it). Inputs, all optional:
- `questions.knowledge_tags_raw` — authored [Concepts]/[Entities]/[Relationships] tags + Related refs
- English stem, options and correct answer
- English solution (detailed_solution)

Each run replaces the question's links, so it is idempotent and safe to repeat after the
dictionaries grow. Invalid items are dropped and reported; nothing here raises into ingestion.
"""
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

from sqlalchemy import delete
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.logger import setup_logger
from app.db.models import (
    LanguageCode,
    OptionTranslation,
    Question,
    QuestionExplanation,
    QuestionOption,
    QuestionTranslation,
)
from app.db.models.knowledge import (
    KnowledgeAlias,
    KnowledgeRelationship,
    QuestionConcept,
    QuestionEntity,
    QuestionRelationship,
)
from app.knowledge.extractor import AliasScanner, extract_names, related_refs_from_solution
from app.knowledge.normalize import normalize_key
from app.knowledge.resolver import KnowledgeResolver, NodeRef, infer_entity_type
from app.knowledge.vocabulary import (
    LINK_WEIGHTS,
    NODE_CONCEPT,
    NODE_ENTITY,
    SOURCE_AUTHORED,
    SOURCE_RULE,
    normalize_relation,
)

logger = setup_logger("KnowledgeEnrichment")

# Relative link weights (multiplied into similarity scores)
PARENT_LINK_FACTOR = 0.7  # Article 15 implied by an authored Article 15(4)
SUPPORTING_RULE_WEIGHT = 0.35  # rule match found only in the solution / related refs


@dataclass
class EnrichmentResult:
    question_id: int
    concepts: int = 0
    entities: int = 0
    relationships: int = 0
    issues: List[str] = field(default_factory=list)


class KnowledgeEnrichmentService:
    def __init__(self, session_factory: Callable[[], AsyncSession]):
        self.session_factory = session_factory
        self._scanner: Optional[AliasScanner] = None

    async def _get_scanner(self, session: AsyncSession) -> AliasScanner:
        if self._scanner is None:
            keys = (await session.exec(select(KnowledgeAlias.normalized_alias))).all()
            self._scanner = AliasScanner(keys)
        return self._scanner

    async def enrich_exam(self, exam_id: int) -> List[EnrichmentResult]:
        async with self.session_factory() as session:
            question_ids = (
                await session.exec(select(Question.id).where(Question.exam_id == exam_id).order_by(Question.id))
            ).all()
        return [await self.enrich_question(qid) for qid in question_ids]

    async def enrich_question(self, question_id: int) -> EnrichmentResult:
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

        authored_entities = {normalize_key(n) for n in raw.get("entities", [])}
        authored_concepts = {normalize_key(n) for n in raw.get("concepts", [])}

        for name in raw.get("concepts", []):
            _link(await resolver.resolve(name, NODE_CONCEPT), LINK_WEIGHTS[SOURCE_AUTHORED], SOURCE_AUTHORED)
        for name in raw.get("entities", []):
            node = await resolver.resolve(name, NODE_ENTITY)
            _link(node, LINK_WEIGHTS[SOURCE_AUTHORED], SOURCE_AUTHORED)

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
        for rel in raw.get("relationships", []):
            src_name, tgt_name = (rel.get("source") or "").strip(), (rel.get("target") or "").strip()
            if not src_name or not tgt_name:
                result.issues.append(f"EMPTY_RELATIONSHIP_END: {rel}")
                continue
            relation, known = normalize_relation(rel.get("relation"))
            if not known:
                result.issues.append(f"UNKNOWN_RELATION '{rel.get('relation')}' stored as related_to")
            src = await resolver.resolve(src_name, _preferred_kind(src_name, authored_entities, authored_concepts))
            tgt = await resolver.resolve(tgt_name, _preferred_kind(tgt_name, authored_entities, authored_concepts))
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


def _is_creatable(name: str) -> bool:
    return infer_entity_type(name) is not None


def _preferred_kind(name: str, authored_entities: set, authored_concepts: set) -> Optional[str]:
    key = normalize_key(name)
    if key in authored_entities:
        return NODE_ENTITY
    if key in authored_concepts:
        return NODE_CONCEPT
    return None  # inferred from the name's shape
