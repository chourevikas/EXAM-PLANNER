# PRD Implementation Plan

**Based on:** [PRD_GAP_ANALYSIS.md](PRD_GAP_ANALYSIS.md) and the client decisions recorded there in §0, including the second-round answers (16 Oct 2026)
**Branch base:** `release/0.0.1`. One feature branch and PR per workstream (`pankajpandey/<topic>`).
**Definition of done for every item:**
- backend tests added or updated;
- tested end to end in the browser (UI + API) as the right role, at desktop and phone widths;
- GitNexus `impact` check run before editing, and `detect_changes` before committing.

## Context
The client reviewed the gap analysis. Several AI items are **on hold**:
- mistake classification;
- the NOT/INCORRECT keyword check;
- the study recommendation;
- AI Mentor chat;
- flashcards;
- the future-AI features.

The client confirmed what to build next:
- difficulty analysis;
- state and national leaderboards, with a username-or-name choice;
- full language support in the exam;
- the free plan (20 questions a day, no analysis);
- editable target exam and year;
- milestone badges;
- a user-scheduled weekly notification.

Two items weren't discussed but **have to come first**. Payment is simulated (it writes `PREMIUM` to localStorage), and some numbers students see are invented. The free plan also can't be enforced without real payment, since there would be no way to upgrade. Those two form Phase 0.

---

## Phase 0: foundation (not discussed with the client; required)

### 0.1 Merge real payments
- Merge `origin/pankajpandey/payment-gateway-integration` into `release/0.0.1`.
  - It brings `routers/payments.py`, `services/entitlement_service.py`, `require_feature` in `core/deps.py`, `routers/entitlements.py`, `FeatureUsageEvent` and migrations `056`/`060`/`061`.
- **Migration chain:** `release/0.0.1` already has migrations up to `059_response_answer_round`. Re-parent the branch's migrations onto the current head. Check each file's `revision` string, not its filename (see the run-app skill).
- Delete the localStorage "payment" in `apps/frontend/src/pages/PricingPage.tsx` (`handleCompletePayment`) and use the branch's checkout flow.
- Run the whole flow against the **Cashfree sandbox** before release: order → pay → webhook → subscription active → receipt. Production go-live (keys, domain whitelist, dashboard webhooks including `DISPUTE_*`) stays a separate ops task.

### 0.2 Remove made-up numbers
Replace each with a real query, or hide the widget until real data exists:

| Where | Fix |
|---|---|
| `DashboardPage.tsx:206` "polity accuracy up 12%" | Real week-on-week subject delta from `/analytics/subject-performance`, or hide |
| `DashboardPage.tsx` "Deep Behavioral Insights" card (~504–558) | Fill it from the latest attempt report, or hide |
| `analytics_service.get_monthly_benchmark` | Real monthly series from attempts. Remove the generated `−3.5`/month history, the fixed `"August 2026"` and the static national averages |
| `analytics_service.get_predicted_rank` | Replace it with the real rank from Phase 3, and show "not enough data" when there are no attempts (instead of 75.0) |
| `/study-plan/weekly-insights` | Remove the default `avg_accuracy=78` and the fixed focus text |
| `POST /study-plan/generate-weekly-plan` | Keep the template but stop labelling it "AI" (`is_ai_recommended`), since the AI recommendation is on hold |
| `StudentTopHeader.tsx` fake search results on error | Show an error/empty state |
| Admin `MockTestsView.tsx`, `MockSelectionPage` `progressPercent=65` | Hide the admin screen; compute progress for real |
| Dead `pages/SignUpPage.tsx`, `pages/SignInPage.tsx` (fake Google account) | Delete |
| `PricingPage` feature list | List only features that exist |

---

## Phase 1: quick client items

### 1.1 Target exam and year editable
- `apps/backend/app/routers/auth.py`: remove `target_exam` and `target_year` from `LOCKED_TARGET_FIELDS`. Keep `optional_subject` locked; it was removed on purpose.
- On change, call `invalidate_user_cache` so recommendations, dashboards and plans pick up the new target.
- `ProfilePage.tsx`: make both fields editable, using the same options as onboarding.

### 1.2 Difficulty analysis
- `engine/matrix_orchestrator.py` `compute_full_report`: add `by_difficulty`. For each of EASY, MEDIUM and HARD: attempted, correct, wrong, skipped, accuracy %, average time, and marks gained/lost. `Question.difficulty` is already on every question.
- Add it to `apps/frontend/src/types/exam.ts`, and render a card in `PsychometricReportView.tsx` / `ReportSummary.tsx` (bars per level).
- Older reports don't have the field, so compute it when an old report is read, or hide the card for them.
- Add a difficulty filter to `PYQSelectionPage` (the backend already accepts `difficulty`); also add it to `StartExamRequest`.

