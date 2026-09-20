import hashlib
import json
from typing import Any, Optional, Dict
from app.cache.factory import get_cache
from app.config.settings import get_settings
from app.config.logger import setup_logger

logger = setup_logger("CacheHelpers")


def generate_filter_hash(params: Dict[str, Any]) -> str:
    """Generates a stable, sorted MD5 hash for query parameter dictionaries."""
    filtered = {
        k: str(v)
        for k, v in sorted(params.items())
        if v is not None and v != "" and k not in ("session", "current_user", "background_tasks")
    }
    if not filtered:
        return "all"
    raw_str = json.dumps(filtered, sort_keys=True)
    return hashlib.md5(raw_str.encode("utf-8")).hexdigest()[:12]


def build_cache_key(prefix: str, *args, **kwargs) -> str:
    """Builds a standardized namespaced cache key: 'ep:{prefix}:{arg1}:{arg2}:...'."""
    settings = get_settings()
    app_prefix = settings.CACHE_KEY_PREFIX or "ep"

    parts = [app_prefix, prefix]
    for arg in args:
        if arg is not None:
            parts.append(str(arg))

    if kwargs:
        filter_hash = generate_filter_hash(kwargs)
        parts.append(filter_hash)

    return ":".join(parts)


async def invalidate_exam_cache(exam_id: str) -> None:
    """Invalidates all cached data associated with a specific exam or exam listings."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"

    exam_id_str = str(exam_id)
    keys_to_delete = [
        f"{prefix}:exams:detail:{exam_id_str}",
        f"{prefix}:exams:manifest:{exam_id_str}",
        f"{prefix}:exams:structure:{exam_id_str}",
        f"{prefix}:exams:syllabus:{exam_id_str}",
    ]

    for k in keys_to_delete:
        await cache.delete(k)

    # Invalidate wildcard patterns
    patterns = [
        f"{prefix}:exams:list*",
        f"{prefix}:exams:search*",
        f"{prefix}:exams:pipeline_status*",
        f"{prefix}:exams:by_year*",
        f"{prefix}:exams:integrity*",
        f"{prefix}:admin:pipeline_status*",
        f"{prefix}:admin:stuck_pipelines*",
        f"{prefix}:exams:review:{exam_id_str}*",
        f"{prefix}:admin:review:{exam_id_str}*",
        f"{prefix}:admin:overview_stats*",
        f"{prefix}:admin:question_catalog*",
        f"{prefix}:syllabus:complete:{exam_id_str}*",
        f"{prefix}:syllabus:complete:master*",
    ]
    for pat in patterns:
        deleted = await cache.delete_pattern(pat)
        if deleted:
            logger.debug(f"[CACHE_INVALIDATE] Pattern '{pat}' deleted {deleted} keys.")


async def invalidate_review_cache(
    question_id: Optional[str] = None, exam_id: Optional[str] = None
) -> None:
    """Invalidates cached HITL review tasks, review queue count, and question review details."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"

    await cache.delete_pattern(f"{prefix}:review:tasks*")
    await cache.delete_pattern(f"{prefix}:hitl:tasks*")
    await cache.delete_pattern(f"{prefix}:review:queue:count*")
    await cache.delete_pattern(f"{prefix}:admin:question_catalog*")

    if question_id:
        q_id_str = str(question_id)
        await cache.delete_pattern(f"{prefix}:hitl:task_detail:{q_id_str}*")

    if exam_id:
        exam_id_str = str(exam_id)
        await cache.delete_pattern(f"{prefix}:exams:review:{exam_id_str}*")
        await cache.delete_pattern(f"{prefix}:admin:review:{exam_id_str}*")
    else:
        await cache.delete_pattern(f"{prefix}:exams:review:*")
        await cache.delete_pattern(f"{prefix}:admin:review:*")


