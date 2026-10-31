"""Study Planner v2 engine: lays a syllabus out over N days. Pure functions, no database.

A line-by-line port of the client's planner (allocSubjectDays, buildSchedule, generatePlan, updatePlanEst,
showPlanWarn, revOffsets and the catch-up spread), so plans match what the client signed off. Weekdays use the
client's numbering: 0 = Sunday … 6 = Saturday.

An item is a pending subtopic: {"sub", "top", "st", "id"} plus, optionally, "acc" (the student's accuracy on the
linked question-bank subtopic, when it counts as weak).
"""
import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

MAX_DAYS = 365
CA_MIN, PYQ_MIN, CUSTOM_MIN, AW_MIN = 30, 20, 20, 30


@dataclass
class PlanOptions:
    hours: float = 4
    mock: Optional[int] = 0  # weekly mock-test weekday, None = no mock day
    rest: Optional[int] = None  # weekly rest weekday
    tail: bool = True  # keep the last ~12% of 14+ day plans for full revision
    mix: int = 1  # subjects per study day: 1 = one by one, 2 or 3 mixed
    subj_days: Dict[str, int] = field(default_factory=dict)  # optional study days per subject
    ca: bool = True  # daily current affairs block
    pyq: bool = True  # daily 10-PYQ block
    custom_title: str = ""  # the student's own daily task
    answer_writing: bool = False  # Mains-style exams


def js_round(x: float) -> int:
    """JavaScript Math.round (halves go up), not Python's round-half-even."""
    return math.floor(x + 0.5)


def js_dow(d: date) -> int:
    return (d.weekday() + 1) % 7


def rnd(v: float, step: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, js_round(v / step) * step))


def plan_days(days: Optional[int], exam_date: Optional[date], today: date) -> Tuple[int, str]:
    """Days to plan for, capped at 365 and by the exam date. Raises ValueError with a message for the student."""
    if not days or days < 1:
        raise ValueError("Enter how many days you want to plan for.")
    days = min(MAX_DAYS, days)
    note = ""
    if exam_date:
        left = (exam_date - today).days
        if left < 1:
            raise ValueError("Exam date must be in the future (or clear it).")
        if days > left:
            days = left
            note = f" Exam is in {left} day(s), so the plan was shortened to fit."
    return days, note


def _unique_subjects(items: List[Dict[str, Any]]) -> List[str]:
    return list(dict.fromkeys(i["sub"] for i in items))


