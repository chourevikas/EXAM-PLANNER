# PRD Implementation Plan

**Based on:** [PRD_GAP_ANALYSIS.md](PRD_GAP_ANALYSIS.md) and the client decisions recorded there in §0, including the second-round answers (16 Oct 2026)
**Branch base:** `release/0.0.1`. One feature branch and PR per workstream (`pankajpandey/<topic>`).
**Status (19 Oct 2026):** Phases 0.2 to 7 are built and merged into `release/0.0.1` (up to PR #62). Only 0.1 (Cashfree payments) is not merged. What's left is under [What's left](#whats-left).
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

### 0.1 Merge real payments ⏸ on hold (our decision, 17 Oct)
Until it lands, the pricing page shows "Online payment coming soon" instead of the simulated checkout, and admins grant Pro by hand.

- Merge `origin/pankajpandey/payment-gateway-integration` into `release/0.0.1`.
  - It brings `routers/payments.py`, `services/entitlement_service.py`, `require_feature` in `core/deps.py`, `routers/entitlements.py`, `FeatureUsageEvent` and migrations `056`/`060`/`061`.
- **Migration chain:** `release/0.0.1` now has migrations up to `069_reminders_and_question_search`. Add a merge revision (or re-parent the branch's migrations) onto that head. Check each file's `revision` string, not its filename (see the run-app skill).
- Delete the localStorage "payment" in `apps/frontend/src/pages/PricingPage.tsx` (`handleCompletePayment`) and use the branch's checkout flow.
- Run the whole flow against the **Cashfree sandbox** before release: order → pay → webhook → subscription active → receipt. Production go-live (keys, domain whitelist, dashboard webhooks including `DISPUTE_*`) stays a separate ops task.

### 0.2 Remove made-up numbers ✅ built (one item left)
Replace each with a real query, or hide the widget until real data exists:

| Where | Fix |
|---|---|
| `DashboardPage.tsx:206` "polity accuracy up 12%" | Real week-on-week subject delta from `/analytics/subject-performance`, or hide |
| `DashboardPage.tsx` "Deep Behavioral Insights" card (~504–558) | Fill it from the latest attempt report, or hide |
| `analytics_service.get_monthly_benchmark` | Real monthly series from attempts. Remove the generated `−3.5`/month history, the fixed `"August 2026"` and the static national averages |
| `analytics_service.get_predicted_rank` | Replace it with the real rank from Phase 3, and show "not enough data" when there are no attempts (instead of 75.0) |
| `/study-plan/weekly-insights` | Remove the default `avg_accuracy=78` and the fixed focus text |
| `POST /study-plan/generate-weekly-plan` | Superseded: the plan is now built from the student's data (6.7) |
| `StudentTopHeader.tsx` fake search results on error | Show an error/empty state |
| Admin `MockTestsView.tsx`, `MockSelectionPage` `progressPercent=65` | Progress is computed for real. **Still open:** the admin Mock tests screen shows hard-coded sample tests; hide it or build a real mock series |
| Dead `pages/SignUpPage.tsx`, `pages/SignInPage.tsx` (fake Google account) | Delete |
| `PricingPage` feature list | List only features that exist |

---

## Phase 1: quick client items ✅ built

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

## Phase 5: full language support in the exam ✅ built
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
- **Wording review:** no separate native-speaker review; the person approving each question checks it (client decision, 18 Oct).
- **Not translated yet:**
  - the practice page's own filter bar and the "similar questions" side panel;
  - per-option distractor labels that come from the backend (e.g. "High-Closeness Distractor").

---

## Phase 6: client round 3 (18 Oct) ✅ built
Client answers (18 Oct):
- every exam gets its own marking scheme, used everywhere including reports;
- no native-speaker review;
- existing students get Pro, new students start free.

They also asked for the items below.

### 6.1 Marking scheme per exam
- **Upload:** the exam upload asks for marks per question and negative marks per wrong answer, prefilled from the exam type and validated.
- **Editing:** an admin can change the scheme from the QA review screen header.
- **Scoring:** the scheme comes from the exam, then its exam type, then UPSC (+2 / −2/3). A change applies to **new tests only**; tests already taken keep their scores.
- **Migration** `067_exam_marking_scheme` fills existing exams from their questions' marks.
- **Still to do:** set the MPSC and BPSC schemes from the QA screen.

### 6.2 Existing students get Pro for 3 months
- **Migration** `068_existing_students_pro` gives every existing student without an active subscription a 90-day Pro subscription (source `PROMO`), starting when the migration runs, i.e. at deploy.
- **Expiry:** a daily job expires subscriptions on their end date, moves the student back to the free plan and sends an in-app notice.
- **Pricing page:** shows "You're on Pro until <date>".

### 6.3 Practise bookmarked questions
"Practise these" on the Bookmarks page: an untimed practice session of bookmarked questions (`GET /users/me/bookmarks/practice`, `/practice-exam?source=bookmarks`).

### 6.4 Speed and negative-marking trends
Two charts on the Analytics page, one point per completed test: seconds per question and marks lost to wrong answers, with a recent-vs-earlier summary. Locked on the free plan.

### 6.5 Revision reminders
The spaced-repetition dates the pipeline already calculated now reach the student:
- a dashboard card ("N questions are due for revision today");
- a revision practice session, most overdue first;
- a 7 AM IST in-app reminder, once a day.

Answering in practice reschedules the question.

### 6.6 PYQs: same theme in other years, paper-set filter
- **Same theme in other years:** shown in the post-test review (client choice: after submitting, not during the timed exam); other years only, each labelled with its year.
- **Paper-set filter:** for year-wise PYQs and the subject-wise builder.

### 6.7 Study plan from the student's data, and a month plan
The fixed UPSC template is gone.
- **Daily time:** the student's weekly hours ÷ 7, or 2 hours if they didn't answer.
- **Each day, in order:**
  1. revision due that day;
  2. weak subtopics (below 60%), with the reason;
  3. untried subtopics with the most questions;
  4. a test on Sunday.
- **Month plan:** a new tab with a calendar. The last week is consolidation: no new topics, revision, and full papers on Wednesday and Sunday.
- **Rebuilding** replaces only open generated tasks. The student's own tasks and completed tasks stay.
- Rule-based: the AI study recommendation stays on hold.

### 6.8 Super admin: Revenue & Engagement
A new tab in the super admin app (`apps/superadmin`) with:
- revenue, MRR and Pro students by source;
- active students, questions and tests over 7 days to 12 months.

---

## Phase 7: revision, search and reminders (19 Oct) ✅ built
Items from the "not built yet" list, plus fixes from client testing.

### 7.1 Mistake notebook (Pro)
- **Page:** `/mistakes`, in the sidebar. Every question answered wrong in submitted tests and in practice, merged per question: times wrong, last wrong date, most-missed first.
- **Filters:** "All" and "Missed 2+ times" tabs, a subject filter, "Show fixed ones". A question is fixed, and leaves the list, once the student's latest answer is right. Blank answers and tests still in progress don't count.
- **Practice:** `GET /users/me/mistakes/practice`, `/practice-exam?source=mistakes` (`&view=frequent` for 2+ misses).
- **Free plan:** a locked card; the API answers 403.

### 7.2 Full-text question search
- **Header search bar** is back (a UI cleanup on 19 Sep had removed it from the screen). ⌘K/Ctrl+K on desktop; an icon that opens a bar on phones.
- **Questions group:** an excerpt, the exam and the year. Clicking one opens practice on all the matches, starting with that question (`/search/questions/practice`, `/practice-exam?source=search`).
- **Matching:** English uses a full-text index on question text (migration `069`), every word as a prefix, ranked. Hindi and Marathi use a substring match, because how Postgres splits Devanagari depends on the database locale.

### 7.3 Reminders and notification settings
- **Notifications tab** on the profile (`GET/PUT /notifications/settings`). Each reminder can be turned off: revision due, study plan tasks, weak topic, new current affairs, weekly full paper (with its day), the daily task email and the weekly summary email. The weekly email settings moved here from Exam Targets.
- **New in-app reminders**, from the hourly loop, each once per window:
  - weak topic: Mondays 8 AM IST, the lowest-accuracy subtopic over 30 days (below 60%, at least 5 answers), with a practice link;
  - new current affairs: 6 PM IST on days something was published;
  - weekly full paper: 9 AM IST on the student's chosen day, the newest full PYQ paper they haven't attempted. This stands in for mock-test reminders until the mock-test series exists.
- **Existing reminders** (revision, pending tasks, task email) follow the settings. Everything defaults to on.
- **Migration** `069_reminders_and_question_search` adds the settings columns and the search index; it skips anything that already exists.

### 7.4 Challenges across several exams
The Create Challenge form takes one or more exams (chips, like subjects and years); questions come from any of them, and the years and subjects on offer combine. API: `exam_type_ids`, with the single `exam_type_id` still accepted. No migration.

### 7.5 Fixes and small items
- The current streak shows in the header, next to the bell.
- Pro students no longer see "Upgrade to PRO" in the sidebar.
- Questions in a PYQ simulation are tagged with their own paper's exam and year: an MPSC paper showed "UPSC CSE" on every question.

## Phase 8: Study Planner v2, the client's planner (23 Oct) 🚧 in review
The client shared their planner (`examplanner-all-pages-opens-planner.html`, the Study Planner frame). It ran only in the browser and saved to localStorage. It is now built on the real stack, saved per account. It replaces the one-click week and month plan from 6.7: the student generates the plan from a form.

### 8.1 Planner syllabus (admin)
- **Planner exams:** UPSC Prelims, State PCS, CDS, UPSC Mains, and the optionals Geography, PSIR and Public Administration. Each has subjects → topics → subtopics, seeded from the client's file (350 subtopics).
- **Separate from the question bank:** these tables are not the paper `exams`. A planner subtopic can link to a question-bank subtopic, which drives its Practice button and the weak-topic data. Links are made by name on seeding and import; admins set the rest.
- **Admin screen:** Planner Syllabus, under the section permission `admin.planner_syllabus`. Admins can:
  - add, rename, hide, reorder and delete exams;
  - edit the tree;
  - bulk import, either as `Subject|Topic:sub,sub;Topic:sub` lines or as JSON, merging into or replacing the syllabus;
  - link subtopics to the question bank.
- **Migration:** `070_study_planner_v2`.

### 8.2 Generating a plan
- **Inputs:** exam, days (up to 365) or an exam date, subjects, days per subject, hours a day, mock day, rest day, a revision tail for the last ~12% of days, subjects per day, daily blocks (current affairs, 10 PYQs, the student's own task; answer writing for Mains-style exams), weak topics first, and auto catch-up.
- **Layout:** `services/planner_engine.py` is a port of the client's algorithm. It produced the same schedule as the client's JavaScript on 600 random cases.
- **Topics:** only subtopics the student hasn't covered. Revision questions due each day are added first.
- **Rebuilding** replaces only open generated tasks. The student's own tasks and completed tasks stay.

### 8.3 Following the plan
- **Aaj:** a week strip, the day's tasks, Practice, a 25-minute focus timer (logged as study time), Skip to the next day, and Delete.
- **Finishing a plan topic:** the subtopic is marked covered, and revisions are added at +1, +3, +7 and +21 days, plus +14 and +30 when accuracy on the subtopic is below 60%.
- **Catch up:** missed topics are spread over the next 5 days. Auto catch-up does this once a day.
- **My plan:** summary, subject bars and a day list. Clear the plan, download a PDF, add to calendar (`.ics`), and a share link that another student can import.

### 8.4 Progress, syllabus coverage and revision plan
- **Progress:** week or month view: % completed, tasks, hours studied, streak, focus minutes, a daily goal, a month calendar, a bar per subject, and weekly tips ("Is hafte ke tips").
- **Syllabus:** tick subtopics off for each exam, with % covered and a weekly target.
- **Revision plan:** subject strength and repeated mistakes from tests and practice, and a 7-day plan to add to the planner. A sample is shown until the student has results.

### 8.5 Free and Pro (defaults; client to confirm)
- **Free:** plans up to 7 days. Daily tasks, timer, catch-up, syllabus coverage and the progress tracker.
- **Pro:** longer plans, weak topics first, days per subject, PDF and calendar downloads, share links and the revision plan. The API answers 403 with code `PRO_STUDY_PLANNER`.

### 8.6 API
- **Student:** `/planner/*`:
  - exams, syllabus, coverage, settings;
  - estimate, generate, plan, overview, tasks, plan-tasks;
  - skip, reopen, catch-up, focus;
  - tracker, revision-plan, share.
- **Admin:** `/admin/planner/*`.
- **Unchanged:** completing a task is still `POST /study-plan/tasks/{id}/complete`.
- **Still in the API:** `/study-plan/generate-weekly-plan` and `/generate-monthly-plan` stay (their tests cover the month view and cache invalidation), but the app no longer calls them. Remove them in a cleanup.

---

## What's left
As of 19 Oct 2026, on `release/0.0.1`.

**Before or right after deploying**
- Check the production database is at migration `070` (Study Planner v2). The Cashfree merge revision now has to join onto `070`. The deploy runs `alembic upgrade head || true`, so a failed migration doesn't fail the deploy.
- Set the MPSC and BPSC marking schemes (6.1).
- Production translation credentials, so explanations get translated (5.2).
- An exam type on every paper (MPSC and BPSC included), so challenges can offer those exams (7.4).

**Payments (0.1, on hold)**
- Merge the Cashfree branch with an Alembic merge revision joining its `056`/`060`/`061` to `069`.
- Run a sandbox payment end to end.
- Go live with production keys and the dashboard webhooks (including `DISPUTE_*`).

**Study Planner v2 (Phase 8)**
- Client to confirm the free limits (8.5) and the State PCS syllabus (the seed is generic; an MPSC-specific one can be entered in Planner Syllabus).
- Admins to link the remaining planner subtopics to the question bank. Each paper has its own copy of the syllabus, so pick the active paper's copy.
- Remove the unused `/study-plan/generate-weekly-plan` and `/generate-monthly-plan` endpoints.

**Not built yet: to prioritise with the client**
- Notes per question (`QuestionBookmark.notes` exists, unused).
- "Reserve for round 2" action.
- Dashboard: real "questions today", streak card and daily goal (the streak now shows in the header).
- Mock-test series. The admin Mock tests screen still shows sample data (0.2). Mock-test reminders wait on this (7.3).
- SEO question pages (the marketing site has exam and current-affairs pages only).
- Improvement tracker: per-topic improvement %, revision count, last revised date; consistency score.
- Push notifications (reminders go to the in-app bell and email).
- Friends ranking, platform daily/weekly challenges, public or private profile.
- Explanation extras: UPSC trend, possible future questions, sources and books.
- Practice page filter bar and the "similar questions" panel in Hindi/Marathi (5.4).

## Out of scope (client-confirmed)
- Option elimination: the client confirmed it already exists; no work.
- Phone login, a separate Chapter level (Chapter = Subtopic), optional subject.

## On hold (client)
AI mistake analysis, NOT/INCORRECT keyword detection, AI study recommendation, AI Mentor chat / chatbot, flashcards, §21 future AI.

---

## Open questions for the client
None at the moment. Answered on 18 Oct:
- **Marking scheme:** set per exam at upload, editable later; changes apply to new tests only. The MPSC and BPSC values still need entering (6.1).
- **Hindi and Marathi wording:** no separate review; checked when each question is approved.
- **Existing students:** Pro for 3 months from the deploy; new students start free.

(XP values were approved on 17 Oct: correct +10, test +50, active day +20, milestone +100.)

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