### 1.3 Explanation language bug
- `routers/questions.py` `get_question_solution` (~line 622): join `QuestionExplanation` on `language = requested`, falling back to English. Include the language in the cache key (it already is).

---

## Phase 2: free plan (20 questions a day, no summary or analysis) ✅ built
Payments are on hold, so this uses the existing `StudentProfile.subscription_tier`; admins can grant Premium from the admin panel. It does **not** depend on the payments branch's `EntitlementService`. When payments land, the limit can move into plan features.

**Client decisions (17 Oct):**
- Answers on the practice page count, as well as answers in tests.
- A free student can start any paper (including a full one); once they've answered 20 questions that day, further answers are blocked.

- **Counting** (`app/services/free_plan.py`):
  - Test answers are counted via `exam_question_responses.answered_at`, set the first time a question is answered.
  - Practice answers are counted via `practice_answers`, one per question per day.
  - The day is the IST calendar day.
  - Changing an answer that was already counted is free.
  - Premium students and staff are unlimited.
- **Enforcement:**
  - Single answer save: a new answer over the limit returns 403 `FREE_DAILY_LIMIT_REACHED`.
  - Batch save and submit: new answers beyond the limit are dropped, and the batch acknowledgement reports `daily_limit_skipped`.
  - Practice (`POST /practice/answers`): returns 403 at the limit.
  - Usage for the UI: `GET /users/me/daily-usage`.
- **Analysis:**
  - A free student's own attempt JSON is reduced to the score and per-question review (`analysis_locked: true`).
  - The exam matrices, progression, cumulative and skill-profile reports return 403 `FREE_PLAN_ANALYSIS_LOCKED`.
  - No LLM call is made for free students, neither per attempt nor for the all-exams summary; they get the rule-based insight instead.
  - Staff still see the full report.
- **UX:**
  - "Free plan: X of 20 questions left today" appears on the exam and practice screens, with an upgrade modal at the limit.
  - A locked report shows the score, an upgrade card and the Questions tab.
  - The all-tests view shows an upgrade card.
- **Migration** `062_free_plan_daily_usage` follows `059`. The payments branch also follows `059` (its `060`/`061`), so merging it needs an Alembic merge revision joining the two heads.
- **Not counted:** guest sessions synced at login, and "similar questions" answered inside a report.

---

## Phase 3: state and national leaderboards ✅ built
**XP values (client-approved, 17 Oct):**

| Action | XP |
|---|---|
| Correct answer (tests and practice) | +10 |
| Test completed | +50 |
| Active day | +20 |
| Milestone (Phase 4) | +100 |

