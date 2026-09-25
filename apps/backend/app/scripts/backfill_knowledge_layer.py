"""
Backfills the Knowledge Layer (concepts / entities / relationships) for questions already in the DB.

Runs AI extraction (LLM) over each question's stem, options, answer and solution, then links
it together with any authored tags and rule-based matches. Questions whose PDF had no
Subject / Microtheme / Nano Theme or Difficulty tags get those from the same AI call. Stored AI tags are reused while a
question's text is unchanged, so re-runs only call the model for new or edited questions.
Safe to re-run: each question's links are replaced, never duplicated.

Run with:
  python -m app.scripts.backfill_knowledge_layer --all
  python -m app.scripts.backfill_knowledge_layer --exam-id 12 --dry-run
  python -m app.scripts.backfill_knowledge_layer --exam-id 12 --refresh-ai   # re-ask the model
  python -m app.scripts.backfill_knowledge_layer --all --no-ai               # rules + stored tags only
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
from app.knowledge.ai_extractor import KnowledgeAIExtractor
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


async def backfill(exam_id: int | None, dry_run: bool, use_ai: bool = True, refresh_ai: bool = False) -> None:
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
            ai_tagged = (await session.exec(
                select(func.count(Question.id)).where(Question.exam_id.in_(exam_ids), Question.knowledge_tags_ai.is_not(None))
            )).one()
        print(
            f"[dry-run] {len(exam_ids)} exams, {total} questions ({tagged} with authored tags / related refs, "
            f"{ai_tagged} with stored AI tags). Nothing written."
        )
        return

    extractor = KnowledgeAIExtractor.from_settings() if use_ai else None
    if use_ai and not extractor:
        print("AI extraction is disabled (KNOWLEDGE_AI_ENABLED=false); using stored tags and rules only.")
    service = KnowledgeEnrichmentService(async_session_factory, ai_extractor=extractor)
    totals = Counter()
    ai_statuses = Counter()
    issues = Counter()
    for eid in exam_ids:
        results = await service.enrich_exam(eid, refresh_ai=refresh_ai)
        ai_statuses.update(r.ai for r in results)
        totals.update(
            syllabus_filled=sum(1 for r in results if r.syllabus),
            difficulty_rated=sum(1 for r in results if r.difficulty),
        )
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
    print("AI tagging: " + ", ".join(f"{k} x{v}" for k, v in ai_statuses.most_common()))
    print(f"Missing Subject > Microtheme > Nano Theme filled by AI: {totals['syllabus_filled']}")
    print(f"Missing difficulty set by AI (EASY/HARD; MEDIUM is the default): {totals['difficulty_rated']}")
    if issues:
        print("Issues: " + ", ".join(f"{k} x{v}" for k, v in issues.most_common()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--exam-id", type=int)
    target.add_argument("--all", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--no-ai", action="store_true", help="Skip the LLM; use stored AI tags, authored tags and rules")
    parser.add_argument("--refresh-ai", action="store_true", help="Call the LLM again even for unchanged questions")
    args = parser.parse_args()
    asyncio.run(backfill(args.exam_id, args.dry_run, use_ai=not args.no_ai, refresh_ai=args.refresh_ai))


if __name__ == "__main__":
    main()
