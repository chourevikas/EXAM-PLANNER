import asyncio
import logging
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Dict, List, Any, Optional, Tuple
from sqlmodel import select, col

from app.config.settings import settings
from app.db.session import async_session_factory
from app.db.models.study_plan import StudyTask
from app.db.models.user import User, UserStatus
from app.db.models.notification import UserNotification
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
    tz = ZoneInfo("Asia/Kolkata")
    today = datetime.now(tz).date()
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
            today_start = datetime.now(ZoneInfo("Asia/Kolkata")).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
            for uid, data in user_tasks_map.items():
                user = data["user"]
                tasks_list = data["tasks"]
                pending_count = len(tasks_list)

                # Check if in-app notification exists for today
                stmt_noti = select(UserNotification).where(
                    UserNotification.user_id == user.id,
                    UserNotification.notification_type == "PENDING_TASKS",
                    UserNotification.created_at >= today_start
                )
                existing_noti = (await session.exec(stmt_noti)).first()
                if not existing_noti:
                    new_noti = UserNotification(
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


# Languages to proactively translate at midnight (in addition to on-demand)
_MIDNIGHT_TRANSLATE_LANGUAGES = [
    ("hi", "HINDI"),
    ("mr", "MARATHI"),
]


async def run_midnight_translation_job() -> Dict[str, Any]:
    """
    Proactively translates all un-translated question stems and options
    into Hindi and Marathi using Google Translate's batch API.

    Detects 'fake' translations where the stored text is identical to the
    English source (i.e. the translation was never actually done).

    Runs once per night; uses cache deduplication to avoid re-running.
    Batches texts in chunks of 200 for optimal Google API throughput.
    """
    tz = ZoneInfo("Asia/Kolkata")
    today = datetime.now(tz).date()
    date_str = today.isoformat()
    cache = get_cache()

    total_q_translated = 0
    total_opt_translated = 0

    try:
        from app.db.models import (
            Question, QuestionTranslation, QuestionOption, OptionTranslation, LanguageCode
        )
        from app.core.languages import normalize_language
        from app.services.google_translation_service import GoogleTranslationService
        from app.db.upsert import bulk_upsert_translations

        translator = GoogleTranslationService()

        for target_iso, target_enum in _MIDNIGHT_TRANSLATE_LANGUAGES:
            cache_key = f"midnight_translation:{target_enum}:{date_str}"
            already_done = await cache.get(cache_key)
            if already_done:
                logger.info(f"⏭️ Midnight translation for {target_enum} already done today ({date_str}). Skipping.")
                continue

            logger.info(f"🌙 Starting midnight translation batch for {target_enum} ({target_iso})...")

            try:
                lang_db_enum = LanguageCode[target_enum]
            except (KeyError, AttributeError):
                lang_db_enum = target_enum

            async with async_session_factory() as session:
                # --- Load all questions and their English translations ---
                q_stmt = select(Question)
                all_questions = (await session.exec(q_stmt)).all()

                # Load existing translations for all questions
                qt_stmt = select(QuestionTranslation)
                all_qt = (await session.exec(qt_stmt)).all()
                # qt_map: { question_id: { lang_enum_str: question_text } }
                qt_map: Dict[int, Dict[str, str]] = {}
                for qt in all_qt:
                    lang_key = qt.language.value if hasattr(qt.language, "value") else str(qt.language)
                    qt_map.setdefault(qt.question_id, {})[lang_key] = qt.question_text or ""

                # Load all options and their English translations
                opt_stmt = select(QuestionOption)
                all_opts = (await session.exec(opt_stmt)).all()

                ot_stmt = select(OptionTranslation)
                all_ot = (await session.exec(ot_stmt)).all()
                # ot_map: { option_id: { lang_enum_str: option_text } }
                ot_map: Dict[int, Dict[str, str]] = {}
                for ot in all_ot:
                    lang_key = ot.language.value if hasattr(ot.language, "value") else str(ot.language)
                    ot_map.setdefault(ot.option_id, {})[lang_key] = ot.option_text or ""

            # --- Identify questions needing translation ---
            missing_q: List[Tuple[Question, str]] = []
            for q in all_questions:
                q_trans = qt_map.get(q.id, {})
                eng = q_trans.get("ENGLISH") or q_trans.get("en") or ""
                if not eng:
                    continue
                stored_target = q_trans.get(target_enum) or q_trans.get(target_iso) or ""
                if not stored_target or stored_target.strip() == eng.strip():
                    missing_q.append((q, eng.strip()))

            # --- Identify options needing translation ---
            missing_opt: List[Tuple[QuestionOption, str]] = []
            for opt in all_opts:
                o_trans = ot_map.get(opt.id, {})
                eng = o_trans.get("ENGLISH") or o_trans.get("en") or ""
                if not eng:
                    eng = opt.option_text or ""
                if not eng:
                    continue
                stored_target = o_trans.get(target_enum) or o_trans.get(target_iso) or ""
                if not stored_target or stored_target.strip() == eng.strip():
                    missing_opt.append((opt, eng.strip()))

            q_count = len(missing_q)
            opt_count = len(missing_opt)
            logger.info(f"   [{target_enum}] Found {q_count} question stems + {opt_count} options to translate.")

            if not missing_q and not missing_opt:
                await cache.set(cache_key, {"done": True, "timestamp": datetime.now(timezone.utc).isoformat()}, ttl_seconds=86400)
                continue

            # --- Batch translate in chunks of 200 ---
            CHUNK_SIZE = 200

            async def _translate_chunk(texts: List[str]) -> Dict[str, str]:
                """Translates a list of texts and returns a source→translated dict."""
                if not texts:
                    return {}
                try:
                    translated = await translator.translate_batch(
                        texts, target_language=target_iso, source_language="en"
                    )
                    return dict(zip(texts, translated))
                except Exception as e:
                    logger.warning(f"Chunk translation failed for {target_enum}: {e}")
                    return {}

            # Deduplicate texts across stems + options
            all_texts = list(dict.fromkeys(
                [t for _, t in missing_q] + [t for _, t in missing_opt]
            ))

            trans_dict: Dict[str, str] = {}
            for ci in range(0, len(all_texts), CHUNK_SIZE):
                chunk = all_texts[ci: ci + CHUNK_SIZE]
                chunk_result = await _translate_chunk(chunk)
                trans_dict.update(chunk_result)

            # --- Build DB records ---
            new_q_records = []
            for q, eng in missing_q:
                t_text = trans_dict.get(eng, "")
                if not t_text or t_text.strip() == eng.strip():
                    continue  # Translation failed / returned English - skip
                new_q_records.append(QuestionTranslation(
                    question_id=q.id,
                    language=lang_db_enum,
                    question_text=t_text,
                ))

            new_opt_records = []
            for opt, eng in missing_opt:
                t_text = trans_dict.get(eng, "")
                if not t_text or t_text.strip() == eng.strip():
                    continue
                new_opt_records.append(OptionTranslation(
                    option_id=opt.id,
                    language=lang_db_enum,
                    option_text=t_text,
                ))

            # --- Persist in batches to avoid huge single transactions ---
            PERSIST_CHUNK = 500
            async with async_session_factory() as session:
                for ci in range(0, len(new_q_records), PERSIST_CHUNK):
                    await bulk_upsert_translations(
                        session, QuestionTranslation, new_q_records[ci: ci + PERSIST_CHUNK],
                        ["question_id", "language"], update_cols=["question_text"]
                    )
                for ci in range(0, len(new_opt_records), PERSIST_CHUNK):
                    await bulk_upsert_translations(
                        session, OptionTranslation, new_opt_records[ci: ci + PERSIST_CHUNK],
                        ["option_id", "language"], update_cols=["option_text"]
                    )
                await session.commit()

            total_q_translated += len(new_q_records)
            total_opt_translated += len(new_opt_records)
            logger.info(f"   ✅ [{target_enum}] Persisted {len(new_q_records)} Q + {len(new_opt_records)} opt translations.")
            await cache.set(cache_key, {
                "done": True,
                "q_count": len(new_q_records),
                "opt_count": len(new_opt_records),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, ttl_seconds=86400)

    except Exception as err:
        logger.error(f"❌ Midnight translation job failed: {err}", exc_info=True)
        return {"status": "ERROR", "error": str(err)}

    logger.info(f"🌙✅ Midnight translation job complete: {total_q_translated} Q + {total_opt_translated} opt translated.")
    return {
        "status": "SUCCESS",
        "q_translated": total_q_translated,
        "opt_translated": total_opt_translated,
    }


def _calculate_seconds_until_midnight() -> float:
    """Calculates seconds until 23:55:00 IST (Asia/Kolkata)."""
    tz = ZoneInfo("Asia/Kolkata")
    now = datetime.now(tz)
    target = now.replace(hour=23, minute=55, second=0, microsecond=0)
    if now >= target:
        target = (now + timedelta(days=1)).replace(hour=23, minute=55, second=0, microsecond=0)
    delay = (target - now).total_seconds()
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

            # Recalculate today's leaderboards (idempotent: replaces the day's rows)
            try:
                from app.db.session import async_session_factory
                from app.services import leaderboard_service
                async with async_session_factory() as lb_session:
                    ranked = await leaderboard_service.refresh(lb_session)
                logger.info(f"🏆 Leaderboards recalculated: {ranked} students ranked.")
            except Exception as lb_err:
                logger.error(f"⚠️ Leaderboard refresh error (non-fatal): {lb_err}", exc_info=True)

            # Run proactive translation for Hindi + Marathi (non-blocking — errors don't stop the loop)
            try:
                await run_midnight_translation_job()
            except Exception as trans_err:
                logger.error(f"⚠️ Midnight translation job error (non-fatal): {trans_err}", exc_info=True)
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
