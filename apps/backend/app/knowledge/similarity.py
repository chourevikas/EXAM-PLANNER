"""Deterministic similar-question retrieval over the Knowledge Layer (no AI at runtime).

1. Read the current question's entities (+ parents), concepts, 1-hop relationship neighbours,
   and its Nano Theme / Microtheme names.
2. Candidates = questions sharing any of those, found through indexed lookups only
   (never a comparison against every question).
3. Weighted score per candidate with human-readable match reasons; exclude the question itself.

Nano Theme / Microtheme rows are created per exam's syllabus version, so the same theme has
different ids across papers — taxonomy matching therefore compares names, not ids.
Questions with no Knowledge Layer data automatically fall back to taxonomy-only matches.
"""
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy import func, or_, and_
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config.settings import settings
from app.db.models import Exam, Question, QuestionStatus, Subject, Subtopic, Topic
from app.db.models.knowledge import (
    KnowledgeConcept,
    KnowledgeEntity,
    KnowledgeRelationship,
    QuestionConcept,
    QuestionEntity,
)
from app.knowledge.vocabulary import NODE_CONCEPT, NODE_ENTITY

CANDIDATES_PER_SIGNAL = 300
MAX_MATCHES_PER_SIGNAL = 3  # a long shared list must not drown out a precise match
MIN_SPECIFICITY = 0.5

TIER_ORDER = {"exact": 0, "related": 1, "nano_theme": 2, "microtheme": 3}


def specificity(question_count: int) -> float:
    """Broad nodes (attached to many questions) count a little less than precise ones; never below half."""
    return max(MIN_SPECIFICITY, 1.0 - 0.1 * math.log(max(question_count, 1)))


@dataclass
class _Candidate:
    question_id: int
    score: float = 0.0
    tier: str = "microtheme"
    reasons: List[str] = field(default_factory=list)
    contributions: Dict[str, List[Tuple[float, str]]] = field(default_factory=dict)

    def add(self, signal: str, points: float, reason: str) -> None:
        self.contributions.setdefault(signal, []).append((points, reason))

    def finalize(self) -> None:
        for signal in ("exact_entity", "specific_provision", "concept", "relationship", "same_nano_theme", "same_microtheme"):
            best = sorted(self.contributions.get(signal, []), key=lambda c: -c[0])[:MAX_MATCHES_PER_SIGNAL]
            for points, reason in best:
                self.score += points
                if reason not in self.reasons:
                    self.reasons.append(reason)
        signals = self.contributions
        if "exact_entity" in signals or "specific_provision" in signals:
            self.tier = "exact"
        elif "concept" in signals or "relationship" in signals:
            self.tier = "related"
        elif "same_nano_theme" in signals:
            self.tier = "nano_theme"
        self.score = round(self.score, 1)


