"""The student's study plan as an iCalendar feed that Google, Apple and Outlook subscribe to.

Same layout as the "Download .ics" file in the app (utils/planExport.ts): all-day events, one per day for its plan
topics, one per daily block (current affairs, PYQs, mocks, revision days…) and one per day for spaced revisions.
Event UIDs are stable per user, day and kind, so a calendar refresh updates events in place.
"""
from collections import OrderedDict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List

CAL_NAME = "ExamPlanner study plan"
REFRESH = "PT6H"  # how often we ask calendar apps to refresh (Google decides on its own)


def _esc(text: str) -> str:
    return (str(text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
            .replace("\r\n", "\\n").replace("\n", "\\n"))


def _fold(line: str) -> str:
    """Lines over 75 octets are folded: CRLF plus a space, without splitting a UTF-8 character."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, cur, size = [], "", 0
    for ch in line:
        n = len(ch.encode("utf-8"))
        if size + n > (75 if not parts else 74):
            parts.append(cur)
            cur, size = "", 0
        cur += ch
        size += n
    parts.append(cur)
    return "\r\n ".join(parts)


def _day(d: date) -> str:
    return d.strftime("%Y%m%d")


def build_calendar(tasks: List[Dict[str, Any]], user_id: int, label: str = "") -> str:
    """tasks: planner_service.task_out() dicts (date, title, subject, minutes, block)."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    name = f"{CAL_NAME} – {label}" if label else CAL_NAME
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ExamPlanner//Study Planner//EN", "CALSCALE:GREGORIAN",
             "METHOD:PUBLISH", f"X-WR-CALNAME:{_esc(name)}", "X-WR-TIMEZONE:Asia/Kolkata",
             f"REFRESH-INTERVAL;VALUE=DURATION:{REFRESH}", f"X-PUBLISHED-TTL:{REFRESH}"]

    def event(day: date, uid: str, summary: str, desc: str) -> None:
        lines.extend(["BEGIN:VEVENT", f"UID:{uid}-{user_id}@examplanner", f"DTSTAMP:{stamp}",
                      f"DTSTART;VALUE=DATE:{_day(day)}", f"DTEND;VALUE=DATE:{_day(day + timedelta(days=1))}",
                      f"SUMMARY:{_esc(summary)}", f"DESCRIPTION:{_esc(desc)}", "TRANSP:TRANSPARENT", "END:VEVENT"])

    by_day: "OrderedDict[str, List[Dict[str, Any]]]" = OrderedDict()
    for t in sorted(tasks, key=lambda x: x["date"]):
        by_day.setdefault(t["date"], []).append(t)
    for key, items in by_day.items():
        day = date.fromisoformat(key)
        topics = [t for t in items if not t.get("block")]
        blocks = [t for t in items if t.get("block") and t["block"] != "auto_rev"]
        revs = [t for t in items if t.get("block") == "auto_rev"]
        if topics:
            event(day, f"{key}-plan", f"Study: {len(topics)} topic{'s' if len(topics) > 1 else ''}",
                  "\n".join(f"{t['title']} ({t.get('subject') or 'Task'}, {t.get('minutes') or 0} min)" for t in topics))
        for i, t in enumerate(blocks):
            event(day, f"{key}-blk{i}", t["title"], f"{t.get('minutes') or 0} min")
        if revs:
            event(day, f"{key}-rev", f"Revise: {len(revs)} topic{'s' if len(revs) > 1 else ''}",
                  "\n".join(t["title"] for t in revs))
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