def alloc_subject_days(items: List[Dict[str, Any]], S: int, o: PlanOptions) -> Optional[Dict[str, Any]]:
    """Give each subject its own block of study days: custom days honoured, the rest split by topic count."""
    subs = _unique_subjects(items)
    cnt: Dict[str, int] = {}
    for i in items:
        cnt[i["sub"]] = cnt.get(i["sub"], 0) + 1
    custom = [s for s in subs if (o.subj_days.get(s) or 0) > 0]
    notes: List[str] = []
    if not custom:
        return None
    if S < len(subs):
        return {"fail": "Not enough study days to give every subject its own block, so custom days were ignored."}
    alloc: Dict[str, int] = {}
    want: Dict[str, int] = {}
    for s in custom:
        want[s] = min(o.subj_days[s], cnt[s])
        if want[s] < o.subj_days[s]:
            notes.append(f"{s} capped at {want[s]} day(s) (only {cnt[s]} topics)")
        alloc[s] = want[s]
    auto = [s for s in subs if s not in alloc]

    def grow(lst: List[str], total: int, cap: Dict[str, int], load) -> int:
        """Add days one at a time to the most loaded subject."""
        left = total
        while left > 0:
            cands = sorted((s for s in lst if alloc[s] < cap[s]), key=lambda s: -load(s) / alloc[s])
            if not cands:
                break
            alloc[cands[0]] += 1
            left -= 1
        return left

    used = sum(alloc[s] for s in custom)
    if used + len(auto) > S:
        auto_t = sum(cnt[s] for s in auto)
        auto_share = min(S - len(custom), max(len(auto), js_round(S * auto_t / len(items))))
        for s in custom:
            alloc[s] = 1
        grow(custom, max(0, S - auto_share - len(custom)), want, lambda s: want[s])
        notes.append("your custom days were more than the study days available, so they were scaled down")
    for s in auto:
        alloc[s] = 1
    used = sum(alloc[s] for s in subs)
    rem = S - used
    if not auto and rem > 0:
        notes.append(f"{rem} extra study day(s) were shared across subjects by topic count")
    if rem > 0:
        rem = grow(auto if auto else subs, rem, cnt, lambda s: cnt[s])
    if rem > 0 and auto:
        grow(subs, rem, cnt, lambda s: cnt[s])
    per: List[List[Dict[str, Any]]] = []
    st = 0
    for s in subs:
        L = alloc[s]
        arr = [i for i in items if i["sub"] == s]
        q = len(arr)
        per.extend([] for _ in range(L))
        for i, it in enumerate(arr):
            per[st + (i * L) // q].append(it)
        st += L
    return {"per": per, "alloc": alloc, "order": subs, "notes": notes}


def build_schedule(items: List[Dict[str, Any]], D: int, o: PlanOptions, today: date) -> Dict[str, Any]:
    """Lay the plan out on the calendar: study / mock / rest days, then a revision tail."""
    R = max(2, js_round(D * 0.12)) if (o.tail and D >= 14) else 0
    body = D - R

    def mk(weekly: bool) -> List[str]:
        cal = []
        for off in range(body):
            dow = js_dow(today + timedelta(days=off))
            kind = "study"
            if weekly:
                if o.rest is not None and dow == o.rest:
                    kind = "rest"
                elif o.mock is not None and dow == o.mock and off >= 3:
                    kind = "mock"
            cal.append(kind)
        return cal

    cal = mk(True)
    weekly_ignored = False
    if "study" not in cal:
        cal = mk(False)
        weekly_ignored = o.rest is not None or o.mock is not None
    study_offs = [i for i, t in enumerate(cal) if t == "study"]
    n = len(items)
    span = max(1, min(len(study_offs), n))

    def quota(j: int) -> int:
        return ((j + 1) * n) // span - (j * n) // span

    per: List[List[Dict[str, Any]]] = []
    custom = None
    ca = alloc_subject_days(items, len(study_offs), o)
    if ca and not ca.get("fail"):
        per = ca["per"]
        custom = ca
    elif o.mix <= 1:
        p = 0
        for j in range(span):
            q = quota(j)
            per.append(items[p:p + q])
            p += q
    else:
        subs = _unique_subjects(items)
        Q = {s: [i for i in items if i["sub"] == s] for s in subs}

        def ranked() -> List[str]:
            return sorted((s for s in subs if Q[s]), key=lambda s: (-len(Q[s]), subs.index(s)))

        for j in range(span):
            q = quota(j)
            day: List[Dict[str, Any]] = []
            act = ranked()[:o.mix]
            left = q
            for i, s in enumerate(act):
                take = min(q // len(act) + (1 if i < q % len(act) else 0), len(Q[s]))
                day.extend(Q[s][:take])
                del Q[s][:take]
                left -= take
            while left > 0:
                r = ranked()
                if not r:
                    break
                day.append(Q[r[0]].pop(0))
                left -= 1
            per.append(day)
    if custom:
        span = len(per)
    return {
        "cal": cal, "R": R, "body": body, "study_offs": study_offs, "span": span, "per": per,
        "weekly_ignored": weekly_ignored, "custom": custom, "custom_fail": ca.get("fail") if ca else None,
        "mock_n": cal.count("mock"), "rest_n": cal.count("rest"),
        "max_per": max([1] + [len(a) for a in per]),
    }


def overload_warning(per_day: int, hours: float) -> Optional[str]:
    mins = per_day * 30
    if mins > hours * 60 + 1 or per_day >= 8:
        return (f"Heads up: up to {per_day} topics a day needs ~{js_round(mins / 6) / 10:g} hr at 30 min each, but you "
                f"set {hours:g} hr/day. Add more days, fewer subjects, or more hours.")
    return None


def estimate(items: List[Dict[str, Any]], D: int, o: PlanOptions, today: date, n_subjects: int) -> Dict[str, Any]:
    """The live line under the form, before the student generates."""
    n = len(items)
    if not n:
        return {"text": "No pending topics in the selected subjects.", "warning": None, "topics": 0}
    s = build_schedule(items, D, o, today)
    per = math.ceil(n / s["span"])
    extra = ", ".join(x for x in (s["rest_n"] and f"{s['rest_n']} rest", s["mock_n"] and f"{s['mock_n']} mock",
                                  s["R"] and f"{s['R']} revision") if x)
    text = (f"{n_subjects} subject(s), {n} topics → about {per} topic{'s' if per > 1 else ''} per day over "
            f"{s['span']} study day(s)" + (f" (+ {extra} day(s))" if extra else "") + f" at {o.hours:g} hr/day."
            + (" Custom subject days applied." if s["custom"] else "")
            + (" " + s["custom_fail"] if s["custom_fail"] else ""))
    return {"text": text, "warning": overload_warning(s["max_per"], o.hours), "topics": n, "study_days": s["span"]}


def _task(off: int, subject: str, title: str, minutes: int, block: Optional[str] = None,
          item: Optional[Dict[str, Any]] = None, activity: str = "NEW_TOPIC") -> Dict[str, Any]:
    return {"offset": off, "subject": subject, "title": title, "minutes": minutes, "block": block,
            "planner_subtopic_id": item["id"] if item else None, "topic": item["top"] if item else None,
            "subtopic": item["st"] if item else None, "activity_type": activity}


def materialize(sch: Dict[str, Any], items: List[Dict[str, Any]], o: PlanOptions) -> List[Dict[str, Any]]:
    """Tasks with a day offset from the start: topics and daily blocks, weekly mocks, and the revision tail."""
    tasks: List[Dict[str, Any]] = []
    custom = (o.custom_title or "").strip()[:60]
    blk_min = (CA_MIN if o.ca else 0) + (PYQ_MIN if o.pyq else 0) + (CUSTOM_MIN if custom else 0)
    for j, arr in enumerate(sch["per"]):
        off = sch["study_offs"][j]
        mins = rnd(max(60, o.hours * 60 - blk_min) / max(1, len(arr)), 5, 20, 180)
        for it in arr:
            tasks.append(_task(off, it["sub"], f"{it['top']}: {it['st']}", mins, item=it))
        if o.ca:
            tasks.append(_task(off, "Current Affairs", "Daily current affairs: news + short notes", CA_MIN, "ca",
                               activity="NOTES_REVIEW"))
        if custom:
            tasks.append(_task(off, "My task", custom, CUSTOM_MIN, "custom", activity="NOTES_REVIEW"))
        if o.pyq:
            tasks.append(_task(off, "PYQ Practice", "Solve 10 PYQs on today's topics", PYQ_MIN, "pyq",
                               activity="PYQ_SOLVING"))
        if o.answer_writing:
            tasks.append(_task(off, "Answer Writing", "Write 2 answers (150 words / 10 marks) on today's topics",
                               AW_MIN, "aw", activity="PRACTICE_MCQS"))
    for off, kind in enumerate(sch["cal"]):
        if kind == "mock":
            title = "Weekly Mains answer-writing test + evaluation" if o.answer_writing else "Weekly mock test + error analysis"
            tasks.append(_task(off, "Mock Test", title, rnd(o.hours * 60, 15, 60, 180), "mock", activity="MOCK_TEST"))
    if sch["R"]:
        subs = _unique_subjects(items)
        S, R = len(subs), sch["R"]
        for i in range(R):
            group = subs[(i * S) // R:((i + 1) * S) // R] if S >= R else [subs[i % S]]
            for sb in group:
                tasks.append(_task(sch["body"] + i, "Revision", "Full revision: " + sb,
                                   rnd(o.hours * 60 / len(group), 15, 30, 180), "rev", activity="CONCEPT_REVISION"))
    return tasks


def generate_message(sch: Dict[str, Any], n_items: int, days: int, o: PlanOptions, date_note: str, weak_n: int) -> str:
    msg = f"Scheduled {n_items} topic(s) over {sch['span']} study day(s) in a {days}-day plan, starting today."
    if sch["span"] < min(days - sch["R"], len(sch["study_offs"])):
        msg += f" Only {n_items} topics are pending, so study finishes early."
    if sch["R"]:
        msg += f" Last {sch['R']} day(s) are for revision."
    if sch["mock_n"]:
        msg += f" {sch['mock_n']} weekly mock day(s) added."
    c = sch["custom"]
    if c:
        msg += " Days per subject: " + ", ".join(f"{s} {c['alloc'][s]}" for s in c["order"]) + "."
        if o.mix > 1:
            msg += " Custom days run one subject at a time."
        if c["notes"]:
            msg += " Note: " + "; ".join(c["notes"]) + "."
    if sch["custom_fail"]:
        msg += " " + sch["custom_fail"]
    if sch["weekly_ignored"]:
        msg += " Plan is too short for rest/mock days, so they were skipped."
    msg += date_note
    if weak_n:
        msg += f" {weak_n} weak-area topic(s) placed first."
    return msg


def weak_first(items: List[Dict[str, Any]], weak: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], int]:
    """Move weak topics to the front, weakest first. An item's own "acc" (linked bank subtopic) is the best
    match; otherwise match by name against weak topics {subject, topic, acc}, as the client's planner does."""
    def rank(it: Dict[str, Any]) -> Optional[Tuple[int, float]]:
        if it.get("acc") is not None:
            return (0, it["acc"])
        best = None
        hay = f"{it['top']} {it['st']}".lower()
        sub = it["sub"].lower()
        for w in weak:
            wt = str(w.get("topic", "")).lower()
            words = [x for x in wt.split() if len(x) > 3]
            sub_ok = (str(w.get("subject", "")).lower().split(" ") or [""])[0] in sub
            r = None
            if sub_ok and wt and wt in hay:
                r = (1, w["acc"])
            elif sub_ok and any(x in hay for x in words):
                r = (2, w["acc"])
            if r and (best is None or r < best):
                best = r
        return best

    ranked = [(it, i, rank(it)) for i, it in enumerate(items)]
    weak_n = sum(1 for _, _, r in ranked if r)
    ranked.sort(key=lambda x: (0, x[2][0], x[2][1], x[1]) if x[2] else (1, 0, 0, x[1]))
    return [x[0] for x in ranked], weak_n


def rev_offsets(rating: Optional[int] = None, weak_acc: Optional[float] = None) -> List[int]:
    """Days after finishing a topic to revise it."""
    o = [1, 2, 4, 7, 14, 30] if rating and rating <= 2 else [1, 3, 7, 14, 21] if rating == 3 else [1, 3, 7, 21]
    if weak_acc is not None and weak_acc < 60:
        o = o + [14, 30]
    return sorted(set(o))


def catch_up_offsets(n: int) -> List[int]:
    """Spread n missed topics over the next 5 days, starting today."""
    if n <= 0:
        return []
    per_day = math.ceil(n / 5)
    return [j // per_day for j in range(n)]