class SimilarityService:
    def __init__(self, session: AsyncSession, weights: Optional[Dict[str, float]] = None):
        self.session = session
        self.weights = {**settings.KNOWLEDGE_SIMILARITY_WEIGHTS, **(weights or {})}

    async def find_similar(
        self, question_id: int, limit: int = 5, min_score: float = 0, include_related: bool = True
    ) -> List[dict]:
        entities = dict((await self.session.exec(
            select(QuestionEntity.entity_id, QuestionEntity.relevance).where(QuestionEntity.question_id == question_id)
        )).all())
        concepts = dict((await self.session.exec(
            select(QuestionConcept.concept_id, QuestionConcept.weight).where(QuestionConcept.question_id == question_id)
        )).all())
        nano, micro = await self._theme_names(question_id)

        candidates: Dict[int, _Candidate] = {}

        def _cand(qid: int) -> _Candidate:
            return candidates.setdefault(qid, _Candidate(qid))

        published = and_(Question.status == QuestionStatus.PUBLISHED, Question.id != question_id)

        # Shared entities: exact entity (50) vs specific sub-provision (35)
        if entities:
            info = {
                e.id: e for e in (await self.session.exec(
                    select(KnowledgeEntity).where(col(KnowledgeEntity.id).in_(list(entities)))
                )).all()
            }
            spec = await self._specificity(QuestionEntity, QuestionEntity.entity_id, list(entities))
            rows = (await self.session.exec(
                select(QuestionEntity.question_id, QuestionEntity.entity_id, QuestionEntity.relevance)
                .join(Question, Question.id == QuestionEntity.question_id)
                .where(col(QuestionEntity.entity_id).in_(list(entities)), published)
                .limit(CANDIDATES_PER_SIGNAL * 3)
            )).all()
            for qid, eid, relevance in rows:
                entity = info.get(eid)
                if not entity:
                    continue
                signal = "specific_provision" if entity.parent_entity_id else "exact_entity"
                label = "Specific provision" if entity.parent_entity_id else "Exact entity"
                points = self.weights[signal] * entities[eid] * relevance * spec.get(eid, 1.0)
                _cand(qid).add(signal, points, f"{label}: {entity.canonical_name}")

        # Shared concepts (20)
        if concepts:
            names = dict((await self.session.exec(
                select(KnowledgeConcept.id, KnowledgeConcept.canonical_name)
                .where(col(KnowledgeConcept.id).in_(list(concepts)))
            )).all())
            spec = await self._specificity(QuestionConcept, QuestionConcept.concept_id, list(concepts))
            rows = (await self.session.exec(
                select(QuestionConcept.question_id, QuestionConcept.concept_id, QuestionConcept.weight)
                .join(Question, Question.id == QuestionConcept.question_id)
                .where(col(QuestionConcept.concept_id).in_(list(concepts)), published)
                .limit(CANDIDATES_PER_SIGNAL * 3)
            )).all()
            for qid, cid, weight in rows:
                points = self.weights["concept"] * concepts[cid] * weight * spec.get(cid, 1.0)
                _cand(qid).add("concept", points, f"Concept: {names.get(cid, cid)}")

        # 1-hop relationship neighbours of the current question's nodes (15)
        if include_related and (entities or concepts):
            await self._relationship_candidates(entities, concepts, published, _cand)

        # Taxonomy fallback (10 / 5), matched by name across papers
        for signal, name, model, label in (
            ("same_nano_theme", nano, Subtopic, "Same Nano Theme"),
            ("same_microtheme", micro, Topic, "Same Microtheme"),
        ):
            if not name:
                continue
            stmt = select(Question.id).where(published)
            if model is Subtopic:
                stmt = stmt.join(Subtopic, Subtopic.id == Question.subtopic_id)
            else:
                stmt = stmt.join(Subtopic, Subtopic.id == Question.subtopic_id).join(Topic, Topic.id == Subtopic.topic_id)
            stmt = stmt.where(func.lower(func.trim(model.name)) == name).order_by(col(Question.id).desc())
            for qid in (await self.session.exec(stmt.limit(CANDIDATES_PER_SIGNAL))).all():
                _cand(qid).add(signal, self.weights[signal], label)

        for cand in candidates.values():
            cand.finalize()
        ranked = [c for c in candidates.values() if c.score > 0 and c.score >= min_score]
        details = await self._details([c.question_id for c in ranked])
        ranked.sort(key=lambda c: (
            -c.score, TIER_ORDER[c.tier], -(details.get(c.question_id, {}).get("source_year") or 0), -c.question_id,
        ))
        return [
            {"question_id": c.question_id, "score": c.score, "tier": c.tier, "match_reasons": c.reasons,
             **details.get(c.question_id, {})}
            for c in ranked[:limit]
        ]

    async def _relationship_candidates(self, entities, concepts, published, _cand) -> None:
        own: Set[Tuple[str, int]] = {(NODE_ENTITY, e) for e in entities} | {(NODE_CONCEPT, c) for c in concepts}
        conditions = []
        for kind, ids in ((NODE_ENTITY, list(entities)), (NODE_CONCEPT, list(concepts))):
            if ids:
                conditions.append(and_(KnowledgeRelationship.source_kind == kind, col(KnowledgeRelationship.source_id).in_(ids)))
                conditions.append(and_(KnowledgeRelationship.target_kind == kind, col(KnowledgeRelationship.target_id).in_(ids)))
        edges = (await self.session.exec(select(KnowledgeRelationship).where(or_(*conditions)).limit(500))).all()

        # neighbour node -> reason (edge between one of our nodes and it)
        neighbours: Dict[Tuple[str, int], KnowledgeRelationship] = {}
        for edge in edges:
            src, tgt = (edge.source_kind, edge.source_id), (edge.target_kind, edge.target_id)
            other = tgt if src in own else src
            if other not in own:
                neighbours.setdefault(other, edge)
        if not neighbours:
            return

        names = await self._node_names({n for e in neighbours.values() for n in (
            (e.source_kind, e.source_id), (e.target_kind, e.target_id))})
        for kind, link_model, id_col, weight_col in (
            (NODE_ENTITY, QuestionEntity, QuestionEntity.entity_id, QuestionEntity.relevance),
            (NODE_CONCEPT, QuestionConcept, QuestionConcept.concept_id, QuestionConcept.weight),
        ):
            ids = [nid for (k, nid) in neighbours if k == kind]
            if not ids:
                continue
            rows = (await self.session.exec(
                select(link_model.question_id, id_col, weight_col)
                .join(Question, Question.id == link_model.question_id)
                .where(col(id_col).in_(ids), published)
                .limit(CANDIDATES_PER_SIGNAL)
            )).all()
            for qid, nid, weight in rows:
                edge = neighbours[(kind, nid)]
                reason = (
                    f"Relationship: {names.get((edge.source_kind, edge.source_id), '?')} → "
                    f"{names.get((edge.target_kind, edge.target_id), '?')}"
                )
                _cand(qid).add("relationship", self.weights["relationship"] * weight, reason)

    async def _specificity(self, link_model, id_col, ids: List[int]) -> Dict[int, float]:
        counts = (await self.session.exec(
            select(id_col, func.count(link_model.question_id)).where(col(id_col).in_(ids)).group_by(id_col)
        )).all()
        return {nid: specificity(count) for nid, count in counts}

    async def _node_names(self, nodes: Set[Tuple[str, int]]) -> Dict[Tuple[str, int], str]:
        names: Dict[Tuple[str, int], str] = {}
        entity_ids = [nid for k, nid in nodes if k == NODE_ENTITY]
        concept_ids = [nid for k, nid in nodes if k == NODE_CONCEPT]
        if entity_ids:
            for nid, name in (await self.session.exec(
                select(KnowledgeEntity.id, KnowledgeEntity.canonical_name).where(col(KnowledgeEntity.id).in_(entity_ids))
            )).all():
                names[(NODE_ENTITY, nid)] = name
        if concept_ids:
            for nid, name in (await self.session.exec(
                select(KnowledgeConcept.id, KnowledgeConcept.canonical_name).where(col(KnowledgeConcept.id).in_(concept_ids))
            )).all():
                names[(NODE_CONCEPT, nid)] = name
        return names

    async def _theme_names(self, question_id: int) -> Tuple[Optional[str], Optional[str]]:
        row = (await self.session.exec(
            select(Subtopic.name, Topic.name)
            .select_from(Question)
            .join(Subtopic, Subtopic.id == Question.subtopic_id)
            .join(Topic, Topic.id == Subtopic.topic_id)
            .where(Question.id == question_id)
        )).first()
        if not row:
            return None, None
        nano, micro = row
        return (nano or "").strip().lower() or None, (micro or "").strip().lower() or None

    async def _details(self, question_ids: List[int]) -> Dict[int, dict]:
        if not question_ids:
            return {}
        rows = (await self.session.exec(
            select(
                Question.id, Question.question_number_in_paper, Question.source_year,
                Exam.name, Exam.source_year, Subject.name, Topic.name, Subtopic.name,
            )
            .select_from(Question)
            .join(Exam, Exam.id == Question.exam_id, isouter=True)
            .join(Subtopic, Subtopic.id == Question.subtopic_id, isouter=True)
            .join(Topic, Topic.id == Subtopic.topic_id, isouter=True)
            .join(Subject, Subject.id == Topic.subject_id, isouter=True)
            .where(col(Question.id).in_(question_ids))
        )).all()
        return {
            qid: {
                "question_number": number,
                "exam_name": exam_name,
                "source_year": q_year or exam_year,
                "subject_name": subject,
                "topic_name": topic,
                "subtopic_name": subtopic,
            }
            for qid, number, q_year, exam_name, exam_year, subject, topic, subtopic in rows
        }
