"""Study Planner v2 engine: a port of the client's planner. These cases were worked through by hand in it."""
from datetime import date

import pytest

from app.services.planner_engine import (
    PlanOptions, build_schedule, catch_up_offsets, estimate, generate_message, materialize, plan_days, rev_offsets,
    weak_first,
)

MON = date(2026, 10, 19)  # a Monday


def items(spec):
    """spec: {"Polity": 4, "Economy": 2} -> pending subtopics in that order."""
    out = []
    for sub, n in spec.items():
        for k in range(n):
            out.append({"sub": sub, "top": f"{sub} topic", "st": f"part {k + 1}", "id": len(out) + 1})
    return out


def test_plan_days_caps_and_errors():
    assert plan_days(30, None, MON) == (30, "")
    assert plan_days(900, None, MON) == (365, "")
    days, note = plan_days(30, date(2026, 10, 29), MON)
    assert days == 10 and "shortened" in note
    for bad in ((0, None), (None, None), (5, MON)):
        with pytest.raises(ValueError):
            plan_days(bad[0], bad[1], MON)


def test_even_split_one_subject_at_a_time():
    s = build_schedule(items({"Polity": 5, "Economy": 5}), 5, PlanOptions(mock=None), MON)
    assert s["R"] == 0 and s["span"] == 5 and s["cal"] == ["study"] * 5
    assert [[i["id"] for i in d] for d in s["per"]] == [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]


def test_rest_and_mock_days_and_revision_tail():
    # 30 days from Monday: rest on Saturdays (6), mock on Sundays (0) but never in the first 3 days
    s = build_schedule(items({"Polity": 40}), 30, PlanOptions(rest=6, mock=0), MON)
    assert s["R"] == 4 and s["body"] == 26  # round(30 * 0.12) = 4 revision days at the end
    assert s["cal"][5:7] == ["rest", "mock"] and s["rest_n"] == 3 and s["mock_n"] == 3
    assert len(s["study_offs"]) == 26 - 3 - 3


def test_mock_skipped_in_first_three_days_and_short_plans_drop_weekly_days():
    s = build_schedule(items({"Polity": 3}), 3, PlanOptions(mock=js_dow_of(MON)), MON)
    assert s["cal"] == ["study"] * 3
    only_rest = build_schedule(items({"Polity": 3}), 1, PlanOptions(rest=js_dow_of(MON), mock=None), MON)
    assert only_rest["cal"] == ["study"] and only_rest["weekly_ignored"] is True


def js_dow_of(d):
    return (d.weekday() + 1) % 7


def test_no_tail_under_14_days():
    assert build_schedule(items({"A": 20}), 13, PlanOptions(), MON)["R"] == 0
    assert build_schedule(items({"A": 20}), 14, PlanOptions(mock=None), MON)["R"] == 2


def test_mixed_subjects_per_day():
    s = build_schedule(items({"Polity": 4, "Economy": 4}), 4, PlanOptions(mock=None, mix=2), MON)
    assert all({i["sub"] for i in d} == {"Polity", "Economy"} for d in s["per"])


def test_custom_days_per_subject():
    its = items({"Polity": 6, "Economy": 2, "History": 4})
    s = build_schedule(its, 10, PlanOptions(mock=None, subj_days={"Polity": 3}), MON)
    # Economy and History are capped at their topic counts, so the spare day goes back to Polity
    assert s["custom"]["alloc"] == {"Polity": 4, "Economy": 2, "History": 4}
    # Each day holds one subject only
    assert all(len({i["sub"] for i in d}) == 1 for d in s["per"])
    capped = build_schedule(its, 10, PlanOptions(mock=None, subj_days={"Economy": 9}), MON)
    assert capped["custom"]["alloc"]["Economy"] == 2 and "capped" in capped["custom"]["notes"][0]
    too_short = build_schedule(its, 2, PlanOptions(mock=None, subj_days={"Polity": 1}), MON)
    assert too_short["custom"] is None and "ignored" in too_short["custom_fail"]


def test_materialize_blocks_minutes_mock_and_revision():
    its = items({"Polity": 20, "Economy": 10})
    o = PlanOptions(hours=4, rest=None, mock=0, custom_title="Revise notes", answer_writing=True)
    sch = build_schedule(its, 30, o, MON)
    tasks = materialize(sch, its, o)
    day0 = [t for t in tasks if t["offset"] == 0]
    # 30 topics over 23 study days (26 minus 3 Sunday mocks): one topic on day 0
    assert [t["block"] for t in day0] == [None, "ca", "custom", "pyq", "aw"]
    # 240 - 30 (current affairs) - 20 (custom) - 20 (PYQs) = 170 minutes for the topic
    assert day0[0]["minutes"] == 170 and day0[0]["planner_subtopic_id"] == 1 and day0[0]["title"] == "Polity topic: part 1"
    mocks = [t for t in tasks if t["block"] == "mock"]
    assert mocks and mocks[0]["title"] == "Weekly Mains answer-writing test + evaluation" and mocks[0]["minutes"] == 180
    rev = [t for t in tasks if t["block"] == "rev"]
    assert [t["offset"] for t in rev] == [26, 27, 28, 29] and {t["title"] for t in rev} == {"Full revision: Polity", "Full revision: Economy"}
    assert sum(1 for t in tasks if t["planner_subtopic_id"]) == 30
    assert "Last 4 day(s) are for revision" in generate_message(sch, 30, 30, o, "", 0)


def test_estimate_and_overload_warning():
    est = estimate(items({"Polity": 40}), 5, PlanOptions(hours=2, mock=None), MON, 1)
    assert est["text"].startswith("1 subject(s), 40 topics → about 8 topics per day over 5 study day(s)")
    assert est["warning"] and "8 topics a day" in est["warning"]
    assert estimate([], 5, PlanOptions(), MON, 0)["text"] == "No pending topics in the selected subjects."


def test_weak_topics_first():
    its = items({"Polity": 2, "Economy": 2})
    its[3]["acc"] = 40  # linked bank subtopic below 60%
    weak = [{"subject": "Polity", "topic": "part 2", "acc": 30}]
    ordered, n = weak_first(its, weak)
    # 4: own accuracy; 2: exact topic match; 1: word match on "part"
    assert n == 3 and [i["id"] for i in ordered] == [4, 2, 1, 3]


def test_revision_offsets_and_catch_up_spread():
    assert rev_offsets() == [1, 3, 7, 21]
    assert rev_offsets(weak_acc=45) == [1, 3, 7, 14, 21, 30]
    assert rev_offsets(rating=2) == [1, 2, 4, 7, 14, 30]
    assert catch_up_offsets(12) == [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]
    assert catch_up_offsets(3) == [0, 1, 2]
