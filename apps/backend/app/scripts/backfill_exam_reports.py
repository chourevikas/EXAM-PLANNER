"""
Rebuild stored exam-wise and cumulative reports after a scoring fix.

Re-runs the post-submission pipeline in report-only mode for every EVALUATED attempt
(oldest first, per user), then recomputes each user's cumulative report. Report-only
mode leaves running totals untouched (skill profile increments, taxonomy mastery,
FSRS memory, badges), so it is safe to run more than once.

Each attempt re-run also regenerates its AI narrative, so this makes one LLM call
per attempt plus one per user.

Usage (from apps/backend):
    python app/scripts/backfill_exam_reports.py --dry-run
    python app/scripts/backfill_exam_reports.py --user-id 3
    python app/scripts/backfill_exam_reports.py            # all users
"""

import sys
import asyncio
import argparse
from collections import defaultdict
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlmodel import select, col
from app.db.session import managed_async_session
from app.db.models import ExamAttempt
from app.db.models.enums import AttemptStatus
from app.engine.post_submission_pipeline import run_post_submission_pipeline
from app.engine.cumulative_analytics_aggregator import CumulativeAnalyticsAggregator
from app.cache import invalidate_user_cache


async def backfill(user_id: int | None, dry_run: bool) -> None:
    async with managed_async_session() as session:
        stmt = select(ExamAttempt.id, ExamAttempt.user_id).where(ExamAttempt.status == AttemptStatus.EVALUATED)
        if user_id is not None:
            stmt = stmt.where(ExamAttempt.user_id == user_id)
        rows = (await session.exec(stmt.order_by(col(ExamAttempt.created_at).asc()))).all()

    attempts_by_user: dict[int, list[int]] = defaultdict(list)
    for attempt_id, uid in rows:
        attempts_by_user[uid].append(attempt_id)

    print(f"{len(rows)} evaluated attempts across {len(attempts_by_user)} users")
    if dry_run:
        for uid, aids in attempts_by_user.items():
            print(f"  user {uid}: attempts {aids}")
        return

    for uid, aids in attempts_by_user.items():
        for aid in aids:
            print(f"  user {uid}: rebuilding attempt {aid}")
            await run_post_submission_pipeline(aid, report_only=True)
        async with managed_async_session() as session:
            await CumulativeAnalyticsAggregator.compute_user_cumulative_report(session, uid, force_recompute=True)
        await invalidate_user_cache(str(uid))
        print(f"  user {uid}: cumulative report rebuilt")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--user-id", type=int, default=None, help="Only rebuild this user's reports")
    parser.add_argument("--dry-run", action="store_true", help="List what would be rebuilt and exit")
    args = parser.parse_args()
    asyncio.run(backfill(args.user_id, args.dry_run))


if __name__ == "__main__":
    main()
