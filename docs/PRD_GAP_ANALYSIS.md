# PRD Gap Analysis: what's built, what's partial, what's missing

**Source:** client PRD "Exam planner (2).docx" (21 sections + USP + home search bar)
**Checked against:** `release/0.0.1` and the unmerged branches, 16 Oct 2026
**Status:** reviewed with the client; decisions recorded in §0 (16 Oct 2026). Progress, what's merged and what's left are in the status update below (19 Oct 2026). Second-round answers recorded 16 Oct 2026. Implementation plan: [PRD_IMPLEMENTATION_PLAN.md](PRD_IMPLEMENTATION_PLAN.md)

## Context
The PRD has 21 sections plus the USP and a home search bar. Every requirement was checked against the code and marked **Done / Partial / Missing**. Features that **look built but run on hard-coded or made-up data** are flagged separately, because they are the bigger risk: a demo would show numbers that aren't real. The sections from §1 on are the original analysis (16 Oct) and describe the code before this work; the status update above says what has changed since.

Legend: ✅ Done · 🟡 Partial · ❌ Missing · ⚠️ looks done but uses hard-coded or fake data

---

## Status update (19 Oct 2026)
For the next client call. Details per item are in [PRD_IMPLEMENTATION_PLAN.md](PRD_IMPLEMENTATION_PLAN.md).

**Everything below is merged into `release/0.0.1`**, except online payments (Cashfree), which is on hold.

