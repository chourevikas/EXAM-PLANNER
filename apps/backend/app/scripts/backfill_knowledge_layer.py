"""
Backfills the Knowledge Layer (concepts / entities / relationships) for questions already in the DB.

Uses each question's stored authored tags (if any), its stem/options/answer and its solution,
so it also covers papers uploaded before the Knowledge Layer existed (rule-based fallback).
Safe to re-run: each question's links are replaced, never duplicated.

Run with:
  python -m app.scripts.backfill_knowledge_layer --all
  python -m app.scripts.backfill_knowledge_layer --exam-id 12 --dry-run
"""
import sys
import argparse
import asyncio
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import func, select

from app.db.session import async_session_factory
from app.db.models import Exam, Question
from app.db.models.knowledge import KnowledgeConcept, KnowledgeEntity
from app.knowledge.enrichment_service import KnowledgeEnrichmentService
from app.knowledge.vocabulary import STATUS_PENDING_REVIEW


async def _exam_ids(exam_id: int | None) -> list[int]:
    async with async_session_factory() as session:
        stmt = select(Exam.id).where(~Exam.code.startswith("DYN_")).order_by(Exam.id)
        if exam_id:
            stmt = stmt.where(Exam.id == exam_id)
        return list((await session.exec(stmt)).all())


async def _pending_counts() -> tuple[int, int]:
    async with async_session_factory() as session:
        concepts = (await session.exec(
            select(func.count(KnowledgeConcept.id)).where(KnowledgeConcept.status == STATUS_PENDING_REVIEW)
        )).one()
        entities = (await session.exec(
            select(func.count(KnowledgeEntity.id)).where(KnowledgeEntity.status == STATUS_PENDING_REVIEW)
        )).one()
        return concepts, entities


async def backfill(exam_id: int | None, dry_run: bool) -> None:
    exam_ids = await _exam_ids(exam_id)
    if not exam_ids:
        print("No matching exams.")
        return

    if dry_run:
        async with async_session_factory() as session:
            total = (await session.exec(select(func.count(Question.id)).where(Question.exam_id.in_(exam_ids)))).one()
            tagged = (await session.exec(
                select(func.count(Question.id)).where(Question.exam_id.in_(exam_ids), Question.knowledge_tags_raw.is_not(None))
            )).one()
        print(f"[dry-run] {len(exam_ids)} exams, {total} questions ({tagged} with authored tags / related refs). Nothing written.")
        return

    service = KnowledgeEnrichmentService(async_session_factory)
    totals = Counter()
    issues = Counter()
    for eid in exam_ids:
        results = await service.enrich_exam(eid)
        with_knowledge = sum(1 for r in results if r.entities or r.concepts)
        totals.update(
            questions=len(results), with_knowledge=with_knowledge,
            concepts=sum(r.concepts for r in results), entities=sum(r.entities for r in results),
            relationships=sum(r.relationships for r in results),
        )
        for r in results:
            issues.update(i.split(":")[0].split(" '")[0] for i in r.issues)
        print(f"Exam #{eid}: {with_knowledge}/{len(results)} questions enriched")

    pending_concepts, pending_entities = await _pending_counts()
    coverage = (100.0 * totals["with_knowledge"] / totals["questions"]) if totals["questions"] else 0.0
    print("-" * 60)
    print(f"Questions: {totals['questions']}  |  with ≥1 concept/entity: {totals['with_knowledge']} ({coverage:.1f}%)")
    print(f"Links: {totals['concepts']} concept, {totals['entities']} entity, {totals['relationships']} relationship")
    print(f"Awaiting curation (PENDING_REVIEW): {pending_concepts} concepts, {pending_entities} entities")
    if issues:
        print("Issues: " + ", ".join(f"{k} x{v}" for k, v in issues.most_common()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--exam-id", type=int)
    target.add_argument("--all", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    asyncio.run(backfill(args.exam_id, args.dry_run))


if __name__ == "__main__":
    main()
