# SEO Plan — ExamPlanner (rank for UPSC/NDA question & topic searches)

## Context

ExamPlanner (`apps/frontend` + `apps/backend`) currently has **zero SEO surface**: it's a pure client-side Vite/React SPA (`BrowserRouter`, no SSR), `index.html` ships one static `<title>` with no meta description/OG/canonical tags, and there is no `robots.txt` or `sitemap.xml` anywhere in the repo. Worse for the stated goal, there is **no crawlable, per-question URL** — question content only exists behind `/guest-exam?exam=...&topic=...` (query-param driven, not a stable link) or behind `ProtectedRoute`-gated pages like `/practice-exam` and `/exam/:examId` that require login.

The goal: when someone Googles a UPSC/NDA topic or question, ExamPlanner should rank and the click should land directly on a page where they can solve that question — no signup wall. The good news, confirmed by investigation: the backend already serves all question data unauthenticated (`GET /api/v1/questions`, `/questions/{id}`, `/questions/{id}/solution`, `/questions/taxonomy` have no auth `Depends`), and `GuestExamPage` already proves the no-login solve flow end-to-end. What's missing is (1) stable public URLs per question/topic, (2) a way for Google to actually see rendered content from an SPA, and (3) the on-page/technical SEO signals (meta, structured data, sitemap) that make those URLs rank. This plan closes all three gaps, plus lays out the content/keyword strategy to target UPSC/NDA search demand specifically.

**Decisions already made with the user:**
- Rendering fix: add a **prerendering layer** on top of the existing Vite/nginx/FastAPI stack (no Next.js migration).
- Public scope: **every question becomes solvable without login** via canonical URLs; login stays required only for saving progress, analytics, mocks, and other premium features (same pattern `/guest-exam` already uses).
- Plan covers both technical SEO engineering and content/keyword strategy.

This document is a reference plan for later implementation — no code has been changed yet.

---

## Part A — Technical SEO Implementation

### A1. New public URL structure

```
/practice                                                              → exam hub
/practice/:examSlug                                                    → subjects grid
/practice/:examSlug/:subjectSlug                                       → topics grid
/practice/:examSlug/:subjectSlug/:topicSlug                            → topic listing (paginated questions)
/practice/:examSlug/:subjectSlug/:topicSlug/:questionSlug-:questionId  → individual question page
```

