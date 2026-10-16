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

## Phase 2: free plan (20 questions a day, no summary or analysis)
Builds on Phase 0.1's `EntitlementService` / `require_feature` / `FeatureUsageEvent`.

- **Plan features:** add `QUESTIONS_PER_DAY` (FREE = 20, PREMIUM = unlimited) and `ATTEMPT_ANALYSIS` (FREE = off) to plan features (admin-editable in `PremiumAdmin`).
- **Counting:** count answered questions per user per IST day from `ExamQuestionResponse`. Enforce when a question is answered or revealed, and cap the question count at `POST /attempts/start` to what's left today.
- **Server-side only.** The client-only practice page (`StudentPracticeExamPage`, synced to the server only at the next login) must record answers on the server, or it bypasses the limit.
- **Analysis:** for FREE users, skip the Gemini step in `post_submission_pipeline`, which also saves LLM cost. Gate the report endpoints (`/analytics/reports/attempts/{id}/*`, aggregate report) with `ATTEMPT_ANALYSIS`. Free users **still see their score, the correct answers and the explanations**; only the summary and analysis pages are replaced by an upgrade card. The cheap maths still runs, so upgrading unlocks past reports.
- **UX:** show "X of 20 questions left today" in the exam header; when the limit is hit, show an upgrade modal (402/403 → paywall). After a test, free users get the score and answer review as today, with an "Unlock your full analysis" card where the report would be. The limit resets at midnight IST.
- **Guests:** keep the existing guest rate limit; the limit applies to signed-in FREE users.

---

## Phase 3: state and national leaderboards
- **Profile fields** (migration on `StudentProfile`):
  - `state` (a list of Indian states and UTs);
  - `username` (unique, 3–20 characters, `[a-z0-9_]`). It **can be changed later if the new one is available**: add a live check `GET /users/username-available?u=` and return 409 on a clash at save time;
  - `leaderboard_display` (`USERNAME` | `NAME`, default `USERNAME`).
- **Onboarding** asks for state. **Profile** edits state, username and the display choice. Existing users are prompted once.
- **API:** `GET /leaderboard?exam=<type code>&scope=national|state&state=<code>&page=…` (per the user's target exam by default). Rows show rank, the display name (by preference), score metric and attempts. Also return the caller's own rank, even when it's outside the page.
- **Ranking (client-confirmed):** points = **correct answers solved + XP collected**. Ties are broken by accuracy, then by whoever reached the score first. To appear, a user needs at least 1 correct answer.
- **Recalculated daily:** a nightly job in `services/daily_scheduler_service.py` writes a `LeaderboardSnapshot` (date, exam, state, user, points, rank). `GET /leaderboard` reads the latest snapshot, so ranks are fast and stable during the day. Show "updated daily" and the change in rank since yesterday (▲/▼). Reuse the pagination and caching patterns from the challenge leaderboard (`routers/challenges.py` `get_leaderboard`, `build_cache_key`).
- **Prerequisite: real XP.** Today `XPLog` is written only for the daily goal, and the XP shown is `max(questions × 10, stored)`. Add XP awards in `services/gamification_service.py` for completed tests, streak days and milestones, and stop showing the derived value. Otherwise "correct + XP" would count correct answers twice. The XP values need client sign-off (see open questions).
- **Frontend:** a `/leaderboard` page with National/State tabs and an exam selector, linked from the sidebar. Show "Your rank: #N of M" on the dashboard and in reports, replacing the simulated `predicted-rank`.

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
