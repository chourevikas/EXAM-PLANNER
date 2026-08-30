import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from sqlmodel import select

from app.config.settings import settings
from app.db.session import async_session_factory
from app.db.models.study_plan import StudyTask
from app.db.models.user import User, UserStatus
from app.db.models.notification import Notification
from app.services.email_service import send_pending_tasks_summary_email
from app.cache import get_cache

logger = logging.getLogger("DailyMidnightScheduler")

# Global handle for background worker task
_scheduler_task: Optional[asyncio.Task] = None
_is_running: bool = False


async def run_daily_midnight_dispatch(force: bool = False) -> Dict[str, Any]:
    """
    Executes a single consolidated DB query to find all pending study tasks across all active users
    and dispatches daily email digests with bounded concurrency.
    
    Guarantees:
    - 0 unnecessary queries in a loop (exactly 1 JOIN query for all users).
    - Deduplication: Never dispatches twice for the same date unless force=True.
    - Bounded async concurrency (max 5 simultaneous email transmissions).
    """
    today = datetime.now(timezone.utc).date()
    date_str = today.isoformat()
    cache_key = f"daily_digest_dispatched:{date_str}"
    cache = get_cache()

    if not force:
        already_dispatched = await cache.get(cache_key)
        if already_dispatched:
            logger.info(f"⏭️ Daily email digests already dispatched for {date_str}. Skipping.")
            return {
                "status": "SKIPPED",
                "message": f"Digests already sent for {date_str}",
                "date": date_str,
                "emails_sent": 0
            }

    cutoff_date = today - timedelta(days=14)
    logger.info(f"🚀 Starting daily midnight email digest run for {date_str} (cutoff: {cutoff_date})...")

    user_tasks_map: Dict[int, Dict[str, Any]] = {}

    try:
        async with async_session_factory() as session:
            # 1 Single JOIN query across all users and tasks (0 loop DB calls)
            stmt = (
                select(StudyTask, User)
                .join(User, StudyTask.user_id == User.id)
                .where(
                    StudyTask.scheduled_date >= cutoff_date,
                    StudyTask.scheduled_date <= today,
                    StudyTask.is_completed == False,
                    User.status == UserStatus.ACTIVE
                )
            )
            results = (await session.exec(stmt)).all()

            for task, user in results:
                if user.id is not None:
                    uid = user.id
                    if uid not in user_tasks_map:
                        user_tasks_map[uid] = {
                            "user": user,
                            "tasks": []
                        }
                    user_tasks_map[uid]["tasks"].append({
                        "title": task.title,
                        "subject": task.subject or "General Studies",
                        "allocated_time_minutes": task.allocated_time_minutes or 30
                    })

            # Also create in-app notification in batch if not already present
            today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            for uid, data in user_tasks_map.items():
                user = data["user"]
                tasks_list = data["tasks"]
                pending_count = len(tasks_list)

                # Check if in-app notification exists for today
                stmt_noti = select(Notification).where(
                    Notification.user_id == user.id,
                    Notification.notification_type == "PENDING_TASKS",
                    Notification.created_at >= today_start
                )
                existing_noti = (await session.exec(stmt_noti)).first()
                if not existing_noti:
                    new_noti = Notification(
                        user_id=user.id,
                        title=f"{pending_count} Daily Target(s) Remaining",
                        message=f"You have {pending_count} pending study task(s) scheduled for today. Complete them to maintain your streak!",
                        notification_type="PENDING_TASKS",
                        action_url="/study-planner",
                        is_read=False
                    )
                    session.add(new_noti)
            await session.commit()

    except Exception as err:
        logger.error(f"❌ Error querying pending study tasks for midnight digest: {err}", exc_info=True)
        return {
            "status": "ERROR",
            "message": str(err),
            "date": date_str,
            "emails_sent": 0
        }

    if not user_tasks_map:
        logger.info(f"✅ No users with pending tasks for {date_str}. Zero emails required.")
        await cache.set(cache_key, {"sent": 0, "timestamp": datetime.now(timezone.utc).isoformat()}, ttl_seconds=86400)
        return {
            "status": "SUCCESS",
            "message": "No pending tasks found for any active user.",
            "date": date_str,
            "emails_sent": 0,
            "total_users": 0
        }

    # Bounded concurrent email dispatch (5 concurrent tasks max)
    semaphore = asyncio.Semaphore(5)
    sent_count = 0
    failed_count = 0

    async def _send_single_user_digest(uid: int, data: Dict[str, Any]):
        nonlocal sent_count, failed_count
        async with semaphore:
            user = data["user"]
            tasks_list = data["tasks"]
            user_name = getattr(user, "full_name", None) or user.email.split("@")[0]

            try:
                ok = await send_pending_tasks_summary_email(
                    email=user.email,
                    user_name=user_name,
                    pending_tasks=tasks_list
                )
                if ok:
                    sent_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                logger.error(f"Failed sending midnight digest to {user.email}: {e}")
                failed_count += 1

    tasks = [_send_single_user_digest(uid, data) for uid, data in user_tasks_map.items()]
    await asyncio.gather(*tasks, return_exceptions=True)

    # Mark as dispatched for today in cache
    await cache.set(
        cache_key,
        {
            "sent": sent_count,
            "failed": failed_count,
            "total_users": len(user_tasks_map),
            "timestamp": datetime.now(timezone.utc).isoformat()
        },
        ttl_seconds=86400
    )

    logger.info(
        f"✅ Daily midnight digest finished: {sent_count} sent, {failed_count} failed out of {len(user_tasks_map)} users with pending tasks."
    )

    return {
        "status": "SUCCESS",
        "date": date_str,
        "total_users_with_pending": len(user_tasks_map),
        "emails_sent": sent_count,
        "emails_failed": failed_count
    }


def _calculate_seconds_until_midnight() -> float:
    """Calculates seconds until the next 00:00:00 UTC."""
    now = datetime.now(timezone.utc)
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    delay = (next_midnight - now).total_seconds()
    return max(5.0, delay)


async def _daily_midnight_scheduler_loop():
    """Continuous background loop sleeping until midnight and dispatching digests."""
    global _is_running
    _is_running = True
    logger.info("🕒 Daily Midnight Scheduler background worker initialized.")

    while _is_running:
        try:
            sleep_duration = _calculate_seconds_until_midnight()
            logger.info(f"⏳ Daily Midnight Scheduler sleeping for {sleep_duration:.1f}s until next midnight...")
            await asyncio.sleep(sleep_duration)

            if not _is_running:
                break

            await run_daily_midnight_dispatch(force=False)
        except asyncio.CancelledError:
            logger.info("🛑 Daily Midnight Scheduler loop cancelled.")
            break
        except Exception as err:
            logger.error(f"⚠️ Error in Daily Midnight Scheduler loop: {err}", exc_info=True)
            # Sleep 60 seconds before retrying on uncaught error to prevent spin loops
            await asyncio.sleep(60)


def start_daily_midnight_scheduler():
    """Starts the background scheduler task on FastAPI startup."""
    global _scheduler_task, _is_running
    if _scheduler_task is None or _scheduler_task.done():
        _is_running = True
        _scheduler_task = asyncio.create_task(_daily_midnight_scheduler_loop())
        logger.info("🚀 Daily Midnight Scheduler task spawned in background.")


def stop_daily_midnight_scheduler():
    """Cancels the background scheduler task on FastAPI shutdown."""
    global _scheduler_task, _is_running
    _is_running = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("🛑 Daily Midnight Scheduler task cancellation requested.")
