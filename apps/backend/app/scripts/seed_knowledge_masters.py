"""
Loads the curated Knowledge Layer masters (concepts, entities, aliases, parent provisions)
from app/knowledge/seed/*.json. Idempotent: re-running only adds what is missing and marks
seeded nodes ACTIVE. Alias conflicts (one alias claimed by two nodes) are reported, never overwritten.

Run with:  python -m app.scripts.seed_knowledge_masters
"""
import sys
import json
import asyncio
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from app.db.session import async_session_factory
from app.knowledge.resolver import seed_masters
from app.config.logger import setup_logger

logger = setup_logger("KnowledgeMastersSeeder")
SEED_DIR = Path(__file__).resolve().parent.parent / "knowledge" / "seed"


def load_seed() -> tuple[list[dict], list[dict]]:
    entities = json.loads((SEED_DIR / "entities.json").read_text(encoding="utf-8"))
    concepts = json.loads((SEED_DIR / "concepts.json").read_text(encoding="utf-8"))
    return entities, concepts


async def seed_knowledge_masters() -> dict:
    entities, concepts = load_seed()
    async with async_session_factory() as session:
        stats = await seed_masters(session, entities, concepts)
    for conflict in stats["conflicts"]:
        logger.warning(f"Alias conflict (kept existing): {conflict}")
    logger.info(
        f"✅ Knowledge masters ready: {stats['concepts']} concepts, {stats['entities']} entities, "
        f"{stats['aliases']} new aliases, {len(stats['conflicts'])} conflicts."
    )
    return stats


if __name__ == "__main__":
    asyncio.run(seed_knowledge_masters())