- Slugs are computed from `exam_name`/`subject_name`/`topic_name` returned by `GET /api/v1/questions/taxonomy` — a new shared `slugify()` util on both sides (`apps/frontend/src/utils/slugify.ts`, `apps/backend/app/utils/slugify.py`). Don't rely on `Subject.code`/`Topic.code` — those default to `"DEFAULT"` in the DB today.
- Question URLs use the **slug-prefix + numeric-ID-suffix** pattern (like Stack Overflow): only the trailing `-<questionId>` is used to call `GET /api/v1/questions/{id}`. This sidesteps slug-uniqueness entirely since `question_id` is already a stable PK. If a stale slug prefix is hit, still render (200) and emit the *correct* canonical URL rather than redirecting.
- Slugs resolve to real names via the existing `ilike` substring filters already supported on `GET /questions`/`GET /questions/taxonomy` — no DB migration required for v1. (Optional hardening later: add a real unique `slug` column via Alembic migration if collisions ever surface.)
- **Keep `/guest-exam` as-is** (it's a genuinely different surface — ad-hoc multi-filter custom practice builder), but mark it `noindex` in `robots.txt`/meta robots since query-param URLs create infinite low-value crawl surface. Cross-link both directions: topic pages get a "Build a custom practice set →" CTA into `/guest-exam`; recommended questions inside `/guest-exam` can deep-link back to their canonical `/practice/...` URL.

New frontend pages (all `React.lazy`, added to `apps/frontend/src/App.tsx` **outside** `ProtectedRoute`, same placement as today's `/guest-exam` and `/challenge/:token` routes): `PracticeExamPage`, `PracticeSubjectPage`, `PracticeTopicPage`, `PracticeQuestionPage`.

### A2. Auth: public solving, gated saving

- No backend auth changes needed — the question endpoints are already open.
- New pages fetch data with plain `fetch()`, no token, exactly like `GuestExamPage.tsx` does today.
- Extend `apps/frontend/src/utils/guestStorage.ts` (currently only stores whole-attempt summaries) with **per-question** persistence — `saveGuestQuestionResponse(questionId, response)` under a new `guest_question_responses` key — so a guest's answer/reveal state on a canonical question page survives repeat visits.
- Every existing protected route (`/dashboard`, `/analytics`, `/mocks`, `/pyq`, `/bookmarks`, etc.) stays behind `ProtectedRoute` exactly as today — nothing there changes.
- Add a non-blocking login CTA on public pages (new `LoginPromptBanner` component), reusing the existing "sign up to save this attempt" pattern from `GuestScoreModal` in `GuestExamPage.tsx` — never a hard gate.
- **Trade-off to accept knowingly**: a sitemap turns the full question bank (including correct answers/solutions) from "discoverable if you know the URL" into "trivially bulk-crawlable." Mitigate with nginx `limit_req` rate limiting on `/practice/*` and `/api/v1/questions*` for non-whitelisted user agents.

### A3. Prerendering (so Google actually sees rendered content)

**Recommendation: self-hosted `prerender/prerender` headless-browser container**, not build-time static generation and not a paid third-party service — because question content is DB-backed and changes independently of deploys (new questions land via the admin pipeline, not git pushes), so a static snapshot baked at build time would go stale with no refresh trigger. Self-hosting also reuses infrastructure the project already runs (Docker Compose, Redis for caching rendered output).

- Add a `prerender` service to `docker-compose.prod.yml`/`docker-compose.yml` (stock image, no custom build needed initially).
- In `apps/frontend/nginx.conf`, add a `map $http_user_agent $prerender` block matching bot UAs (Googlebot, Bingbot, Slackbot, Twitterbot, facebookexternalhit, LinkedInBot, Applebot, etc.), excluding static asset extensions. When matched, proxy to the prerender container *before* the existing `try_files ... /index.html` fallback — real users are untouched, still get the plain SPA.
- Frontend signals render-completeness: init `window.prerenderReady = false` in `index.html`, flip to `true` inside the new Practice pages once their data fetch resolves.
- **Ops flag**: headless Chromium is RAM-hungry — verify the EC2 instance can host `redis` + `api` + `web` + `prerender` concurrently under crawl load; may need an instance size bump. This is the main operational cost of this approach.

### A4. Meta tags & head management

- Add `react-helmet-async`; wrap the router in `HelmetProvider` (`apps/frontend/src/main.tsx`).
- New `SEOHead` component (`apps/frontend/src/components/seo/SEOHead.tsx`) — `title`, `description`, `canonical`, OG/Twitter tags, optional `noindex`.
- New `apps/frontend/src/utils/seo.ts` — `buildQuestionMeta(question)` generating e.g. *"Solve: {question text, ~60 chars} | {exam} {subject} Practice | ExamPlanner"*; `buildTopicMeta(exam, subject, topic, count)` similarly.
- Add a baseline `<meta name="description">` to `index.html` too (cheap Phase 1 win, covers the pre-hydration window and pages without `SEOHead`).

### A5. Structured data (JSON-LD)

- `QuestionJsonLd` / `BreadcrumbJsonLd` components rendered via `Helmet`'s `<script type="application/ld+json">`.
- `schema.org/Quiz` with `hasPart: [Question]` (`text` = `question_text`, `acceptedAnswer.text` = correct option, `about` = subject/topic) — all fields already exist on `QuestionDetailResponse`, no backend changes.
- `BreadcrumbList`: Home > Practice > {exam} > {subject} > {topic} > {question}.
- Set expectations: Google's rich-result eligibility for Q&A content has tightened and mostly favors forum-style sites — ship this because it's cheap and aids semantic understanding, but the real win is indexable full-text content, not necessarily rich snippets.

### A6. robots.txt & sitemap.xml

- **Dynamic, backend-generated sitemap** (not static-at-build) — given a large, growing question bank that changes independently of deploys. New unauthenticated router `apps/backend/app/routers/sitemap.py`:
  - `GET /sitemap.xml` — sitemap index
  - `GET /sitemap-topics.xml` — one `<url>` per exam/subject/topic
  - `GET /sitemap-questions-{page}.xml` — paginated `PUBLISHED` questions, respecting the 50k-URL sitemap cap, `lastmod` from `Question.updated_at`
  - Cache each in Redis (6–12h TTL) reusing the existing `build_cache_key` pattern already used in `questions.py`
  - Mount without the `/api/v1` prefix (sitemaps are expected at domain root); add a dedicated nginx `location` proxying `/sitemap*` straight to the API.
- **Static `robots.txt`** at `apps/frontend/public/robots.txt`: allow `/`, `/practice/`, `/about`, `/contact`, `/exams`; disallow all `ProtectedRoute`-gated paths (`/dashboard`, `/analytics`, `/admin`, `/mocks`, `/pyq`, `/practice-exam`, `/exam/`, etc.) and `/guest-exam`; include `Sitemap: https://<domain>/sitemap.xml`.

### A7. Core Web Vitals quick wins

- `nginx.conf` has no `gzip on;` at all today — add gzip/brotli for JS/CSS/HTML/JSON.
- No cache headers on hashed Vite assets — add `expires 1y; Cache-Control: public, immutable` for `dist/assets/*`.
- No image lazy-loading/compression anywhere — add `loading="lazy"` + explicit `width`/`height`, compress `public/logo.jpeg` to WebP.
- Google Fonts already preconnected with `display=swap` (good) but pulls a very wide weight range across 3 typefaces — audit actually-used weights and prune.
- Consider `vite-plugin-compression` for pre-compressed bundle output.

### A8. Phased rollout

| Phase | Scope | Effort | Risk |
|---|---|---|---|
| 1 — Foundation | `react-helmet-async` + `SEOHead` on existing pages, baseline meta in `index.html`, static `robots.txt`, sitemap covering today's public routes, nginx gzip + cache headers, font audit | ~1 wk | Low, purely additive |
| 2 — Public URLs + auth | Slug utils, 4 new Practice pages + routes, per-question guest storage, breadcrumbs/internal linking, sitemap extended to full question set, `robots.txt` updated, nginx rate limiting | ~2–3 wk | Medium — largest surface area, scraping trade-off from A2 |
| 3 — Prerendering | `prerender` container, nginx UA-detection routing, `window.prerenderReady` signaling, Redis TTL tuning, EC2 sizing check, validate via Search Console Live Test | ~1–2 wk | Medium/high — new infra, real ops burden |
| 4 — Structured data + perf polish | JSON-LD components, image lazy-load/compression pass, Lighthouse pass, submit sitemap to Search Console + Bing Webmaster | ~1 wk | Low/medium |

**Critical files:** `apps/frontend/src/App.tsx`, `apps/frontend/nginx.conf`, `apps/backend/app/routers/questions.py`, `apps/backend/app/fastapi_server.py`, `apps/frontend/src/pages/GuestExamPage.tsx`, `apps/frontend/src/utils/guestStorage.ts`, `docker-compose.prod.yml`.

---

## Part B — Content & Keyword Strategy (UPSC/NDA focus)

### B1. Why this architecture is the strategy

Part A turns every question in the DB into a unique, indexable landing page — this is a **programmatic SEO play**: thousands of long-tail pages ("UPSC Prelims 2023 GS question on Fundamental Rights — with explanation") each targeting low-competition, high-intent searches, rather than trying to rank a handful of pages for competitive head terms. This is the single highest-leverage lever available given the existing question bank — prioritize shipping Part A before investing heavily in manual content.

### B2. Keyword clusters to target

- **Question-specific, long-tail** (auto-generated from A1, near-zero manual effort): `"{exact question phrase}"`, `"UPSC {year} {subject} question {number} explanation"`.
- **Topic practice intent**: `"NDA maths practice questions online free"`, `"UPSC modern history MCQ with answers"`, `"NDA general knowledge quiz"`.
- **PYQ intent** (high volume for UPSC/NDA specifically): `"UPSC prelims {year} question paper with solutions"`, `"NDA previous year papers with answers"`.
- **Comparison/how-to** (best served by blog-style content, optional/later): `"how to prepare for NDA maths"`, `"UPSC vs NDA exam pattern"`.

### B3. On-page content guidelines

- Question page `<h1>` = the question text itself (matches search intent verbatim — this is what makes the programmatic pages rank).
- Surface exam name, year, subject, topic, and difficulty as visible metadata near the question (also feeds the JSON-LD in A5).
- "Related questions" module on each question page linking to same-topic questions — internal linking is critical for crawl depth across thousands of pages.
- Topic pages should have a short (100–150 word) human-written intro paragraph above the question list (e.g. "Practice UPSC Modern History MCQs covering the freedom struggle, key movements, and important dates — with detailed explanations for every question") — pure listing pages with no unique text are more likely to be treated as thin/duplicate content.

### B4. Off-page & distribution

- Answer relevant questions on Quora/Reddit (r/UPSC, r/NDA-related communities) linking back to specific topic pages where genuinely useful — not spam.
- Partner with UPSC/NDA prep Telegram channels/YouTube creators for backlinks.
- Submit to relevant education directories once the public catalog is live.

### B5. Measurement & setup

- Verify domain in **Google Search Console** and **Bing Webmaster Tools**; submit `sitemap.xml` from A6.
- Track organic landing page → signup conversion in GA4 (this is the actual business metric — SEO traffic that never converts isn't worth optimizing for in isolation).
- Monitor Search Console's Coverage/Indexing report closely during Phase 2–3 rollout — with thousands of new URLs appearing at once, watch for crawl-budget throttling or unexpected `noindex`/soft-404 flags and adjust sitemap pacing if needed.

---

## Verification (when implemented)

- **Local**: run `docker compose up` (or dev equivalent), navigate to a new `/practice/:examSlug/:subjectSlug/:topicSlug/:questionSlug-:id` URL directly (no login), confirm the question renders and is solvable; check `view-source:` shows the SPA shell (expected without prerender) vs. hitting the same URL through the prerender container (`curl -A Googlebot http://localhost/practice/...`) shows fully rendered HTML with correct `<title>`/meta/JSON-LD.
- Validate `robots.txt` and `sitemap.xml` are reachable and well-formed (`curl localhost/robots.txt`, `curl localhost/sitemap.xml`, validate against the sitemap protocol).
- Run Google's **Rich Results Test** and **Mobile-Friendly Test** against a prerendered question page URL once deployed.
- Run Lighthouse/PageSpeed Insights before/after A7 changes to confirm Core Web Vitals improvement.
- After deploy, use Search Console's **URL Inspection → Live Test** to confirm Googlebot receives rendered content, then monitor the **Coverage report** over the following weeks for indexing rate.