### Built and merged
| Area | What students and admins get |
|---|---|
| Real numbers only | Made-up insights, ranks, benchmarks and search results removed or replaced with real data |
| Target exam / year | Editable on the profile |
| Difficulty analysis | Easy / Medium / Hard breakdown in the report, difficulty filter for subject-wise tests |
| Free plan | 20 questions a day across tests and practice; score, answers and explanations free; analysis locked |
| Existing students | Pro free for 3 months from the deploy; new students start on the free plan. Pro ends automatically on its end date |
| Leaderboards | Daily national and state ranks per exam from real XP and correct answers; username or real name |
| Milestones | Admin-managed (create, edit, switch off); 500 questions and 30-day streak on |
| Weekly email | Student picks day and time; one-click unsubscribe |
| Exam language | English by default; Hindi or Marathi chosen before a test or practice and kept for the session |
| Explanations in Hindi / Marathi | Translated automatically after upload and nightly (needs working translation credentials in production) |
| Translation coverage | Admin view per paper and language, with "translate missing" |
| Exam screen labels | Buttons, timer, palette, dialogs and solution headings in Hindi and Marathi |
| Marking scheme | Asked for when an exam is uploaded and editable later from the QA screen; used for scores and reports. A change applies to new tests only |
| Practise bookmarks | "Practise these" on the Bookmarks page: an untimed session of bookmarked questions |
| Speed and negative-marking trends | Two charts on the Analytics page, one point per test |
| Revision reminders | "N questions due for revision today" on the dashboard, a revision practice session and a 7 AM in-app reminder, from the spaced-repetition dates |
| PYQs | "Same theme in other years" in the post-test review; paper-set filter for year-wise and subject-wise PYQs |
| Study plan | Built from the student's own results (revision due, weak topics, new topics, a Sunday test) within their weekly hours; new Month plan with a revision-and-full-papers last week |
| Super admin | Revenue & Engagement tab |
| Pricing page | No fake checkout: "Online payment coming soon"; free plan described correctly |
| Mistake notebook (Pro) | Every question answered wrong in tests and practice, most-missed first; "Missed 2+ times" tab, subject filter, practise from the list. A question leaves the list once the student gets it right. Free students see a locked card |
| Question search | The header search bar is back and finds question text (English, Hindi, Marathi), plus papers and topics. Clicking a question opens practice on all the matches |
| Reminders and notification settings | New Notifications tab on the profile: each reminder can be turned off. New in-app reminders: weakest topic (Mondays), new current affairs (evenings), a full past paper not yet taken (weekly, on the student's chosen day). The weekly email settings moved here |
| Streak in the header | The current streak shows next to the notification bell |
| Challenges | More than one exam can be picked when creating a challenge |
| Fixes | Pro students no longer see "Upgrade to PRO" in the sidebar. Questions in an MPSC paper are tagged MPSC, not "UPSC CSE" |

### Needs the client
1. **MPSC and BPSC marking schemes.** Set them from the "Marking" control on each exam's QA screen. Until then those papers score like UPSC.
2. **Online payments.** On hold on our side; Pro is granted by an admin until then. Going live needs Cashfree production keys and the webhooks set up in the Cashfree dashboard.
3. **Translation credentials** for production (Google Cloud Translation or Vertex), so explanations get translated.
4. **An exam type on every paper.** Challenges only offer exams whose papers have an exam type set, so check that the MPSC and BPSC papers have one (in the dev data, the MPSC paper has none).

Hindi and Marathi wording needs no separate review: the person approving each question checks it (client decision, 18 Oct).

### Still open: to prioritise with the client
| # | Item | Notes |
|---|---|---|
| 1 | Notes per question | The database column exists; needs an editor on bookmarks and the question card |
| 2 | Dashboard: real "questions today", streak card, daily goal | The counts already exist; the streak now shows in the header |
| 3 | "Reserve for round 2" action | Round tracking already exists; needs a button and a round-2 pass |
| 4 | Mock-test series | The admin "Mock tests" screen still shows sample data; there's no real series. Mock-test reminders wait on this (a weekly full-paper reminder covers it for now) |
| 5 | SEO question pages | The marketing site has exam and current-affairs pages only |
| 6 | Improvement tracker | Per-topic improvement %, revision count, last revised date; a consistency score |
| 7 | Push notifications | Reminders go to the in-app bell and email; browser push isn't built |
| 8 | Social | Friends ranking, platform daily/weekly challenges, public or private profile |
| 9 | Explanation extras | UPSC trend, possible future questions, sources and books |
| 10 | Practice page's own filter bar and the "similar questions" panel in Hindi/Marathi | Exam screen labels are done; these two aren't |

The AI items stay on hold.

---

## 0. Client review: decisions (16 Oct 2026)
These override the PRD wherever they differ.

| Area | Client decision | Effect on scope |
|---|---|---|
| Leaderboard | Needed for **every state and national**, per exam. **Rank recalculated daily** from **correct questions solved + XP collected** | ✅ In scope. Needs a `state` on the profile, a real cross-user ranking, and real XP awards |
| Name on leaderboard | Let the user choose to show their **username or real name**. Username **can be changed later if available** | ✅ In scope. Needs a unique username and a display preference |
| Difficulty analysis | Add it | ✅ In scope (§4) |
| Full language support | The **whole exam** should work in the chosen language. Launch languages: **English, Hindi, Marathi** | ✅ In scope. See the language findings below |
| Weekly notification | Let the user **schedule a weekly notification**, sent by **email** | ✅ In scope (§19) |
| Milestones | Award badges at milestones, e.g. **500 questions completed**, **30-day streak** | ✅ In scope (§16) |
| Free plan | **20 questions per day; no summary or analysis.** Free users **still see their score, the correct answers and explanations** | ✅ In scope. Replaces the PRD's "one-time analysis for 50 questions" |
| Target exam / year | **Can be changed later** | ✅ In scope. Today both are locked after onboarding |
| Eliminate options | Client confirmed it **already exists** | **No work planned** |
| Phone login | Not required | Dropped |
| Chapter filter | Chapter = our Subtopic level | Dropped as a separate level. Optionally relabel Subtopic as "Chapter" in the UI |
| Optional subject | Removed intentionally | Dropped |
| AI mistake analysis (conceptual/factual/confusion) | **On hold** | Deferred |
| Misses NOT / INCORRECT / ONLY keywords | **On hold** | Deferred |
| AI study recommendation | **On hold** | Deferred |
| AI Mentor chat / AI chatbot | **On hold** ("we can add later") | Deferred |
| Flashcards | **On hold** | Deferred |
| §21 Future AI | **On hold** | Deferred |

### Second-round answers (16 Oct 2026)
| # | Question | Answer |
|---|---|---|
| 1 | Option elimination | Already there; don't implement |
| 2 | Leaderboard ranking | Recalculated daily, by correct questions solved + XP collected |
| 3 | Free users see score / correct answers? | Yes. Only the summary and analysis are blocked |
| 4 | Languages complete at launch | English, Hindi, Marathi |
| 5 | Weekly notification channel | Email |
| 6 | Milestone thresholds | e.g. 500 questions completed, 30-day streak |
| 7 | Username changeable? | Yes, if the new one is available |

**Not discussed in the call (still open):**
- Fake and hard-coded data (§1.3) and the simulated payment (§1.1). These need fixing whatever the client decides.
- Notes per question, "reserve for round 2", dashboard items, the revision system (mistake notebook, practice from bookmarked or wrong questions), mock-test series, SEO question pages, home search, and explanation extras.

### Language support today (found after the call)
- **Questions:** all 466 published questions are translated into English, Hindi and Marathi. The other ~20 languages have about 18 questions each.
- **Explanations:** stored per language, but **only English exists**.
- **Bug:** `GET /questions/{id}/solution` joins explanations without filtering by language, so the language parameter is ignored. With more than one language stored, it would return an arbitrary one.
- **Exam screen labels** (Next, Mark for review, Submit, palette, timer) aren't translated. The frontend has no i18n layer.

---

## 1. Headline findings
1. **⚠️ Payment is simulated.** `PricingPage.handleCompletePayment` waits 1.8 s, then writes `subscription_tier: 'PREMIUM'` into **localStorage**. No API call is made. Real Cashfree code exists only on the **unmerged** branch `origin/pankajpandey/payment-gateway-integration` (about 6.8k lines). It has never been run against the Cashfree sandbox.
2. **❌ The free tier isn't enforced.** The PRD says free users get limited PYQs and one-time analysis of 50 questions. The only server-side tier gate is the 5-challenge cap (`require_challenge_quota`, `core/deps.py`). Everything else, including AI analysis, is free and unlimited.
3. **⚠️ Several numbers students see are invented.**
   - `DashboardPage.tsx:206`: "Smart Insight: polity accuracy up 12%" is a fixed string.
   - The "Deep Behavioral Insights" card (`DashboardPage.tsx` ~504–558) has fixed numbers: 68%, 22%, "12 times", "Avg 4s".
   - `/analytics/monthly-benchmark`: past months are made up (`current − month_diff×3.5`), the period is fixed to `"August 2026"`, and the national averages and `active_aspirants=24000` are fixed.
   - `/analytics/predicted-rank`: a fixed UPSC curve with `total_candidates=500000`, and it returns 75.0 when the student has no attempts.
   - `/study-plan/weekly-insights`: accuracy defaults to 78, and the focus text is fixed.
   - `POST /study-plan/generate-weekly-plan` is labelled "AI" but is a **fixed UPSC 7-day template** that uses no student data.
   - The header search shows fake results when the API fails (`StudentTopHeader.tsx` ~187–200).
   - The admin `MockTestsView.tsx` is local state only, with no API. `MockSelectionPage` hard-codes `progressPercent = 65` and `totalQuestions: 100`.
   - The dead pages `SignUpPage.tsx` and `SignInPage.tsx` (not routed) contain a fake Google sign-up using a hard-coded email and password.
4. **❌ AI Mentor chat (§11) doesn't exist**, apart from wording on the landing page.
5. **What is solid:** the post-test pipeline. It does real maths on the student's answers, and Gemini writes the summary, with a rule-based fallback. Also solid: subject and topic accuracy, the round-1/round-2 tracking, the option-switch and guessing metrics, the explanations, bookmarks, reporting a question, the timer, the admin upload and review flow, user management, and the study streak.

---

## 2. Section by section

### §1 Authentication
| Item | Status | Notes |
|---|---|---|
| Email sign-up/login | ✅ | `AuthModal` → `/auth/register`, `/auth/login` |
| Google | ✅ | Clerk Google only → `/auth/clerk-exchange` |
| Phone | ❌ | No OTP flow; phone is just a profile field |
| Forgot password | ✅ | Real email reset |
| Target exam / year | ✅ | Locked after onboarding (needs client confirmation) |
| Preferred language | ✅ | |
| Optional subject | 🟡 | The DB field exists, but it was removed from onboarding (#35), so new users can't set it |
| Nickname for public ranking | ❌ | No field anywhere |

### §2 Dashboard
| Item | Status | Notes |
|---|---|---|
| Questions solved today | 🟡 | Counts only manually logged activity. `/auth/me.today_questions_attempted` (which includes exams) is ignored |
| Accuracy % | ✅ | |
| Current streak | 🟡 | Calculated, but shown only on the Profile page, not the dashboard |
| Time spent studying | ✅ | Weekly hours chart |
| Strong / weak subjects | 🟡 | A subject accuracy chart only. No strong/weak lists. The subject list is a fixed UPSC list |
| AI recommendation | ⚠️ | Fixed string, plus the fixed behaviour card |
| Daily study goal | ❌ | |
| Weekly progress graph | ✅ | |
| Monthly performance graph | ⚠️ | Made-up past months. Not on the dashboard |

### §3 PYQ practice
| Item | Status | Notes |
|---|---|---|
| Exam / Year / Subject / Topic filters | ✅ | |
| Chapter | ❌ | The syllabus goes Subject → Topic → Subtopic only. Could subtopic count as "chapter"? (question for the client) |
| Difficulty filter | 🟡 | The API supports it; the PYQ screen has no control |
| Paper / set filter | 🟡 | Single paper in year-wise mode; no set filter in the UI |
| Language | ✅ | A display switch |
| MCQ, timer, show answers, bookmark, report | ✅ | |
| Same theme across years | ✅/🟡 | `/questions/{id}/similar`. Not shown inside the timed exam screen, and not limited to *other* years |
| Reserve for round 2 | 🟡 | "Mark for review" plus automatic round tracking. No explicit "round 2" action or flow |
| Eliminate options | Client-confirmed | Out of scope; no work planned |
| Notes per question | ❌ | `QuestionBookmark.notes` column exists but no API or UI uses it |

### §4 Post-test analysis
| Item | Status | Notes |
|---|---|---|
| Score, accuracy, speed | ✅ | Marking is hard-coded at +2 / −0.6667, ignoring each exam's scheme |
| Percentile | 🟡 | Estimated from the student's own ability score on a normal curve; not compared with other students |
| Leaderboard rank | ❌ | Leaderboards exist only for challenges |
| Preparation level | ✅ | Rule-based readiness tier; the cut-off is fixed at UPSC 92 |
| Subject-wise / topic-wise | ✅ | |
| Difficulty analysis (Easy/Med/Hard) | ❌ | Not aggregated anywhere |
| Priority subject | 🟡 | Lists topics under 65% accuracy; no ranking |
| Time / round analysis | 🟡 | Rounds, average time and per-question flags exist. No fastest/slowest lists and no overthought/too-quick counts |
| AI mistake analysis | 🟡 | Guessing, elimination, switching and negative marks are covered. **No split into conceptual / factual / confused-similar-concepts mistakes** |

### §5 AI self-assessment sheet
| Item | Status | Notes |
|---|---|---|
| Generated after every test, strengths / weaknesses | ✅ | Gemini or rule-based. ⚠️ When no AI output exists, placeholder bullets appear (`PsychometricReportView` ~2330) |
| Changes correct answers, guessing | ✅ | |
| Rushes easy questions / too long on hard ones | ❌ | Needs difficulty × time |
| Misses NOT / INCORRECT / ONLY keywords | ❌ | Questions aren't tagged by negative wording |

### §6 AI study recommendation: 🟡
Time and priority are there. The actions are templates ("Practice 15 MCQs on {topic}"). There's no catalogue of books or chapters to recommend from.

### §7 Personalized study plan: 🟡 / ⚠️
Today's view and the weekly board exist, but the plan is the fixed template. **Monthly ❌.** The revision schedule is calculated (FSRS spaced repetition) but **never turned into tasks**. PYQ and mock schedules are static.

### §8 Weakness tracker: 🟡
Weak topics and mastery level ✅. Improvement %, revision count and last-revision date ❌ (the data partly exists but isn't shown). **There is no tracker page.**

### §9 Strength tracker: 🟡
Strong topics ✅. Confidence level is whole-exam only. Retention is mostly a formula on accuracy. **Consistency score ❌.**

### §10 Performance analytics: 🟡 / ⚠️
Accuracy trend ✅. Daily and monthly graphs are fake or per-exam. Subject and topic improvement, speed trend and negative-marking trend ❌ (the data exists per attempt but isn't charted).

### §11 AI Mentor chat: ❌ entirely
Needs an API, context from the student's reports, profile and plan, conversation storage, and a UI.

### §12 Question explanation
Correct answer, detailed explanation, why the other options are wrong, related PYQs and key facts are ✅. **UPSC trend, possible future questions, sources and books to read are ❌** (no data fields; these need AI generation or content work).

### §13 Revision system
| Item | Status |
|---|---|
| Bookmark | ✅ (just shipped: details accordion, pagination, exam/year tags) |
| Flashcards | ❌ |
| Revision reminders | 🟡 (daily task email only; spaced-repetition due dates unused) |
| Mistake notebook / frequently wrong questions | ❌ |
| Revision calendar | 🟡 (planner revision tasks only) |
| Practice session from bookmarked or wrong questions | ❌ (`AttemptMode.REVISION` exists in the backend but is never started) |

### §14 Mock tests
| Item | Status |
|---|---|
| Topic / subject tests | ✅ (one subject or topic per server-side test) |
| Previous-year papers | ✅ |
| Timed tests | ✅ |
| Full-length mock series | 🟡 / ⚠️ (no real mock series; the admin mock screen is fake) |
| Custom test (several subjects/topics + count) | 🟡 (spread across 3 flows; none does all of it) |
| Untimed practice | 🟡 (browser-only; results reach the server only at the next login) |

### §15 Leaderboard
National rank ⚠️ (simulated). State rank ❌ (no state field). Friends rank ❌ (no friends model). Daily / weekly challenge ❌ (only user-created challenges).

### §16 Gamification
| Item | Status |
|---|---|
| Streak, levels | ✅ |
| XP | 🟡 (only the daily goal awards XP; the shown XP is mostly questions × 10) |
| Badges / achievements | 🟡 (seeded by hand, rarely checked) |
| Milestones | ❌ |
| Public / private profile | ❌ |

### §17 Admin panel
| Item | Status |
|---|---|
| Upload, edit questions, add explanations, manage users, analytics | ✅ |
| Manage subscriptions | 🟡 (plans and grants ✅; payments admin only on the unmerged branch) |
| Reports | 🟡 (reported questions and audit logs; no revenue or engagement reports) |

### §18 Subscription
| Item | Status |
|---|---|
| Plans exist (Free ₹0, Pro ₹1499/month), admin-editable | ✅ |
| Payment | ⚠️ simulated |
| Free limits (PYQs, 50-question analysis) | ❌ not enforced |
| Premium features | Nothing gated |
| AI mentor (premium feature) | ❌ doesn't exist |
| Priority support | ❌ |
| Pricing page | ⚠️ promises features that don't exist |

### §19 Notifications
| Item | Status |
|---|---|
| Daily reminder (in-app + email, only when tasks are pending) | ✅ |
| Revision, weak-topic, current-affairs, mock-test reminders | ❌ |
| Streak reminder | 🟡 |
| Push notifications | ❌ |
| Notification preferences / opt-out | ❌ |
| Scheduler | Runs inside the API process (`start_daily_midnight_scheduler`); with several workers it relies on cache de-duplication |

### §20 SEO: question pages are ❌
The Astro marketing site has exam and current-affairs pages, a sitemap and Organization JSON-LD. There are **no public, indexable question pages**, no question sitemap and no QAPage/Quiz schema. `robots.txt` blocks the exam routes.

### §21 Future AI
| Item | Status |
|---|---|
| Exam simulation with insights | ✅ |
| Readiness estimate | 🟡 (heuristic, falls back to hard-coded defaults) |
| Knowledge vs strategy vs time mistakes | 🟡 (signals exist, no per-mistake label) |
| Personalised weak-area mocks | 🟡 (browser-only) |
| Spaced repetition | 🟡 (computed, never scheduled) |
| Topic prediction from PYQ trends | ❌ |

### USP: "lost 14 marks to conceptual gaps in Economy…": 🟡 fragments only
There are pieces: negative marks, "guessing cost X marks", marks lost on "sure but wrong" answers, and marks left on easy questions. **No report attributes marks lost by cause and topic or gives a projected score gain.** This is the PRD's stated differentiator.

### Home search bar: 🟡
The landing-page search matches only syllabus names, falls back to a static list, and sends everyone to a hard-coded "UPSC CSE" guest exam. The logged-in `/search` covers exams and topics but not subjects or **question text**, and topic results link to the planner, not to questions.

---

## 3. Recommended order of work

**P0: trust and launch blockers (fix before any client or student demo)**
1. Merge and test the Cashfree branch. Remove the localStorage "payment".
2. Enforce free-tier limits on the server (one-time 50-question analysis, PYQ cap). Reuse `require_challenge_quota` in `core/deps.py` and the `EntitlementService`/`require_feature` from the payment branch.
3. Remove or replace every ⚠️ fake number from §1.3 with real queries, or hide the widget. Delete the dead `SignUpPage.tsx` and `SignInPage.tsx`.
4. Make the Pricing page list only features that exist.

**P1: cheap PRD wins (mostly frontend; the data already exists)**
- Per-question notes (the `QuestionBookmark.notes` column already exists); an explicit "reserve for round 2" action.
- Dashboard: real "questions today" (`today_questions_attempted`), streak card, strong/weak lists, daily goal.
- Difficulty analysis in the report (Easy/Med/Hard attempted and accuracy); fastest/slowest and overthought/too-quick lists.
- Revision practice from bookmarked or wrong questions (wire up `AttemptMode.REVISION`); mistake notebook and frequently-wrong list.
- Speed and negative-marking trend charts (data is already stored per attempt); difficulty filter on the PYQ screen.

**P2: the larger features that make the product**
- **USP report:** marks lost by cause and topic, plus projected gain (needs per-mistake classification: conceptual / factual / reading-keyword / guessing / time).
- **AI Mentor chat** (premium).
- A real study plan generator from weakness and spaced-repetition data (replacing the template); monthly plan; revision schedule turned into tasks.
- Weakness and strength tracker page (improvement %, revision count, last revision, consistency).
- Nickname, state field, real cross-user leaderboard and percentile; daily and weekly platform challenges.
- Notifications: revision, weak-topic and mock reminders driven by spaced-repetition due dates; preferences; push.
- SEO: public question pages in Astro, question sitemap, QAPage schema; full-text question search for the home bar.

**P3: content and future AI**
- Explanation extras (trend, future questions, sources, books), flashcards, topic prediction, real mock-test series and admin, phone OTP login, public/private profile, milestones.

## 4. Questions for the client (answered 16 Oct 2026)
- Phone login: **not required.**
- "Chapter" = Subtopic: **yes, same level.**
- Optional subject back in onboarding: **no, removed intentionally.**
- Target exam/year locked: **no, they can be changed later.**
- Free-tier limits: **20 questions per day, no summary or analysis.**

The priority order in §3 is superseded by the phased plan in [PRD_IMPLEMENTATION_PLAN.md](PRD_IMPLEMENTATION_PLAN.md).

## 5. How this was checked
- I traced each item through the frontend page, the API route, and the service or database model. Hard-coded values were confirmed by reading the code.
- I verified these myself: the simulated payment (`PricingPage.tsx:60`), that the payment branch isn't merged, and the challenge cap (`core/deps.py:646`).
- Next step once the client confirms: turn the P0 list into tickets or branches and implement them one at a time, each tested end to end (UI + API).
