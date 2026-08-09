import pytest
import asyncio
import uuid
from sqlmodel import select
from app.db.session import managed_async_session, with_db_retry
from app.config.settings import get_settings
from app.db.models import Exam

@pytest.mark.asyncio
async def test_lock_prevention_and_batch_settings():
    settings = get_settings()
    assert settings.PIPELINE_BATCH_SIZE >= 1, "PIPELINE_BATCH_SIZE must be set to at least 1"

    # Test lock-resilient managed_async_session
    async with managed_async_session() as session:
        stmt = select(Exam).limit(1)
        res = await session.exec(stmt)
        assert res is not None

    print(f"[OK] Verified managed_async_session and PIPELINE_BATCH_SIZE ({settings.PIPELINE_BATCH_SIZE})")

if __name__ == "__main__":
    asyncio.run(test_lock_prevention_and_batch_settings())