async def invalidate_question_cache(
    question_id: str, exam_id: Optional[str] = None
) -> None:
    """Invalidates cache entries for a modified question and related question listings."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"

    q_id_str = str(question_id)
    await cache.delete_pattern(f"{prefix}:questions:detail:{q_id_str}*")
    await cache.delete_pattern(f"{prefix}:questions:list*")
    # The admin dashboard shows the published-question count, which any question change can move.
    await cache.delete_pattern(f"{prefix}:admin:overview_stats*")

    await invalidate_review_cache(q_id_str, exam_id)


async def invalidate_study_activity_cache(user_id: str | int) -> None:
    """Clears everything derived from a student's logged study activities.

    Call after creating/changing a StudyActivity, otherwise the dashboard's "Today's Study Log",
    the weekly schedule/insights and the streak stats keep serving their cached copies.
    """
    cache = get_cache()
    uid = str(user_id)
    await cache.delete(build_cache_key("analytics:activity_today", uid))
    await cache.delete(build_cache_key("auth:me:stats", uid))
    await cache.delete_pattern(f"*weekly_schedule*{uid}*")
    await cache.delete_pattern(f"*weekly_insights*{uid}*")


async def invalidate_user_cache(user_id: str | int, clerk_id: Optional[str] = None) -> None:
    """Invalidates user profile, permissions, streak/XP stats, and attempt history cache."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"

    u_id_str = str(user_id)
    await cache.delete(f"{prefix}:users:detail:{u_id_str}")
    await cache.delete(f"{prefix}:user:id:{u_id_str}")
    await cache.delete(f"{prefix}:auth:user_stats:{u_id_str}")
    await cache.delete(f"{prefix}:auth:me:stats:{u_id_str}")

    if clerk_id:
        await cache.delete(f"{prefix}:user:clerk:{clerk_id}")
    else:
        await cache.delete_pattern(f"{prefix}:user:clerk:*")

    await cache.delete_pattern(f"{prefix}:users:bookmarks:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:users:list*")
    await cache.delete_pattern(f"{prefix}:attempts:user:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:skill_profile:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:aggregate:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:cumulative:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:subj_perf:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:rank:{u_id_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:monthly_benchmark:{u_id_str}*")


async def invalidate_role_cache(role_id: Optional[int | str] = None) -> None:
    """Invalidates cached role permissions and dynamic RBAC mappings."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"

    if role_id is not None:
        await cache.delete(f"{prefix}:role:{role_id}:permissions")
    else:
        await cache.delete_pattern(f"{prefix}:role:*")
    # Also invalidate teacher slug cache if system role might have been altered
    await cache.delete(f"{prefix}:role:slug:teacher")



async def invalidate_pipeline_status_cache() -> None:
    """Invalidates active pipeline queue status and stuck pipelines cache."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"
    await cache.delete(f"{prefix}:exams:pipeline_status")
    await cache.delete(f"{prefix}:admin:pipeline_status")
    await cache.delete(f"{prefix}:admin:stuck_pipelines")


async def invalidate_taxonomy_cache() -> None:
    """Invalidates dynamic syllabus hierarchy taxonomy cache."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"
    await cache.delete(f"{prefix}:questions:taxonomy")
    await cache.delete_pattern(f"{prefix}:syllabus:complete*")


async def invalidate_attempt_cache(attempt_id: int | str, user_id: Optional[int | str] = None) -> None:
    """Invalidates all cached telemetry, 12 matrices, question reports, and delta reports for an attempt."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"

    att_str = str(attempt_id)
    await cache.delete_pattern(f"{prefix}:analytics:attempt_q:{att_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:attempt_exam:{att_str}*")
    await cache.delete_pattern(f"{prefix}:analytics:attempt_delta:{att_str}*")
    await cache.delete_pattern(f"{prefix}:attempts:detail:{att_str}*")
    await cache.delete_pattern(f"{prefix}:attempts:status:{att_str}*")

    if user_id:
        await invalidate_user_cache(str(user_id))


async def invalidate_exam_type_cache() -> None:
    """Invalidates active and admin exam type listings and configuration cache."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"
    await cache.delete_pattern(f"{prefix}:exam_types*")
    await cache.delete_pattern(f"{prefix}:admin:exam_types*")


async def invalidate_site_settings_cache() -> None:
    """Invalidates active theme and global site settings cache."""
    cache = get_cache()
    settings = get_settings()
    prefix = settings.CACHE_KEY_PREFIX or "ep"
    await cache.delete_pattern(f"{prefix}:site_settings*")
    await cache.delete_pattern(f"{prefix}:theme*")
