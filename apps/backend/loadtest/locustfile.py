"""Load test: students signing in, taking a short test and opening the result, all at once.

Setup (staging database, see app/scripts/loadtest_users.py):
    python -m app.scripts.loadtest_users create --count 100 --out loadtest/tokens.txt

Run (no install needed; uvx fetches Locust):
    LOADTEST_TOKENS=loadtest/tokens.txt LOADTEST_EXAM_ID=<published exam id> \
      uvx --from locust==2.37.10 locust -f loadtest/locustfile.py --host https://staging.example.in \
      --headless -u 100 -r 10 -t 10m --csv loadtest/result

Pass mark for the internal release: no failures, p95 under 1.5 s for the in-test calls (questions, answers,
heartbeat) and under 5 s for submit. Each student answers 15 questions, under the free plan's 20 a day.
"""
import itertools
import os
import random
import uuid

from locust import HttpUser, between, task

_tokens = [t.strip() for t in open(os.environ.get("LOADTEST_TOKENS", "loadtest/tokens.txt")) if t.strip()]
_next_token = itertools.cycle(_tokens)
EXAM_ID = os.environ["LOADTEST_EXAM_ID"]
ANSWERS_PER_TEST = int(os.environ.get("LOADTEST_ANSWERS", "15"))


def _option_id(option: dict):
    return option.get("option_id", option.get("id"))


class Student(HttpUser):
    wait_time = between(1, 4)

    def on_start(self):
        self.client.headers["Authorization"] = f"Bearer {next(_next_token)}"
        self.client.get("/api/v1/auth/me", name="auth/me")
        self.client.get("/api/v1/attempts/student-dashboard-stats", name="dashboard stats")

    @task
    def take_a_short_test(self):
        start = self.client.post(
            "/api/v1/attempts/start", json={"exam_id": EXAM_ID, "mode": "EXAM", "force_new": True}, name="attempt start"
        )
        if start.status_code != 201:
            return
        attempt_id = start.json()["attempt_id"]
        base = f"/api/v1/attempts/{attempt_id}"

        bulk = self.client.get(f"{base}/questions/bulk", name="questions bulk")
        questions = bulk.json().get("questions", []) if bulk.ok else []
        picked = questions[:ANSWERS_PER_TEST]

        # Answers go in small batches while the student works, as the exam screen does.
        for chunk in (picked[i : i + 5] for i in range(0, len(picked), 5)):
            responses = [
                {
                    "question_id": q["question_id"],
                    "selected_option_id": _option_id(random.choice(q["options"])) if q.get("options") else None,
                    "time_spent_seconds": random.uniform(20, 90),
                }
                for q in chunk
            ]
            self.client.post(
                f"{base}/responses/batch", json={"batch_id": uuid.uuid4().hex, "responses": responses}, name="responses batch"
            )
            self.client.post(f"{base}/heartbeat", json={"remaining_time_seconds": 3000}, name="heartbeat")

        self.client.post(f"{base}/submit", json={"submission_reason": "USER_CLICKED_SUBMIT"}, name="submit")
        self.client.get(f"{base}/result", name="result")
