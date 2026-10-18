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

## Phase 4: milestones and weekly notifications ✅ built

### 4.1 Milestones: dynamic, admin-managed (client request, 17 Oct)
- **Model:** `badges` rows with `criteria_type`, `threshold`, `xp_reward` (default 100) and `is_active`. Criteria: questions solved, correct answers, tests completed, days in a row, XP earned.
- **Admin:** a new **Milestones** section (permission `admin.milestones`) to create, edit and switch milestones on or off.
  - Saving an active milestone awards it in the background to students who already qualify.
  - A milestone someone has earned can't be deleted, only switched off.
- **Seeded by migration `064`:**
  - the client's two, active: **500 questions**, **30-day streak**;
  - suggested ones, **inactive**: first test, 100 and 1,000 questions, 7-day streak.
- **Awarding** (`milestone_service.check`): runs after each evaluated test and practice answer. The student gets the badge once, the XP (keyed `milestone:<id>`) and an in-app notification.
- **Student view:** the achievements dialog shows progress toward each active milestone, e.g. "Questions solved: 20 / 500 · +100 XP". Switched-off ones are hidden unless already earned.

### 4.2 Weekly summary email (client: email only)
- **Preferences:** on the profile's Exam Targets tab: on/off (**off by default**), day and time, in the student's timezone.
- **Sending:** an hourly job sends to students whose slot is now. Each student is claimed with one atomic database update, so it never sends twice, even with several workers.
- **Content:** the last 7 days: questions, accuracy, tests, XP, streak, new milestones and national rank.
- **Unsubscribe:** a signed one-click link (`GET /notifications/weekly-email/unsubscribe`) that works without signing in.

---

## Phase 5: full language support in the exam
**Launch languages: English, Hindi, Marathi** (client-confirmed). Questions are already fully translated into all three. The remaining work is explanations, option analysis and exam screen labels. Other languages stay best-effort, falling back to English.

### 5.1 Language chosen before the session, fixed for the whole session ✅ built
Client decision (17 Oct): English is the default for practice and exam simulation. A student who wants another language chooses it **before** starting, and every question in that session is in that language. Only English, Hindi and Marathi are offered.
- **Exam simulation (PYQ, mock, subject-wise):**
  - A new attempt opens a language picker first, with English preselected. A retake asks again.
  - The subject-wise builder has a "Test language" choice in its form.
  - The language is stored on the attempt (`exam_attempts.language`, migration 065), and questions are always served in it.
  - Opening an in-progress attempt resumes in its language without asking.
  - The header shows the language as a fixed label; the mid-test dropdown is gone.
- **Practice (signed-in and guest):** the picker shows before any questions load. The choice is kept in the URL (`?lang=`), so filter changes and reloads keep it.
- **Not tied to the profile any more:** the profile's preferred language no longer decides the exam language. The API rejects any language other than en/hi/mr (422).
- **Explanations:**
  - The in-exam reveal now uses the attempt's language: Hindi or Marathi, else English. Previously it took whichever explanation row came first.
  - Solutions in practice and the exam screen request the session language.
  - Hindi and Marathi explanations come from the translation added in 5.2; until a question has one, English shows.
- **Post-test report:** stays in English (client decision, 17 Oct).

### 5.2 Explanations translated into Hindi and Marathi ✅ built
- **Before:** explanations and option analyses existed in English only. The translation jobs covered question text, option text and passages; the only other source was a reviewer entering one by hand.
- **Now:** `services/explanation_translation_service.py` translates each English explanation (solution, core concept, common mistake, option-by-option reasoning, traps, takeaways) and each option's analysis into Hindi and Marathi. It runs:
  - after a paper's questions are translated (`QuestionTranslationService.translate_exam`, triggered automatically after import);
  - in the nightly translation job, which backfills everything still missing. The first night after deploy translates all existing explanations.
- **Safe by design:**
  - only missing rows are added; a reviewer's or admin's translation is never overwritten;
  - a failed translation saves nothing, so English shows and the next run retries;
  - the translator no longer caches a failed result as the translation for 30 days.
- **Readers fixed** so a new Hindi row never leaks into English views:
  - `solution-db`, the reviewer's question view and the question API fallback prefer English;
  - the post-test report stays English (client decision, 17 Oct).
- **Bug fixed:** `/questions/{id}/solution` used one option row for both text and analysis. A Hindi request lost the analysis whenever the Hindi option row had none; text and analysis are now chosen separately.
- **Production needs:** working Google Cloud Translation (or Vertex/Gemini) credentials. The dev credentials fail (`invalid_grant`), so dev was tested with a stand-in translator.

### 5.3 Admin view: translation coverage ✅ built
- New admin section **Translations** (permission `admin.translations`):
  - Hindi and Marathi progress bars for questions, options, explanations and option analyses. Explanations and analyses are measured against what exists in English.
  - A table of papers, most missing first, with each paper's last translation run (running %, complete, last run failed).
  - **Translate missing** for one paper, and **Translate all missing**, which runs the same backfill as the nightly job. Starting a second run while one is running is refused.
- An untranslated copy (Hindi/Marathi text still in English words) counts as missing. Numbers, sequences and formulas that legitimately stay the same count as translated.
- Migration 066 adds the `admin.translations` permission row, and the `admin.milestones` row that Phase 4 missed, so custom roles can be granted both.

### 5.4 Exam screen labels in Hindi and Marathi ✅ built
- **Translated:** the exam and practice screens' labels follow the session language: the timer, Submit, Full Screen, Prev/Next/Finish, Clear and Mark, "How sure?" with Sure/50-50/Guess, the question palette, the submit dialog, the question number and difficulty, Show/Hide Solution, and the solution card's headings ("Option (C) is correct", detailed explanation, option-by-option reasoning, traps).
- **How:** a small dictionary (`src/i18n/examText.tsx`) with English fallback. The exam, practice and guest pages provide the session language; screens outside them (the post-test report, bookmarks) stay English.
- **Fallback note:** a question with no Hindi/Marathi text (or only an English copy) shows "This question isn't available in Hindi yet, so it's shown in English."
- **The client should check the Hindi and Marathi wording** with a native speaker.
- **Not translated yet:**
  - the practice page's own filter bar and the "similar questions" side panel;
  - per-option distractor labels that come from the backend (e.g. "High-Closeness Distractor").

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
