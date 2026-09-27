import asyncio
import os
import sys
import logging
from sqlmodel import select
from sqlalchemy import text

sys.path.insert(0, os.getcwd())

from app.db.session import engine, async_session_factory
from app.db.models import Question
from app.knowledge.ai_extractor import KnowledgeAIExtractor, QuestionTexts, Vocabulary
from app.config.settings import get_settings
from app.llm.factory import get_vision_llm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FastBackfill")

async def run_fast_backfill():
    settings = get_settings()
    def factory():
        return get_vision_llm(timeout=10, max_retries=0, rate_limit_rps=settings.KNOWLEDGE_LLM_RATE_LIMIT_RPS)
    
    extractor = KnowledgeAIExtractor(factory, batch_size=1, model_name=settings.GEMINI_MODEL_NAME)
    vocab = Vocabulary()
    
    async with async_session_factory() as session:
        # Get all question IDs missing AI tags
        res = await session.exec(select(Question.id).where(Question.knowledge_tags_ai == None))
        q_ids = res.fetchall()
        
    logger.info(f"Found {len(q_ids)} questions to process.")
    
    sem = asyncio.Semaphore(5) # 5 concurrent requests
    
    async def process_one(q_id):
        async with sem:
            async with async_session_factory() as session:
                q = await session.get(Question, q_id)
                if not q or q.knowledge_tags_ai is not None:
                    return
                
                # Create texts
                qt = QuestionTexts(question_id=q_id, stem=q.stem_text if hasattr(q, 'stem_text') else "") # Provide dummy stem if property missing, though real code uses translations
                # Actually, wait, KnowledgeEnrichmentService does a lot of prep.
                # Let's just use KnowledgeEnrichmentService!
                pass

# Let's use the actual service but with a timeout
from app.knowledge.enrichment_service import KnowledgeEnrichmentService

async def main():
    settings = get_settings()
    def factory():
        return get_vision_llm(timeout=15, max_retries=0, rate_limit_rps=5.0)
    
    extractor = KnowledgeAIExtractor(factory, batch_size=1, model_name=settings.GEMINI_MODEL_NAME)
    service = KnowledgeEnrichmentService(async_session_factory, ai_extractor=extractor)
    
    async with async_session_factory() as session:
        res = await session.exec(select(Question.id).where(Question.knowledge_tags_ai == None))
        q_ids = res.fetchall()
        
    logger.info(f"Starting fast backfill for {len(q_ids)} questions...")
    
    # Process in chunks of 10 to see progress
    for i in range(0, len(q_ids), 10):
        chunk = q_ids[i:i+10]
        try:
            # Enforce strict 60 second timeout per chunk
            await asyncio.wait_for(service.enrich_questions(chunk, refresh_ai=False), timeout=60.0)
            logger.info(f"Processed chunk {i}-{i+len(chunk)}")
        except asyncio.TimeoutError:
            logger.error(f"Timeout on chunk {i}-{i+len(chunk)}")
        except Exception as e:
            logger.error(f"Error on chunk {i}-{i+len(chunk)}: {e}")

if __name__ == "__main__":
    asyncio.run(main())