- **Real XP ledger:** `xp_logs` is the source of truth, and each award has a `ref_key` unique per user, so retries or re-evaluations never pay twice. `StudentProfile.total_xp` mirrors the ledger. `/auth/me` no longer reports or writes back "questions attempted × 10".
- **Backfill:** migration `063` gives existing students the XP their history earns under these values, using the same keys as live awards, so nothing is paid twice. Some totals change as a result: a student whose old number came from questions × 10 can go down.
- **Ranking:** XP first (it already includes 10 per correct answer, so correct answers aren't counted twice), then correct answers, then whoever reached their XP first.
  - A student is ranked once they have one correct answer and a target exam.
  - Rankings are per target exam.
- **Daily snapshot:** `leaderboard_snapshots`, rebuilt by the 23:55 IST job (idempotent). The first request after deploy builds today's snapshot.
  - The order is fixed for the day.
  - State membership uses the student's current profile state, so setting a state takes effect at once, in the day's order.
  - The change shown is against the previous snapshot.
- **Profile fields:**
  - `state` (list of states and UTs);
  - `username`: unique, 3–20 characters of `[a-z0-9_]`, changeable if free; 409 when taken; `GET /users/username-available`;
  - `leaderboard_display`: USERNAME or NAME. Without a username, the name shows as "First L.".
- **UI:**
  - `/leaderboard` page with National and state tabs, an exam selector, "Your rank", ▲/▼ since yesterday, pagination, and a prompt to set state and username;
  - leaderboard fields on the profile's Exam Targets tab (`/profile?tab=exam`);
  - "Rank #N of M" on the dashboard XP card.
- **Migration** `063_leaderboards_and_xp_ledger` follows `062`.

---

## Phase 4: milestones and weekly notifications

### 4.1 Milestone badges
- Extend `Badge` (`db/models/gamification.py`) with `criteria_type` (`QUESTIONS_SOLVED`, `STREAK_DAYS`, `TESTS_COMPLETED`, `ACCURACY_AT_LEAST`) and `threshold`.
- Seed the rows in a migration instead of the hand-run `scripts/seed_badges.py`. **Client examples, the first set: 500 questions completed, 30-day streak.** Suggested additions for the client to confirm: 100 / 1000 questions, 7-day streak, first test.
- Each milestone also awards XP, which feeds the leaderboard.
- `services/gamification_service.py`: add `check_milestones(user)`. Call it after each submission (`post_submission_pipeline`) and on daily activity.
- On award: create a `UserBadge` and an in-app notification, and show it on the dashboard/profile with a short celebration. Backfill existing users once.

### 4.2 User-scheduled weekly notification
- **Channel: email only** (client-confirmed). Preference: weekly on/off, day of week and time, stored per user (new `NotificationPreference` table) using `User.timezone`. Add a settings section on the profile.
- Scheduler: extend `services/daily_scheduler_service.py` from one daily run to an hourly check that sends to users whose slot falls in that hour. Keep the cache de-duplication so multiple workers don't double-send.
- Content: the weekly summary (questions solved, accuracy, streak, pending tasks, new badges), built from `/study-plan/weekly-insights` once Phase 0.2 has fixed it. Add an unsubscribe link in the email.

---

## Phase 5: full language support in the exam
**Launch languages: English, Hindi, Marathi** (client-confirmed). Questions are already fully translated into all three. The remaining work is explanations, option analysis and exam screen labels. Other languages stay best-effort, falling back to English.

- **Content:**
  - Extend the existing translation job (`tasks/translation_tasks.py`, `reconcile_missing_translations_task`) to translate explanations (`QuestionExplanation`) and option distractor analysis, as well as questions.
  - Backfill Hindi and Marathi explanations and option analysis for all published questions.
  - Admin view: translation coverage per language.
- **Exam screen labels:** add a small i18n dictionary for the exam screens only (`ExamEnginePage`, `ExamQuestionCard`, `ExamFooterBar`, palette, submit dialog, timer, solution card headings), driven by the selected exam language with English fallback. No app-wide i18n framework yet.
- **Fallback rule:** if a question isn't translated, show English with a small "not available in <language>" note, never a blank.
- **Explanations in every view:** Phase 1 made `GET /questions/{id}/solution` pick the explanation by language. The in-exam reveal (`ExamSessionService.reveal_answer`), `GET /exams/{id}/solution-db/{n}` and the post-test report (`post_submission_pipeline`) still take the first explanation row; pass the attempt's language through and reuse the same preference (requested → English → any).

---

## Backlog: not discussed with the client (raise on the next call)
- Notes per question (`QuestionBookmark.notes` already exists).
- "Reserve for round 2" action.
- Real "questions today", streak and daily goal on the dashboard.
- Mistake notebook, frequently wrong questions, revision practice from bookmarked or wrong questions (`AttemptMode.REVISION` exists).
- Speed and negative-marking trend charts.
- Mock-test series.
- SEO question pages.
- Full-text question search for the home bar.
- Explanation extras (trend, sources, books).

## Out of scope (client-confirmed)
- Option elimination: the client confirmed it already exists; no work.
- Phone login, a separate Chapter level (Chapter = Subtopic), optional subject.

## On hold (client)
AI mistake analysis, NOT/INCORRECT keyword detection, AI study recommendation, AI Mentor chat / chatbot, flashcards, §21 future AI.

---

## Open questions for the client
1. **XP values per action** (they decide leaderboard ranks). Proposal: correct answer +10, test completed +50, streak day +20, milestone +100.

**Defaults we'll use unless the client objects:**
- The free-plan limit resets at midnight IST.
- The leaderboard is per the user's target exam.
- The weekly email contains questions solved, accuracy, streak, pending tasks and new badges.
- Only exam screen labels are translated; the rest of the app stays English for now.

## Verification (per phase)
- **Backend:** `pytest` for each new endpoint and rule. For example: the 21st question of the day is refused for FREE and allowed for PREMIUM; leaderboard ranks and state filter; milestone awarded once at the threshold; weekly send fires once per slot; explanation returned in the requested language.
- **Browser** (Playwright, using the run-app skill's JWT login): FREE and PREMIUM students, at desktop and 390 px.
- **Payments:** a full Cashfree sandbox payment, including the webhook, before Phase 2 ships.
- **Before each commit:** GitNexus `detect_changes`, with the risk explained in the PR.
