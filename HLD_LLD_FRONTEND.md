# 🏛️ High-Level Design (HLD) & Low-Level Design (LLD)
## Frontend Architecture Specification & Technical Blueprint

**Project Name:** Exam Planner / RankEdge Mentorship Platform (Web Frontend)  
**Target Audience:** Senior Frontend Engineers, AI Autonomous Agents, Full-Stack Architects  
**Author:** Senior Frontend Architect  
**Specification Version:** 2.0 (Dual-Auth & Real-Time Telemetry Architecture)  
**Date:** September 2026  
**Document Status:** Complete & Exhaustive Reference  

---

## 📑 Table of Contents

- [🏛️ High-Level Design (HLD) & Low-Level Design (LLD)](#️-high-level-design-hld--low-level-design-lld)
  - [📑 Table of Contents](#-table-of-contents)
  - [PART A: HIGH-LEVEL DESIGN (HLD)](#part-a-high-level-design-hld)
    - [1. System Overview](#1-system-overview)
    - [2. Architectural Layers & System Component Diagram](#2-architectural-layers--system-component-diagram)
    - [3. Complete Technology Stack & Version Matrix](#3-complete-technology-stack--version-matrix)
    - [4. End-to-End User Interaction & Data Flows](#4-end-to-end-user-interaction--data-flows)
    - [5. External Dependencies, Integrations & Failure Strategies](#5-external-dependencies-integrations--failure-strategies)
    - [6. Deployment, Runtime & Build Topology](#6-deployment-runtime--build-topology)
    - [7. Cross-Cutting Architectural Concerns](#7-cross-cutting-architectural-concerns)
  - [PART B: LOW-LEVEL DESIGN (LLD) — DOMAIN & COMPONENT SPECIFICATIONS](#part-b-low-level-design-lld--domain--component-specifications)
    - [Domain 1: Application Shell, Routing & Lifecycle](#domain-1-application-shell-routing--lifecycle)
    - [Domain 2: Dual Authentication, Authorization & Session Management](#domain-2-dual-authentication-authorization--session-management)
    - [Domain 3: Public Marketing, Landing & Informational Pages](#domain-3-public-marketing-landing--informational-pages)
    - [Domain 4: Student Portal & Dashboard Architecture](#domain-4-student-portal--dashboard-architecture)
    - [Domain 5: Real-Time Exam Engine & Proctoring Telemetry](#domain-5-real-time-exam-engine--proctoring-telemetry)
    - [Domain 6: Psychometrics & Cognitive Diagnostic Analytics](#domain-6-psychometrics--cognitive-diagnostic-analytics)
    - [Domain 7: Study Planner, Gamification & Spaced Repetition](#domain-7-study-planner-gamification--spaced-repetition)
    - [Domain 8: Peer Challenges & Quota Limiting](#domain-8-peer-challenges--quota-limiting)
    - [Domain 9: Question Bookmarks & Revision Vault](#domain-9-question-bookmarks--revision-vault)
    - [Domain 10: Current Affairs Daily Compilation](#domain-10-current-affairs-daily-compilation)
    - [Domain 11: Notification Center & Broadcast Banners](#domain-11-notification-center--broadcast-banners)
    - [Domain 12: Teacher Portal & HITL Review Rewards](#domain-12-teacher-portal--hitl-review-rewards)
    - [Domain 13: Administrator Portal & Content Management](#domain-13-administrator-portal--content-management)
    - [Domain 14: SuperAdmin Governance, RBAC & Platform Diagnostics](#domain-14-superadmin-governance-rbac--platform-diagnostics)
    - [Domain 15: Design System, Theming Engine & Global UI Tokens](#domain-15-design-system-theming-engine--global-ui-tokens)
    - [Domain 16: API Guarding, Adaptive Polling & Client Utilities](#domain-16-api-guarding-adaptive-polling--client-utilities)
  - [PART C: CONVENTIONS, ARCHITECTURAL PATTERNS & GUARDRAILS](#part-c-conventions-architectural-patterns--guardrails)
  - [PART D: AMBIGUITIES, ARCHITECTURAL DEBT & ITEMS REQUIRING VERIFICATION](#part-d-ambiguities-architectural-debt--items-requiring-verification)

---

# PART A: HIGH-LEVEL DESIGN (HLD)

## 1. System Overview

The **Exam Planner / RankEdge Web Frontend** is a high-performance, single-page application (SPA) designed to serve competitive civil services and government exam aspirants (e.g., UPSC CSE, State PCS, SSC) across India. It provides a multi-role, responsive web interface tailored for four primary user personas:
1. **Students / Candidates:** Engage with past-year question (PYQ) papers and AI-generated mock tests in realistic timed exam conditions or interactive practice modes; monitor sub-second answer telemetry and option revisions; review granular psychometric diagnostic reports; follow personalized spaced-repetition revision schedules; and participate in peer-to-peer competitive challenges.
2. **Educators / Teachers:** Perform Human-in-the-Loop (HITL) audits of automatically extracted exam questions, review distractor explanations, flag low-confidence OCR segments, accrue review points, and submit reward redemption requests.
3. **Content Administrators:** Upload raw question papers (PDFs) and answer keys, track OCR pipeline extraction runs, monitor pipeline health, manage syllabus taxonomies, curate daily current affairs compilations, and publish broadcast announcements.
4. **Platform SuperAdmins:** Oversee user access, approve pending administrative requests, configure dynamic Role-Based Access Control (RBAC) permission matrices, moderate student testimonials, and inspect real-time platform diagnostics.

### Key Architectural Characteristics:
- **Zero-Login Trial Architecture:** Guest users can initiate mock exam trials immediately on `/guest-exam` without sign-up. Exam progress and responses are persisted in browser local storage (`rankedge_guest_attempts`). Upon user authentication or registration, guest attempt histories are automatically merged and reassigned to the candidate's account via `/api/v1/attempts/sync-guest-sessions`.
- **Dual Authentication Stack:** Transparently supports modern federated sign-in via `@clerk/clerk-react` alongside an in-house custom JWT credential system with email verification, password reset tokens, and local storage token management.
- **Micro-Telemetry Synchronization:** Test-taking sessions continuously transmit option selection, strike-through elimination states, option-switch counters, and remaining time heartbeats to the backend with serialized in-flight queueing (`guardedFetch`).
- **Adaptive Non-Linear Polling:** Long-running asynchronous operations (PDF OCR extraction, post-submission psychometric report compilation) use an adaptive polling curve that begins with warm-up delays, ramps up frequency for real-time visualization, backs off during heavy mid-computation, and ramps down to sub-4s intervals near completion.
- **Dynamic Theming System:** Built upon pure CSS custom properties and runtime `data-theme` switching, supporting user-selected themes (`crimson`, `royal`, `ocean`, `forest`) synchronized with backend site settings.

---

## 2. Architectural Layers & System Component Diagram

The frontend is structured into six clean, decoupled architectural layers:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PRESENTATION LAYER (UI / UX)                                   │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌─────────────────────────────────────┐ │
│  │     PublicLayout      │  │     StudentLayout      │  │     Admin / Teacher Layouts         │ │
│  │ (Navbar, Hero, Footer)│  │ (Sidebar, Header, Nav) │  │  (Sidebars, TabNav, Modals, Views)  │ │
│  └───────────┬───────────┘  └───────────┬────────────┘  └──────────────────┬──────────────────┘ │
└──────────────┼──────────────────────────┼──────────────────────────────────┼────────────────────┘
               ▼                          ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ROUTING & ACCESS CONTROL (SECURITY)                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │   React Router DOM 6.23.1 (<Routes>, <Route>, React.lazy(), Suspense, LoadingFallback)     │ │
│  │   <ProtectedRoute> (Dual Auth Verification, Role Checking: STUDENT | ADMIN | TEACHER)      │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               STATE MANAGEMENT & CONTEXT LAYER                                  │
│  ┌────────────────────┐  ┌────────────────────────────┐  ┌───────────────────────────────────┐  │
│  │    ThemeContext    │  │   Clerk Auth + Local JWT   │  │       useSyncExternalStore        │  │
│  │(data-theme toggle) │  │(localStorage: access_token)│  │(useBreakpoint window media query)  │  │
│  └────────────────────┘  └────────────────────────────┘  └───────────────────────────────────┘  │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT HOOKS & DOMAIN UTILITIES                                  │
│  ┌───────────────────────────┐  ┌────────────────────────────┐  ┌─────────────────────────────┐ │
│  │   useMinimumLoadingTime   │  │       useExamUpload        │  │        guestStorage         │ │
│  │   (Anti-Flicker Skeleton) │  │  (Conflict Modals & Cache) │  │  (Guest Session Persist)   │ │
│  └───────────────────────────┘  └────────────────────────────┘  └─────────────────────────────┘ │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             API INGRESS & RESILIENCE GUARD LAYER                                │
│  ┌────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │   guardedFetch: In-flight GET Promise Deduplication & Serialized Mutation Execution Locks   │ │
│  │   createAdaptivePoller: Non-linear Decay/Backoff Polling for Asynchronous Tasks            │ │
│  └────────────────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               SERVICE CLIENT LAYER (13 SERVICES)                                │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────────────┐ │
│  │  authService  │ │  examService  │ │analyticsServ. │ │studyPlannerS. │ │  challengeService  │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └────────────────────┘ │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌────────────────────┐ │
│  │ adminService  │ │ teacherServ.  │ │notificService │ │ rolesService  │ │siteSettingsService │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘ └────────────────────┘ │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐                                          │
│  │bookmarkService│ │testimonialServ│ │examTypeService│                                          │
│  └───────────────┘ └───────────────┘ └───────────────┘                                          │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      BACKEND HTTP INGRESS                                       │
│          Vite Proxy (Dev: 3000 -> 8000)  /  Nginx Reverse Proxy (Prod: 80 -> api:8000)          │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Technology Stack & Version Matrix

| Layer / Concern | Technology / Package | Version | Architectural Role / Implementation Responsibility |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React | `^18.3.1` | Declarative UI framework with Concurrent Mode rendering, functional components, hooks, and code splitting. |
| **DOM Renderer** | React DOM | `^18.3.1` | Client-side DOM mounting via `ReactDOM.createRoot()`. |
| **Language** | TypeScript | `^5.4.5` | Strict static typing, discriminated unions for exam states, interface schemas matching backend models. |
| **Build & Bundler** | Vite | `^5.2.11` | Instant ESM dev server, fast Hot Module Replacement (HMR), Rollup-based production tree-shaking. |
| **React Plugin** | `@vitejs/plugin-react` | `^4.3.0` | Fast React Fast Refresh and JSX transformation. |
| **Client Routing** | React Router DOM | `^6.23.1` | Declarative client-side routing, route param extraction (`useParams`), navigation guards (`Navigate`, `useLocation`). |
| **Authentication** | `@clerk/clerk-react` | `^5.61.9` | Federated OAuth authentication provider and session management. |
| **Custom Auth** | Custom JWT Engine | `In-house` | Email/password login, registration, token storage in `localStorage`, guest session sync. |
| **Icons** | Lucide React | `^1.28.0` | Modern, consistent icon set for navigation, status badges, actions, and dashboard telemetry. |
| **Data Visualization** | Recharts | `^3.10.1` | Declarative SVG charts for psychometric radar curves, weekly pacing, time-distribution, and score trends. |
| **Markdown Parsing** | React Markdown | `^10.1.0` | Renders question stems, formulas, AI mentorship reports, and comprehensive explanations. |
| **GFM Extension** | Remark GFM | `^4.0.1` | GitHub Flavored Markdown support for tables, strike-through text, and task checklists. |
| **Styling** | Vanilla CSS + PostCSS | PostCSS `^8.5.26` | Pure CSS custom properties (`--primary-red`, `--font-display`), no Tailwind runtime overhead. |
| **CSS Normalization**| Autoprefixer | `^10.5.4` | Vendor prefix automation for cross-browser CSS compatibility. |
| **Production Server**| Nginx | `1.25 Alpine` | Lightweight production web server, SPA client-side fallback (`try_files`), API reverse proxy. |
| **Containerization** | Docker | `Alpine Linux`| Multi-stage build container (`node:20-alpine` build -> `nginx:alpine` runtime). |

---

## 4. End-to-End User Interaction & Data Flows

### Flow 1: Zero-Login Guest Exam Taking to Authenticated Account Sync

```
[Unauthenticated User]
        │
        ▼ Visits /guest-exam
[GuestExamPage] ────► Fetches question papers via examService.ts
        │
        ▼ User selects answers & completes trial test
[guestStorage.ts] ──► Saves attempt in localStorage: rankedge_guest_attempts
        │
        ▼ User clicks "Save Results / Sign Up"
[AuthModal / SignUpPage] ──► Submits credentials to /api/v1/auth/register
        │
        ▼ Registration successful (JWT received in data.access_token)
[authService.ts: syncGuestSessionsOnAuth(token)]
        │
        ▼ POST /api/v1/attempts/sync-guest-sessions { sessions_payload: [...] }
[Backend API] ──────► Migrates guest attempt rows to candidate's user_id
        │
        ▼ Returns { latest_attempt_id: 1042 }
[Frontend] ─────────► Clears localStorage: rankedge_guest_attempts
                    ► Stores sessionStorage: latest_synced_attempt_id
                    ► Redirects to /dashboard with historical test reflected
```

### Flow 2: Authenticated Real-Time Exam Taking & Telemetry Pipeline

```
[Candidate] ──► Navigates to /exam/:examId
     │
     ▼
[ExamEnginePage] ──► Calls examService.startExamAttempt(examId)
     │
     ▼ Receives total_questions, duration, first_question, palette
[ExamHeader / ExamSectionSidebar] ──► Starts local countdown timer
     │
     ▼ Candidate selects Option B on Question 3
[ExamQuestionCard]
     │
     ▼ Dispatches saveQuestionResponse(attemptId, { question_id, selected_option_id, time_spent_seconds })
[guardedFetch / apiGuard.ts] ──► Serializes in-flight mutation lock
     │
     ▼ POST /api/v1/attempts/:attemptId/save-response
[Backend DB] ──► Updates response row & logs switch telemetry
     │
     ▼ Periodic Proctoring Heartbeat (every 30 seconds)
[ExamEnginePage] ──► Calls sendExamHeartbeat(remaining_time_seconds, active_question_id)
     │
     ▼ Candidate clicks "Submit Exam"
[ExamSubmitModal] ──► Calls submitExamAttempt(attemptId, { submission_reason: 'NORMAL' })
     │
     ▼ Backend responds: { status: 'SUBMITTED', evaluation_status: 'PROCESSING' }
[ExamEnginePage] ──► Redirects candidate to /analytics?attempt_id=:attemptId
```

### Flow 3: Adaptive Polling for Asynchronous Report Generation

```
[AnalyticsPage]
     │
     ▼ Initializes createAdaptivePoller(taskFn)
[adaptivePolling.ts]
     │
     ├─► Phase 1 (Warm-Up Delay: 8000ms): Allows backend to compute Phase 1 12 matrices
     │
     ├─► Phase 2 (Active Ramp-Up: 6000ms -> 4000ms -> 3000ms): Polls /api/v1/analytics/attempt/:id/status
     │
     ├─► Phase 3 (Mid-Run Backoff: 3000ms -> 4200ms -> 5880ms): Backoff if Phase 2 LLM synthesis takes longer
     │
     ├─► Phase 4 (Near-Completion: progress >= 80%): Clamps delay back down to 3500ms
     │
     ▼ Status returns: { is_ready: true, status: 'COMPLETED' }
[Poller Controller] ──► Calls stop(), triggers fetchPsychometricReportJson()
     │
     ▼
[PerformanceAnalyticsCharts & PsychometricReportView] ──► Renders cognitive radar & mentor tasks
```

---

## 5. External Dependencies, Integrations & Failure Strategies

| External Dependency | Integration Purpose | Failure Mode / Disruption Impact | Resilience & Graceful Fallback Strategy |
| :--- | :--- | :--- | :--- |
| **Clerk Authentication** | Federated social sign-in, user identity, and session cookies. | Clerk CDN down, DNS failure, or quota exhaustion. | Dual-stack auth design: custom backend JWT sign-in (`/api/v1/auth/login`) functions independently of Clerk. |
| **Backend FastAPI Engine** | Core REST API for questions, attempts, analytics, and admin ops. | Network disconnect, HTTP 500, or server reboot. | `apiGuard.ts` intercepts network exceptions; guest exam mode persists data in `localStorage`; UI displays retry toasts. |
| **AWS S3 / MinIO CDN** | Hosting extracted question diagram images and PDF papers. | S3 bucket permissions error or temporary 403. | Broken image error handler swaps missing diagram with fallback diagram placeholder; text stem remains readable. |
| **Google Fonts CDN** | `Outfit`, `DM Sans`, and `DM Mono` web fonts. | Network firewall blocking `fonts.googleapis.com`. | System font fallbacks declared in `index.css`: `system-ui, -apple-system, sans-serif` and `monospace`. |
| **Browser LocalStorage** | Stores tokens, user profile, active theme, and guest attempts. | Private browsing mode or quota exceeded. | Wrapped in `try/catch` blocks in all services and `ThemeContext`; falls back to memory variables if unavailable. |

---

## 6. Deployment, Runtime & Build Topology

The frontend is packaged as an optimized, static single-page bundle hosted on an Alpine Nginx container:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOCKER MULTI-STAGE BUILD                           │
│                                                                                 │
│  Stage 1: Build Container (node:20-alpine)                                      │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. COPY package*.json ./  ->  npm install                                  │  │
│  │ 2. INJECT ENV: VITE_CLERK_PUBLISHABLE_KEY                                  │  │
│  │ 3. COPY . .                                                               │  │
│  │ 4. RUN npm run build  ->  tsc && vite build  ->  Generates /app/dist      │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        ▼                                        │
│  Stage 2: Production Container (nginx:alpine)                                   │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. COPY nginx.conf -> /etc/nginx/conf.d/default.conf                      │  │
│  │ 2. COPY --from=builder /app/dist -> /usr/share/nginx/html                 │  │
│  │ 3. EXPOSE 80                                                              │  │
│  │ 4. CMD ["nginx", "-g", "daemon off;"]                                     │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Production Nginx Routing Configuration (`nginx.conf`):
- **Client-Side SPA Routing Fallback:** `try_files $uri $uri/ /index.html;` ensures deep routes (e.g. `/exam/42`, `/analytics?attempt_id=10`) resolve to `index.html` without 404 errors.
- **Large Body Size for Uploads:** `client_max_body_size 100M;` enables content admins to upload 100MB+ question paper PDFs directly through the browser.
- **API Reverse Proxy:** Directs `/api/` traffic to `http://api:8000/api/` with HTTP/1.1 keep-alive and WebSocket upgrade headers (`$http_upgrade`).

---

## 7. Cross-Cutting Architectural Concerns

### 7.1 Authentication & Dual-Stack Identity Model
- **Custom JWT Auth:** Tokens stored in `localStorage.getItem('access_token')`. Decoded user JSON stored in `localStorage.getItem('user')`.
- **Clerk Auth:** Injected via `<ClerkProvider>` in `main.tsx`. `useAuth()` hook exposes `isLoaded` and `isSignedIn`.
- **Route Guarding:** `ProtectedRoute.tsx` validates that either a valid custom token exists or Clerk is signed in before mounting protected views.

### 7.2 Dynamic Multi-Theme Engine
- The platform supports 4 curated themes:
  - Default: `crimson` (Deep crimson red accent, slate dark navy backgrounds).
  - Alternate: `royal` (Regal purple accent).
  - Alternate: `ocean` (Deep cyan blue accent).
  - Alternate: `forest` (Emerald green accent).
- `ThemeContext.tsx` reads theme from `localStorage: site_theme`, queries `/api/v1/site-settings/theme/active`, and applies the `data-theme` attribute to `document.documentElement`.

### 7.3 API Resilience & Concurrency Guarding (`guardedFetch`)
- **GET Request Deduplication:** Prevents duplicate identical GET requests triggered by component re-renders. If an identical GET request is in flight, subsequent calls receive a cloned response (`res.clone()`) from the existing active promise.
- **Mutation Serialization:** Prevents race conditions during answer saves. If a mutation request is made to an endpoint before the prior mutation finishes, execution waits until the previous request completes.

### 7.4 Anti-Flicker Skeleton Loading Pattern (`useMinimumLoadingTime`)
- Fast network responses (<50ms) can cause jarring UI flashes when skeleton loaders mount and unmount instantaneously. `useMinimumLoadingTime(isFetching, 400)` guarantees skeletons remain visible for a minimum of 400ms before fading in final content.

---

# PART B: LOW-LEVEL DESIGN (LLD) — DOMAIN & COMPONENT SPECIFICATIONS

## Domain 1: Application Shell, Routing & Lifecycle

### 1.1 Module Architecture & File Catalog

This domain defines the single-page application bootstrap sequence, HTML shell, Vite compilation environment, route tree declarations, and production Nginx reverse proxy configuration.

- `index.html`:
  - Main HTML document shell providing root mounting container `<div id="root"></div>`, responsive viewport meta tags, preconnected Google Font links (`Outfit`, `DM Sans`, `DM Mono`), and module entry point `<script type="module" src="/src/main.tsx"></script>`.
- `src/main.tsx`:
  - Application bootstrap entry point.
  - Initializes `ClerkProvider` using `VITE_CLERK_PUBLISHABLE_KEY`.
  - Mounts React 18 Concurrent Root via `ReactDOM.createRoot()`.
  - Injects global stylesheet imports (`index.css`, `styles/index.css`, `styles/themes.css`).
- `src/App.tsx`:
  - Declarative client-side routing manifest using React Router DOM (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
  - Code splitting via dynamic `React.lazy()` imports for all 34 page modules.
  - `<Suspense fallback={<LoadingFallback />}>` boundary rendering centralized `<Spinner size={40} />` during chunk resolution.
  - Wraps entire application within `<ThemeProvider>` and renders floating `<GlobalThemeToggle />`.
- `vite.config.ts`:
  - Vite 5 build configuration.
  - Merges environment variables from workspace root `.env` and `apps/frontend/.env`, exposing `VITE_*` keys via `import.meta.env`.
  - Development proxy routing: proxies `/api` to `http://127.0.0.1:8000` with CORS origin modification (`changeOrigin: true`).
  - Custom file watcher plugin triggering HMR reloads on root `.env` changes.
- `nginx.conf`:
  - Production web server configuration.
  - Handles client-side SPA routing via `try_files $uri $uri/ /index.html;`.
  - Configures `client_max_body_size 100M;` for large PDF exam uploads.
  - Reverse proxies `/api/` calls to upstream backend container `http://api:8000/api/`.

### 1.2 Comprehensive Client-Side Route Manifest

| Route Path | Target Component | Protected | Allowed Roles | Layout Used | Description & Operational Flow |
|------------|------------------|-----------|---------------|-------------|--------------------------------|
| `/` | `LandingPage` | NO | `Public` | `PublicLayout` | Root landing page with hero, interactive demo, and CTA |
| `/signin` | `LandingPage` | NO | `Public` | `PublicLayout` | Landing page with modal opened in login mode |
| `/login` | `LandingPage` | NO | `Public` | `PublicLayout` | Landing page with modal opened in login mode |
| `/signup` | `LandingPage` | NO | `Public` | `PublicLayout` | Landing page with modal opened in registration mode |
| `/register` | `LandingPage` | NO | `Public` | `PublicLayout` | Landing page with modal opened in registration mode |
| `/verify-email` | `VerifyEmailPage` | NO | `Public` | `PublicLayout` | Renders `VerifyEmailPage` view |
| `/forgot-password` | `ForgotPasswordPage` | NO | `Public` | `PublicLayout` | Renders `ForgotPasswordPage` view |
| `/reset-password` | `ResetPasswordPage` | NO | `Public` | `PublicLayout` | Renders `ResetPasswordPage` view |
| `/guest-exam` | `GuestExamPage` | NO | `Public` | `Standalone Exam Shell` | Zero-login trial exam engine with local storage persistence |
| `/exams` | `ExamsPage` | NO | `Public` | `PublicLayout` | Renders `ExamsPage` view |
| `/about` | `AboutUsPage` | NO | `Public` | `PublicLayout` | Renders `AboutUsPage` view |
| `/contact` | `ContactUsPage` | NO | `Public` | `PublicLayout` | Renders `ContactUsPage` view |
| `/practice-exam` | `StudentPracticeExamPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `StudentPracticeExamPage` view |
| `/exam/:examId` | `ExamEnginePage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `Standalone Exam Shell` | Full-screen proctored exam interface with micro-telemetry |
| `/dashboard` | `DashboardPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Primary student dashboard showing streak, XP, upcoming tasks |
| `/current-affairs` | `CurrentAffairsPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `CurrentAffairsPage` view |
| `/current-affairs/:id` | `CurrentAffairsDetailPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `CurrentAffairsDetailPage` view |
| `/notifications` | `NotificationsPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `NotificationsPage` view |
| `/notifications/:id` | `NotificationsPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `NotificationsPage` view |
| `/challenge/:token` | `PublicChallengePage` | NO | `Public` | `PublicLayout` | Renders `PublicChallengePage` view |
| `/challenges` | `ChallengesPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Peer challenges directory, active duels, and leaderboards |
| `/challenges/new` | `CreateChallengePage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `CreateChallengePage` view |
| `/challenges/attempt/:idOrToken` | `ChallengeAttemptPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `Standalone Exam Shell` | Renders `ChallengeAttemptPage` view |
| `/challenges/:id` | `ChallengeDetailPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `ChallengeDetailPage` view |
| `/study-planner` | `StudyPlannerPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Calendar view with spaced repetition tasks and study logging |
| `/analytics` | `AnalyticsPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Psychometric diagnostic report view with 12 cognitive radar metrics |
| `/reports/weekly` | `WeeklyInsightsPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `WeeklyInsightsPage` view |
| `/reports/monthly` | `MonthlyReportPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `MonthlyReportPage` view |
| `/pyq` | `PYQSelectionPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `PYQSelectionPage` view |
| `/mocks` | `MockSelectionPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `MockSelectionPage` view |
| `/profile` | `ProfilePage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `ProfilePage` view |
| `/bookmarks` | `BookmarksPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `BookmarksPage` view |
| `/pricing` | `PricingPage` | YES | `STUDENT,ADMIN,SUPER_ADMIN` | `StudentLayout` | Renders `PricingPage` view |
| `/admin` | `AdminPage` | YES | `ADMIN,SUPER_ADMIN` | `AdminLayout` | Content administrative console (uploads, pipeline, questions) |
| `/superadmin` | `SuperAdminPage` | YES | `SUPER_ADMIN` | `AdminLayout` | Superadmin governance (RBAC, user moderation, diagnostics) |
| `/teacher` | `TeacherPage` | YES | `TEACHER` | `TeacherLayout` | Teacher HITL audit queue, review rewards, and point ledger |
| `*` | `Navigate` | NO | `Public` | `PublicLayout` | Renders `Navigate` view |

### 1.3 Client-Side Storage Keys Utilized
- `site_theme`: Persists active UI theme token (`crimson`, `royal`, `ocean`, `forest`).
- `access_token`: Stores backend JWT authentication token.
- `user`: JSON-serialized profile of authenticated user.
- `latest_synced_attempt_id`: Session-scoped ID of recently reassigned guest exam attempt.

---

## Domain 2: Dual Authentication, Authorization & Session Management

### 2.1 Module Architecture & File Catalog

This domain implements a resilient dual-stack authentication architecture allowing users to authenticate via either Clerk federated OAuth or an in-house custom JWT system. It enforces strict Role-Based Access Control (RBAC) across all protected routes and automatically merges unauthenticated guest test sessions upon signup.

- `src/components/common/ProtectedRoute.tsx`:
  - Higher-Order Component (HOC) guarding routes against unauthorized access.
  - Inspects both `localStorage` (`access_token` and `user`) and Clerk session state (`useAuth().isSignedIn`).
  - Checks candidate's role against `allowedRoles` array (`STUDENT`, `ADMIN`, `SUPER_ADMIN`, `TEACHER`).
  - Gracefully redirects unauthorized users to `/dashboard` (if student) or `/signin` (if unauthenticated).
- `src/components/auth/AuthModal.tsx`:
  - Modal dialog providing tabbed switching between Login and Signup modes.
  - Supports role selection (`STUDENT` vs `ADMIN`), institution/organization input for admin applicants, and inline validation.
- `src/services/authService.ts`:
  - `loginUser(email, password, role)`: Submits credentials to `/api/v1/auth/login`, stores JWT, and triggers guest session sync.
  - `registerUser(...)`: Submits registration payload to `/api/v1/auth/register`, caches credentials, and syncs guest sessions.
  - `syncGuestSessionsOnAuth(token)`: Migrates guest exam attempts stored in `localStorage` to the newly authenticated account via `/api/v1/attempts/sync-guest-sessions`.
  - `logoutUser()`: Purges `access_token`, `user`, and `sessionStorage` keys.
  - `fetchCurrentUser(customToken)`: Refreshes user profile from `/api/v1/auth/me` via `guardedFetch`.
  - `updateUserProfile(updateData)`: Patches profile fields and dispatches cross-component event `window.dispatchEvent(new Event('user_profile_updated'))`.
  - `verifyEmail(token)`, `forgotPassword(email)`, `resetPassword(token, password)`: Credential recovery endpoints.
- `src/types/auth.ts`:
  - `UserRole` enum: `STUDENT`, `ADMIN`, `SUPER_ADMIN`, `TEACHER`.
  - `UserStatus` enum: `PENDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`.
  - TypeScript interfaces for `User`, `StudentProfile`, `AdminProfile`, `AuthResponse`, `Permission`, `Role`.
- `src/pages/SignInPage.tsx` & `src/pages/SignUpPage.tsx`:
  - Dedicated authentication pages embedding `AuthModal` or Clerk `<SignIn />` / `<SignUp />` components.
- `src/pages/ForgotPasswordPage.tsx` & `src/pages/ResetPasswordPage.tsx`:
  - Multi-step email password recovery workflow with token validation.
- `src/pages/VerifyEmailPage.tsx`:
  - Landing handler validating email confirmation tokens dispatched during registration.

### 2.2 Auth State Flow & Protected Route Sequence

```
                     ┌───────────────────────────┐
                     │ User Requests /dashboard  │
                     └─────────────┬─────────────┘
                                   │
                                   ▼
                     ┌───────────────────────────┐
                     │     <ProtectedRoute>      │
                     └─────────────┬─────────────┘
                                   │
             ┌─────────────────────┴─────────────────────┐
             │ Check 1: Custom JWT                       │ Check 2: Clerk Auth
             ▼                                           ▼
┌───────────────────────────┐               ┌───────────────────────────┐
│ access_token & user JSON  │               │ useAuth().isSignedIn      │
│ present in localStorage?  │               │ is true?                  │
└────────────┬──────────────┘               └─────────────┬─────────────┘
             │ YES                                        │ YES
             ▼                                            ▼
   User Authenticated                           User Authenticated (STUDENT)
             │                                            │
             └─────────────────────┬──────────────────────┘
                                   │
                                   ▼
             ┌───────────────────────────────────────────┐
             │ Does user.role match allowedRoles?        │
             └─────────────┬─────────────────────────────┘
                           │
                 ┌─────────┴─────────┐
                 │ YES               │ NO
                 ▼                   ▼
      ┌────────────────────┐   ┌──────────────────────────┐
      │ Render <Dashboard> │   │ Redirect /signin or /home│
      └────────────────────┘   └──────────────────────────┘
```

---

## Domain 3: Public Marketing, Landing & Informational Pages

### 3.1 Module Architecture & File Catalog

This domain renders the public marketing surface of RankEdge, communicating the platform value proposition, showcasing platform psychometric capabilities, presenting pricing tiers, and providing exam catalog discovery.

- `src/pages/LandingPage.tsx`:
  - Master marketing landing page. Coordinates hero section, feature spotlights, interactive exam engine preview, student testimonials, and CTA banners.
  - Accepts `initialAuthMode` prop (`login` | `signup`) to automatically pop open `AuthModal` upon direct route navigation to `/signin` or `/signup`.
- `src/components/landing/HeroSection.tsx` & `HeroIllustration.tsx`:
  - Above-the-fold value proposition with dynamic headline, civil services focus tags, and direct CTA buttons ("Start Free Trial Exam" -> `/guest-exam`).
- `src/components/landing/FeaturesSection.tsx`:
  - Feature grid highlighting 12 psychometric cognitive matrices, deterministic OCR extraction, bilingual exam papers, and spaced-repetition study planner.
- `src/components/landing/DashboardPreview.tsx`:
  - Interactive UI mock showcasing the student psychometric analytics radar and cognitive readiness score (ICRS).
- `src/components/landing/StatsSection.tsx` & `WhySection.tsx`:
  - Social proof counters (questions solved, civil services aspirants, accuracy improvement percentages) and comparative differentiation table.
- `src/components/landing/Testimonials.tsx`:
  - Carousel of verified 5-star student testimonials loaded dynamically from `testimonialService.fetchApprovedTestimonials()`.
- `src/components/landing/CTASection.tsx`:
  - Bottom conversion banner encouraging unauthenticated visitors to start an instant trial test.
- `src/components/common/PublicLayout.tsx`, `Navbar.tsx`, `Footer.tsx`:
  - Shared public wrapper providing sticky navigation bar with auth triggers, exam category links, and legal/footer directory.
- `src/pages/AboutUsPage.tsx` & `src/pages/ContactUsPage.tsx`:
  - Corporate background, pedagogical mission, advisory board, and contact inquiry form.
- `src/pages/PricingPage.tsx`:
  - Subscription plan tier comparison (`Free Trial`, `Pro Mentorship`, `Annual Civil Services Pass`) detailing feature entitlements.
- `src/pages/ExamsPage.tsx`:
  - Public catalog of supported civil services exams (UPSC CSE Prelims GS1, CSAT, State PCS) with syllabus hierarchy previews.

---

## Domain 4: Student Portal & Dashboard Architecture

### 4.1 Module Architecture & File Catalog

This domain forms the command center for authenticated students. It displays real-time gamification progress (streaks, levels, XP), upcoming spaced-repetition study tasks, historical test performance summaries, and personalized revision queues.

- `src/pages/DashboardPage.tsx`:
  - Primary dashboard view. Orchestrates data fetching across `authService.fetchCurrentUser()`, `examService.getUserCumulativeAggregateReport()`, `studyPlannerService.fetchStudyTasks()`, and `analyticsService.fetchPredictedRank()`.
  - Integrates `useMinimumLoadingTime` to maintain smooth skeleton loading states.
- `src/components/student/StudentLayout.tsx`:
  - Master layout wrapper for all authenticated student routes. Provides responsive two-column grid with collapsible sidebar navigation and sticky top header.
- `src/components/student/StudentSidebar.tsx`:
  - Main student navigation tree: Dashboard, Practice Exams, PYQ Vault, Mocks, Study Planner, Analytics, Bookmarks, Challenges, Notifications, Profile.
  - Displays user avatar, active subscription tier badge, and quick logout button.
- `src/components/student/StudentTopHeader.tsx`:
  - Top header displaying active streak counter (flame icon with days count), cumulative XP total, level badge, and quick theme toggle.
- `src/components/student/HeroWelcomeBanner.tsx`:
  - Personalized candidate greeting with contextual study prompts based on upcoming target exam date and daily goal progress.
- `src/components/student/StudentMetricsGrid.tsx` & `StudentMetricCard.tsx`:
  - 4-column KPI telemetry grid: Total Questions Solved, Cumulative Accuracy %, Integrated Cognitive Readiness Score (ICRS), and Predicted Rank.
- `src/components/student/UpNextQueueCard.tsx`:
  - Spaced repetition action card presenting the candidate's highest-priority revision task generated by the post-submission AI mentor.
- `src/components/student/StudentMetricCardSkeleton.tsx` & `StudyPlannerSkeleton.tsx`:
  - Layout-accurate placeholder shimmer loaders preventing Cumulative Layout Shift (CLS).

### 4.2 Dashboard Data Aggregation Pipeline

```
[DashboardPage Mount]
         │
         ├──► authService.fetchCurrentUser() ──────► User Streak, XP, Level, Tier
         │
         ├──► studyPlannerService.fetchStudyTasks() ► Today's Pending Spaced Tasks
         │
         ├──► examService.getUserCumulativeReport() ► ICRS Score, Accuracy %, IRT Ability
         │
         └──► analyticsService.fetchPredictedRank() ─► Statistical All-India Rank
         │
         ▼
[useMinimumLoadingTime(loading, 400ms)]
         │
         ▼ (Skeletons smoothly cross-fade to live metrics)
[Render: MetricsGrid + UpNextQueueCard + WeeklyInsightsCharts]
```

---

## Domain 5: Real-Time Exam Engine & Proctoring Telemetry

### 5.1 Module Architecture & File Catalog

This domain represents the high-stakes test-taking interface of RankEdge. It delivers questions in real-time, manages full-screen proctoring timers, tracks micro-answer selections, captures distractor strike-through elimination events, records option switches, and submits the attempt for psychometric scoring.

- `src/pages/ExamEnginePage.tsx`:
  - Full-screen proctored exam orchestrator.
  - Lifecycle states: `INITIALIZING` -> `IN_PROGRESS` -> `PAUSED` -> `SUBMITTING` -> `COMPLETED`.
  - Manages active question pointer, answers state map, option switch counters, strike-through sets, and elapsed time accumulator.
  - Dispatches proctoring heartbeat every 30 seconds via `examService.sendExamHeartbeat()`.
  - Integrates beforeunload guards (`window.addEventListener('beforeunload')`) to prevent accidental tab closure.
- `src/pages/StudentPracticeExamPage.tsx`:
  - Interactive untimed/practice mode version. Allows candidates to instantly reveal correct answers, review detailed solutions in markdown, and inspect distractor closeness scores without submitting the entire exam.
- `src/pages/GuestExamPage.tsx`:
  - Zero-login trial exam engine. Uses `guestStorage.ts` to persist attempt telemetry in `localStorage: rankedge_guest_attempts`.
  - Upon completion, opens `GuestScoreModal` displaying summary accuracy and prompting the user to register to unlock the full 12-matrix psychometric diagnostic report.
- `src/components/exam/ExamHeader.tsx`:
  - Sticky top telemetry bar displaying canonical exam title, section tabs, countdown timer (with critical low-time warning animations <5 min), question palette trigger, and "Submit Test" button.
- `src/components/exam/ExamFooterBar.tsx`:
  - Bottom action bar with "Previous", "Next", "Clear Response", and "Mark for Review & Next" buttons.
- `src/components/exam/ExamQuestionCard.tsx`:
  - Question presentation card rendering stem text, bilingual Hindi translation toggle, diagrams/images, reading passages, and radio/checkbox options with strike-through distractor elimination toggles.
- `src/components/exam/ExamQuestionPalette.tsx`:
  - Grid palette of numbered question tiles colored by status:
    - ⚪ `UNVISITED` (Gray)
    - 🔴 `VISITED / UNATTEMPTED` (Red)
    - 🟢 `ANSWERED` (Emerald Green)
    - 🟣 `MARKED_FOR_REVIEW` (Purple)
    - 🟡 `ANSWERED_AND_MARKED` (Amber)
- `src/components/exam/ExamSectionSidebar.tsx`:
  - Collapsible drawer organizing questions by subject/section (e.g. General Science, Indian Polity, Modern History, Quantitative Aptitude).
- `src/components/exam/ExamSubmitModal.tsx`:
  - Confirmation dialog presenting response summary breakdown (Answered, Unattempted, Marked for Review) before locking the submission.
- `src/components/exam/GuestScoreModal.tsx`:
  - Post-trial modal showing raw score, accuracy %, and guest-to-registered account conversion CTA.
- `src/components/exam/QuestionSolutionMarkdownCard.tsx`:
  - Rich markdown card displaying official answer explanation, core concept, distractor trap analysis, and key takeaways.
- `src/components/exam/RecommendedQuestionsPanel.tsx` & `RecommendedQuestionCard.tsx`:
  - Post-exam panel recommending targeted follow-up practice questions based on diagnosed topic weaknesses.

### 5.2 Telemetry & State Synchronization Cycle

```
[Candidate clicks Option C on Question 14]
                 │
                 ├──► Updates local state: selected_option_id = 'opt_14_c'
                 ├──► Increments switch counter if previously selected
                 ├──► Updates Palette status: ANSWERED (Emerald Green)
                 │
                 ▼
[apiGuard.ts / guardedFetch]
                 │ (Ensures previous save on Question 14 finished)
                 ▼
POST /api/v1/attempts/:id/save-response
  {
    question_id: 14,
    selected_option_id: 'opt_14_c',
    time_spent_seconds: 42,
    option_switch_count: 1,
    is_marked_for_review: false
  }
                 │
                 ▼ Returns 200 OK with ResponseSummary
[Palette & Header Counts Synchronized with Server Truth]
```

---

## Domain 6: Psychometrics & Cognitive Diagnostic Analytics

### 6.1 Module Architecture & File Catalog

This domain renders the deep psychometric intelligence produced by RankEdge's 12 cognitive matrices. It visualizes candidate latent ability ($\\theta$), speed-accuracy trade-offs, guessing tendencies, option switch regret, and topic retention decay curves.

- `src/pages/AnalyticsPage.tsx`:
  - Master psychometric scorecard view. Fetches comprehensive attempt report via `examService.pollAttemptReportUntilReady(attemptId)`.
  - Displays Integrated Cognitive Readiness Score (ICRS), All-India percentile benchmark, radar charts, and AI mentorship guidance.
- `src/pages/WeeklyInsightsPage.tsx`:
  - Longitudinal performance analysis across 7-day windows. Visualizes study hour consistency, accuracy progression, and weekly goal completion.
- `src/pages/MonthlyReportPage.tsx`:
  - Monthly cumulative benchmarking report. Compares candidate's IRT ability growth against the top 1% cohort in UPSC Prelims.
- `src/components/student/PerformanceAnalyticsCharts.tsx`:
  - Comprehensive SVG chart suite built with Recharts:
    - **Psychometric Radar Chart:** 6 axes (ICRS, IRT Theta, OEEI, SATOI, Bloom's Mastery, GTI Inverted).
    - **Macro Pacing Fatigue Curve:** Area chart plotting time spent per question against expected reading baselines, highlighting test fatigue.
    - **Speed-Accuracy Trade-Off (SATOI):** Scatter plot grouping questions into 4 quadrants (Fast-Accurate, Fast-Inaccurate, Slow-Accurate, Slow-Inaccurate).
    - **Taxonomy Mastery Bars:** Horizontal bar charts showing mastery percentage across syllabus subjects.
- `src/components/student/PsychometricAIPanel.tsx`:
  - Executive mentorship summary card rendering the qualitative analysis generated by `ReportAISynthesizer` (zero jargon, translated into "Knowledge Depth", "Guessing Risk", and "Fatigue Tolerance").
- `src/components/student/PsychometricReportView.tsx`:
  - Question-by-question audit log detailing distractor closeness classification (near-miss, trap option, slippage) for every mistake.
- `src/services/analyticsService.ts`:
  - `fetchPredictedRank()`: Queries `/api/v1/analytics/predicted-rank`.
  - `fetchMonthlyBenchmark()`: Queries `/api/v1/analytics/monthly-benchmark` with memory cache and `invalidateMonthlyBenchmarkCache()`.

### 6.2 The 12 Cognitive Matrices Visualized in Frontend

| Matrix Name | Frontend Visualization | Key Metric Extracted | Visual Alert / Threshold Indicator |
| :--- | :--- | :--- | :--- |
| **1. Integrated Cognitive Readiness (ICRS)** | Large Radial Gauge & Banner | Score (0–100) | `<50`: At-Risk (Red), `50-75`: Moderate (Yellow), `>75`: Exam-Ready (Green) |
| **2. IRT 3PL Latent Ability** | Percentile Dial & $\\theta$ Bar | Latent Ability $\\theta$ (-3.0 to +3.0) | Displays All-India estimated percentile rank. |
| **3. Guessing Tendency Index (GTI)** | Danger Risk Meter | GTI Percentage | `>25%`: Flagged as "High Guessing Risk / Uncalculated Gambles". |
| **4. Macro Pacing & Fatigue** | Time vs Question Area Graph | Time Skew Ratio | Flags end-of-exam time panic when final 20% of questions average <20s. |
| **5. Option Elimination Efficiency (OEEI)** | Efficiency Badge & Radar Point | OEEI % | Measures strategic strike-through of incorrect distractors. |
| **6. Speed-Accuracy Trade-Off (SATOI)** | 4-Quadrant Scatter Plot | Quadrant Distribution | Highlights questions rushed under pressure vs over-analyzed traps. |
| **7. Option Switch Regret (OSRI)** | Net Gain / Loss Metric Card | Regret Ratio | Shows points gained vs lost when candidate changed an initial option. |
| **8. Bloom's Cognitive Mastery** | Stacked Bar Chart | % per Bloom's Level | Breakdown across Remember, Understand, Apply, Analyze, Evaluate. |
| **9. Topic FSRS Memory Decay** | Spaced Repetition Timeline | Memory Retrievability ($R$) | Plots decay curves and schedules optimal revision dates. |
| **10. Option Closeness Classification** | Distractor Mistake Donut Chart | Error Counts by Tier | Classifies errors: Conceptual Near-Miss, Calculation Slip, Trap Option. |
| **11. Time-Tiered Scoring** | Bonus Points Tally | Tier Points Awarded | Rewards solving difficult questions within the expected pacing window. |
| **12. Cumulative Skill Progression** | Longitudinal Trend Line | Historical $\\theta$ Delta | Multi-test rolling average tracking candidate ability growth over months. |

---

## Domain 7: Study Planner, Gamification & Spaced Repetition

### 7.1 Module Architecture & File Catalog

This domain powers candidate retention, translating psychometric weakness diagnoses into structured daily revision schedules, tracking daily study habits, and awarding experience points (XP) and badges.

- `src/pages/StudyPlannerPage.tsx`:
  - Interactive calendar and task manager view.
  - Features weekly schedule timeline, today's priority queue, study habit logger, and unlocked achievements showcase.
- `src/components/student/CreateTaskModal.tsx`:
  - Dialog for manually creating revision tasks (title, subject, topic, priority, due date, estimated minutes).
- `src/components/student/LogStudyModal.tsx`:
  - Pomodoro and session tracker allowing candidates to record minutes spent on self-study, reading NCERTs, or solving mock tests.
- `src/services/studyPlannerService.ts`:
  - `fetchWeeklySchedule(startDate)`: Queries `/api/v1/study-plan/weekly-schedule`.
  - `fetchStudyTasks()`: Retrieves pending and completed tasks via `/api/v1/study-plan/tasks`.
  - `createStudyTask(payload)`: Inserts custom study task.
  - `completeStudyTask(taskId)`: Marks task finished and triggers gamification XP awards.
  - `bulkAddTasksFromReport(attemptId)`: Converts the 4 AI-prescribed mentor tasks directly into the candidate's active study plan.
  - `logStudyActivity(payload)`: Persists study duration telemetry via `/api/v1/study-plan/activities`.
  - `generateWeeklyStudyPlan(targetExam, targetDate)`: Triggers algorithmic study plan compilation.
  - `sendPendingTasksEmail()`: Dispatches email digest of overdue tasks.
  - `fetchWeeklyInsights()`: Queries 7-day study time distributions with client caching.

---

## Domain 8: Peer Challenges & Quota Limiting

### 8.1 Module Architecture & File Catalog

This domain enables peer-to-peer competitive gamification. Candidates can create custom quiz duels across specific subjects and difficulty levels, invite study partners via email or shareable public link tokens, and compete on live timed leaderboards.

- `src/pages/ChallengesPage.tsx`:
  - Challenge hub listing active peer invitations, ongoing duels, and completed challenge archives.
- `src/pages/CreateChallengePage.tsx`:
  - Wizard for creating custom quiz duels: select exam, subject filters, number of questions (5, 10, 20), time limit per question, and expiration deadline. Enforces daily challenge quota limits.
- `src/pages/ChallengeDetailPage.tsx`:
  - Pre-attempt lobby and post-attempt leaderboard. Displays participant ranks, scores, time taken, and invitation status.
- `src/pages/ChallengeAttemptPage.tsx`:
  - Synchronized, high-speed test interface for challenge questions with immediate submission and leaderboard ranking.
- `src/pages/PublicChallengePage.tsx`:
  - Public invitation landing page resolving shareable token (`/challenge/:token`). Allows guest or registered users to preview challenge parameters and join with one click.
- `src/services/challengeService.ts`:
  - `createChallenge(payload)`: Creates challenge room via `/api/v1/challenges`.
  - `listMyChallenges()`: Retrieves participant's active and historical challenges.
  - `getChallenge(challengeId)`: Retrieves challenge metadata and current participant standings.
  - `getPublicChallengePreview(token)`: Resolves public challenge preview without requiring authentication.
  - `inviteUserToChallenge(challengeId, email)`: Dispatches direct invitation notification.
  - `startChallengeAttempt(idOrToken)`: Initializes candidate attempt session.
  - `saveChallengeResponse(...)`: Micro-telemetry sink for duel answers.
  - `submitChallengeAttempt(...)`: Submits duel attempt and calculates leaderboard rank.
  - `getLeaderboard(challengeId)`: Retrieves real-time ranked participant standings.
  - `formatChallengeExpiry(date)` & `isChallengeExpired(date)`: Client time calculation helpers.

---

## Domain 9: Question Bookmarks & Revision Vault

### 9.1 Module Architecture & File Catalog

This domain provides a persistent revision vault where candidates can bookmark challenging questions, conceptual traps, or high-yield past-year items encountered during practice exams or test reviews.

- `src/pages/BookmarksPage.tsx`:
  - Question revision vault view.
  - Allows candidates to filter bookmarked questions by subject, taxonomy topic, and difficulty level.
  - Supports inline untimed practice solving, answer reveal, explanation review, and instant bookmark removal.
- `src/services/bookmarkService.ts`:
  - `listBookmarks(options)`: Fetches paginated bookmarked questions from `/api/v1/users/me/bookmarks` with client-side promise caching.
  - `addBookmark(questionId)`: Inserts question into candidate vault (`POST /api/v1/users/me/bookmarks/:questionId`).
  - `removeBookmark(questionId)`: Removes question from vault (`DELETE /api/v1/users/me/bookmarks/:questionId`).
  - `invalidateBookmarksClientCache()`: Flushes the in-flight client cache on mutation.

---

## Domain 10: Current Affairs Daily Compilation

### 10.1 Module Architecture & File Catalog

This domain organizes daily news items, national affairs, international relations, and economic editorials specifically categorized for civil services Prelims and Mains papers.

- `src/pages/CurrentAffairsPage.tsx`:
  - Master feed of daily news summaries.
  - Provides category filters (National, International, Economy, Science & Tech, Environment, Polity) and date-picker navigation.
- `src/pages/CurrentAffairsDetailPage.tsx`:
  - In-depth article reader displaying background context, key constitutional provisions, related past-year questions (PYQs), and syllabus topic links.
- `src/components/admin/views/CurrentAffairsManager.tsx`:
  - Content editor for admins to draft, tag, and publish news summaries with syllabus mapping.

---

## Domain 11: Notification Center & Broadcast Banners

### 11.1 Module Architecture & File Catalog

This domain delivers user notifications (challenge invites, weekly study report summaries, spaced repetition alerts) and administrative platform-wide broadcast announcements.

- `src/pages/NotificationsPage.tsx`:
  - Notification center view displaying chronological message stream with unread filter and mark-all-as-read action.
- `src/services/notificationService.ts`:
  - `fetchPublishedNotifications()`: Queries user in-app notifications via `/api/v1/notifications`.
  - `fetchNotificationDetail(id)`: Retrieves full broadcast text and attached PDF guidelines.
  - `adminListNotifications()`, `adminCreateNotification()`, `adminPublishNotification()`, `adminDeleteNotification()`: Administrative broadcast lifecycle management.

---

## Domain 12: Teacher Portal & HITL Review Rewards

### 12.1 Module Architecture & File Catalog

This domain manages specialized educator workflows for reviewing automatically extracted questions, auditing distractor explanations, resolving ambiguity flags, accruing audit points, and requesting gift card / cash payout redemptions.

- `src/pages/TeacherPage.tsx`:
  - Dedicated educator workspace guarded by `allowedRoles={[UserRole.TEACHER]}`.
  - Renders `TeacherSidebar` and manages tabbed views: Overview, Review Queue, Task Detail, Points Ledger, and Rewards Catalog.
- `src/components/teacher/TeacherSidebar.tsx` & `TeacherTopNav.tsx`:
  - Navigation drawer and top navbar displaying accumulated points balance, audit accuracy badges, and profile switcher.
- `src/components/teacher/views/TeacherOverviewView.tsx`:
  - Educator dashboard showing lifetime reviews completed, pending review queue size, and audit quality score.
- `src/components/teacher/views/ReviewQueueView.tsx`:
  - Filterable table of questions flagged by the deterministic OCR pipeline or reported by students for human review.
- `src/components/teacher/views/ReviewTaskDetailView.tsx`:
  - Detailed split-screen audit view: raw PDF snippet on the left, editable question stem, options, and explanation on the right.
- `src/components/teacher/views/PointsView.tsx`:
  - Ledger of review points earned per approved question, corrections submitted, and quality bonuses.
- `src/components/teacher/views/RewardsView.tsx`:
  - Catalog of redemption rewards (books, subscriptions, digital gift cards) with instant point redemption submission.
- `src/services/teacherService.ts`:
  - `fetchReviewTasks(onlyFlagged)`: Queries pending HITL queue via `/api/v1/review/pending`.
  - `fetchReviewTaskDetail(questionId)`: Fetches question tree, asset crops, and OCR bounding boxes.
  - `approveReviewTask(questionId, payload)`: Approves question and awards review points.
  - `rejectReviewTask(questionId, reason, notes)`: Flags question for re-extraction.
  - `fetchMyPoints()`, `fetchMyRewards()`, `grantTeacherReward()`: Points and reward balance clients.
  - `fetchTeacherLeaderboard()`: Top educator audit ranking.

---

## Domain 13: Administrator Portal & Content Management

### 13.1 Module Architecture & File Catalog

This domain provides platform administrators and content operators with tools to ingest raw exam papers (PDFs), manage OCR extraction pipelines, audit question catalogs, configure syllabus taxonomy links, manage exam types, and monitor server diagnostics.

- `src/pages/AdminPage.tsx`:
  - Master administrative console. Guarded by `allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}`.
  - Houses sub-views: Overview, Exam Upload, Pipeline Health, Question Review, Question Bank, Missing Questions, Exam Types, Mock Series, Notifications, Current Affairs, Teacher Rewards, and Diagnostics.
- `src/components/admin/AdminSidebar.tsx`, `AdminTopNav.tsx`, `AdminTabNav.tsx`:
  - Navigation infrastructure for admin console sub-views.
- `src/components/admin/ExamUploadForm.tsx`:
  - Drag-and-drop PDF paper and answer key uploader with conflict resolution modal integration (`useExamUpload`).
- `src/components/admin/views/ExamPipelineStatusView.tsx`:
  - Real-time pipeline monitoring table displaying active extraction runs, OCR stages, stuck pipeline alarms, and re-run triggers.
- `src/components/admin/views/QuestionReviewView.tsx` & `UploadReviewView.tsx`:
  - Detailed audit view for newly extracted questions before promoting them to active status.
- `src/components/admin/views/ExamTypesManager.tsx`:
  - CRUD interface for configuring exam types (total marks, positive/negative marks, duration, question count).
- `src/components/admin/views/MissingQuestionsView.tsx` & `modals/AddMissingQuestionModal.tsx`:
  - Identifies skipped question numbers in sequential exam papers and allows manual question insertion.
- `src/components/admin/views/ThemeSettingsView.tsx`:
  - Runtime UI theme switcher invoking `siteSettingsService.updateActiveTheme()`.
- `src/services/adminService.ts` (39 functions):
  - Ingestion, review cache invalidation, pipeline restart/stop, S3 artifact synchronization, question CRUD, and exam integrity checks.
- `src/services/examTypeService.ts` (5 functions):
  - Exam type metadata management (`fetchActiveExamTypes`, `adminCreateExamType`, `adminUpdateExamType`, `adminDeleteExamType`).

---

## Domain 14: SuperAdmin Governance, RBAC & Platform Diagnostics

### 14.1 Module Architecture & File Catalog

This domain manages privileged platform governance, reviewing and approving administrative account applications, editing dynamic Role-Based Access Control (RBAC) permission matrices, inspecting security audit logs, moderating student testimonials, and reviewing infrastructure health stats.

- `src/pages/SuperAdminPage.tsx`:
  - SuperAdmin control center guarded strictly by `allowedRoles={[UserRole.SUPER_ADMIN]}`.
  - Coordinates tabbed views: Pending Approvals, Active Admins, All Users, Roles & Permissions, Testimonial Approvals, and Audit Logs.
- `src/components/superadmin/SuperAdminSidebar.tsx` & `SuperAdminTopNav.tsx`:
  - High-privilege navigation drawer and system status bar.
- `src/components/superadmin/SuperAdminStats.tsx`:
  - Platform health overview showing active students, pending admin applications, AWS RDS database latency, and Redis connectivity.
- `src/components/superadmin/PendingApprovalsTab.tsx`:
  - Approval queue for educator and admin registration requests with one-click approve or reject modal actions.
- `src/components/superadmin/ActiveAdminsTab.tsx`:
  - Directory of active administrators with suspend/reactivate switches and role revision controls.
- `src/components/superadmin/AllUsersTab.tsx`:
  - Global user directory supporting keyword search, role filtering, status modification, and custom role assignments.
- `src/components/superadmin/RolesPermissionsTab.tsx`:
  - Dynamic RBAC editor. Allows superadmins to create custom roles and toggle granular permission checkboxes.
- `src/components/superadmin/TestimonialApprovalsTab.tsx`:
  - Moderation queue for candidate success stories submitted from the student dashboard before appearing on the public landing page.
- `src/components/superadmin/AuditLogsTab.tsx`:
  - Immutable audit trail viewer recording all administrative privilege grants, rejections, suspensions, and role changes.
- `src/components/superadmin/RejectionModal.tsx`:
  - Dialog prompting for formal rejection reason notes when denying administrative requests.
- `src/services/rolesService.ts` (6 functions):
  - Dynamic RBAC client (`fetchPermissions`, `fetchRoles`, `createRole`, `updateRole`, `deleteRole`, `updateUserRoleAssignment`).

---

## Domain 15: Design System, Theming Engine & Global UI Tokens

### 15.1 Module Architecture & File Catalog

This domain specifies RankEdge's design system, typography hierarchy, responsive layout rules, animation tokens, and multi-theme runtime architecture.

- `src/styles/index.css`:
  - Master CSS design tokens:
    - Typography: `--font-display: "Outfit"`, `--font-body: "DM Sans"`, `--font-mono: "DM Mono"`.
    - Primary Color System: `--primary-red`, `--primary-red-rgb`, `--primary-red-hover`, `--primary-red-light`.
    - Dark Navy & Ink Slate: `--navy: #172033`, `--slate: #111111`, `--border: #E2E8F0`.
    - Functional Accents: Success Green (`#3A8B53`), Info Teal (`#199EAE`), Saffron Orange (`#F47B35`).
    - Responsive Grid & Container utilities.
- `src/styles/themes.css`:
  - Multi-theme attribute selectors modifying primary tokens at runtime:
    - `[data-theme='royal']`: Rich purple accent (`#7C3AED`) and lavender tints.
    - `[data-theme='ocean']`: Cyan blue accent (`#0284C7`) and sky tints.
    - `[data-theme='forest']`: Emerald green accent (`#059669`) and mint tints.
- `src/contexts/ThemeContext.tsx`:
  - Context provider applying `data-theme` attribute to `document.documentElement`, syncing with `localStorage: site_theme`, and fetching active theme from `/api/v1/site-settings/theme/active`.
- `src/constants/theme.ts`:
  - JavaScript color constant dictionary `C` referencing CSS variables for dynamic inline styles.
- `src/components/common/GlobalThemeToggle.tsx`:
  - Floating action button allowing immediate cycle through all 4 themes.
- `src/components/common/Skeleton.tsx` & `Skeleton.css`:
  - Shimmer animations for card, text line, avatar, and metric block placeholders.
- `src/components/common/StatusBadge.tsx`:
  - Standardized chip component rendering colored badges for statuses (`ACTIVE`, `PENDING`, `ANSWERED`, `MARKED`).
- `src/components/common/UserAvatar.tsx`:
  - Avatar component with initials fallback and profile image error handling.

---

## Domain 16: API Guarding, Adaptive Polling & Client Utilities

### 16.1 Module Architecture & File Catalog

This domain implements client-side resilience, request deduplication, mutation concurrency locking, non-linear polling, and formatting utilities.

- `src/utils/apiGuard.ts`:
  - `guardedFetch(input, init)`:
    - **GET Deduplication:** Maintains `inFlightGetRequests` map. Identical in-flight GET requests receive a cloned response promise (`res.clone()`), completely eliminating duplicate requests caused by React component re-renders.
    - **Mutation Serialization:** Maintains `endpointLocks` promise map. Serializes identical overlapping mutating calls so that subsequent requests wait strictly for prior executions to resolve.
  - `createSingleInFlightRunner()`: Concurrency controller ensuring only a single asynchronous loop is active at any time.
- `src/utils/adaptivePolling.ts`:
  - `createAdaptivePoller(taskFn, options)`: Non-linear polling controller implementing 5 distinct phases (Warm-up -> Active Ramp-up -> Mid-run Backoff -> Near-completion Acceleration -> Idle).
- `src/utils/guestStorage.ts`:
  - Manages trial test state in `localStorage: rankedge_guest_attempts`.
- `src/utils/formatEnum.ts`:
  - Formats snake_case and database enum tokens into clean Title Case while preserving 24+ civil services acronyms (UPSC, CSE, GS, CSAT, PYQ, IRT, ICRS, SATOI, GTI, OEEI, OSRI, NCERT).
- `src/hooks/useBreakpoint.ts`:
  - Responsive screen width tracker using `useSyncExternalStore` matching CSS breakpoints (xs: 0, sm: 391, md: 768, lg: 1024, xl: 1280, 2xl: 1536).
- `src/hooks/useMinimumLoadingTime.ts`:
  - Anti-flicker hook guaranteeing loading state stays true for a minimum 400ms duration.
- `src/hooks/useExamUpload.ts`:
  - Encapsulates exam PDF upload logic, conflict detection modal state, and cache invalidation.

### 16.2 Complete Service Layer Catalog (13 Services / 152 Functions)

#### Service: `adminService.ts` (39 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchPendingAdminRequests` | `None` | `Promise<AdminApprovalRequest[]>` |
| `fetchActiveAdmins` | `None` | `Promise<AdminApprovalRequest[]>` |
| `approveAdminRequest` | `userId: number \| string` | `Promise<User>` |
| `rejectAdminRequest` | `userId: number \| string, reason?: string` | `Promise<User>` |
| `suspendAdmin` | `userId: number \| string` | `Promise<User>` |
| `reactivateAdmin` | `userId: number \| string` | `Promise<User>` |
| `fetchAuditLogs` | `None` | `Promise<AdminApprovalLog[]>` |
| `fetchSystemStats` | `None` | `Promise<SystemStats>` |
| `fetchPlatformUsers` | `None` | `Promise<UserDirectoryItem[]>` |
| `updateUserRole` | `userId: number \| string, newRole: string` | `Promise<User>` |
| `fetchAllUsers` | `None` | `Promise<User[]>` |
| `fetchUserById` | `userId: number \| string` | `Promise<User>` |
| `updateUserStatus` | `userId: number \| string, status: 'ACTIVE' \| 'SUSPENDED'` | `Promise<User>` |
| `fetchPipelineStatus` | `examId: number \| string` | `Promise<any>` |
| `stopPipelineTask` | `examId: number \| string` | `Promise<any>` |
| `restartPipelineTask` | `examId: number \| string, language: string = 'ENGLISH'` | `Promise<any>` |
| `retryPipelineTask` | `examId: number \| string, language: string = 'ENGLISH'` | `Promise<any>` |
| `fetchExamPipelineStatuses` | `None` | `Promise<ExamPipelineStatusItem[]>` |
| `fetchStuckPipelines` | `None` | `Promise<StuckPipelineItem[]>` |
| `resumeExamPipeline` | `examId: number \| string` | `Promise<any>` |
| `dismissStuckPipeline` | `examId: number \| string` | `Promise<any>` |
| `approveAndPublishExam` | `examId: number \| string` | `Promise<any>` |
| `approveAllQuestions` | `examId: number \| string` | `Promise<any>` |
| `syncExamToS3` | `examId: number \| string,   syncAll: boolean = false,   syncTarget: 'MASTERS_ONLY' \| 'QUESTIONS_MASTER' \| 'SOLUTIONS_MASTER' \| 'FULL_ALL' = 'MASTERS_ONLY'` | `Promise<any>` |
| `fetchExamSyncStatus` | `examId: number \| string` | `Promise<ExamSyncStatusResponse>` |
| `invalidateExamReviewCache` | `examId?: number \| string` | `void` |
| `fetchExamQuestionsForReview` | `examId: number \| string,   page: number = 1,   limit: number = 10,   status?: string` | `Promise<ExamReviewQuestionsResponse>` |
| `fetchQuestionsByExam` | `examId: number \| string, page: number = 1, limit: number = 100, status?: string` | `Promise<any>` |
| `updateAdminQuestionDetail` | `questionId: number \| string, payload: any` | `Promise<any>` |
| `updateAdminQuestionStatus` | `questionId: number \| string, status: string` | `Promise<any>` |
| `fetchCatalogQuestions` | `page: number = 1,   limit: number = 20,   subjectName?: string,   status?: string` | `Promise<any>` |
| `fetchAdminOverviewStats` | `None` | `Promise<AdminOverviewStats>` |
| `createAdminQuestion` | `payload: QuestionCreatePayload` | `Promise<any>` |
| `clearExamIntegrityCache` | `None` | `void` |
| `fetchExamIntegrityQuestions` | `examId: string \| number,   issueType?: string,   page: number = 1,   limit: number = 250,   forceRefresh: boolean = false` | `Promise<ExamIntegrityQuestionsResponse>` |
| `fetchExamsByYear` | `forceRefresh: boolean = false` | `Promise<any>` |
| `fetchMasterSyllabus` | `examId?: string \| number` | `Promise<any>` |
| `verifySyllabusTaxonomy` | `subject: string, topic: string, subtopic: string` | `Promise<any>` |
| `fetchPlatformAnalytics` | `timeRange: string = '30d', examFilter: string = 'ALL'` | `Promise<PlatformAnalyticsData>` |

#### Service: `analyticsService.ts` (3 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchPredictedRank` | `None` | `Promise<PredictedRankResponse>` |
| `fetchMonthlyBenchmark` | `overrideToken?: string,   options?: { signal?: AbortSignal; forceRefresh?: boolean }` | `Promise<MonthlyBenchmarkResponse>` |
| `invalidateMonthlyBenchmarkCache` | `None` | `void` |

#### Service: `authService.ts` (9 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `syncGuestSessionsOnAuth` | `token: string` | `Promise<string \| null>` |
| `loginUser` | `email: string, password: string, role?: UserRole` | `Promise<AuthResponse>` |
| `registerUser` | `email: string,   password: string,   fullName: string,   role: UserRole = UserRole.STUDENT,   organizationName?: string,   department?: string` | `Promise<AuthResponse>` |
| `logoutUser` | `None` | `void` |
| `fetchCurrentUser` | `customToken?: string` | `Promise<any>` |
| `updateUserProfile` | `updateData: { full_name?: string; profile_image?: string }, customToken?: string` | `Promise<any>` |
| `verifyEmail` | `token: string` | `Promise<any>` |
| `forgotPassword` | `email: string` | `Promise<void>` |
| `resetPassword` | `token: string, newPassword: string` | `Promise<void>` |

#### Service: `bookmarkService.ts` (4 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `invalidateBookmarksClientCache` | `None` | `void` |
| `listBookmarks` | `options?: {   forceRefresh?: boolean;   limit?: number;   skip?: number;   signal?: AbortSignal; }` | `Promise<BookmarkItem[]>` |
| `addBookmark` | `questionId: number \| string` | `Promise<void>` |
| `removeBookmark` | `questionId: number \| string` | `Promise<void>` |

#### Service: `challengeService.ts` (13 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `createChallenge` | `payload: CreateChallengePayload` | `Promise<ChallengeSummary>` |
| `listMyChallenges` | `None` | `Promise<ChallengeSummary[]>` |
| `getChallenge` | `challengeId: number \| string` | `Promise<ChallengeSummary>` |
| `getPublicChallengePreview` | `shareToken: string` | `Promise<ChallengePublicPreview>` |
| `inviteUserToChallenge` | `challengeId: number, email: string` | `Promise<void>` |
| `getLeaderboard` | `challengeId: number \| string` | `Promise<LeaderboardEntry[]>` |
| `startChallengeAttempt` | `idOrToken: string` | `Promise<StartChallengeAttemptResponse>` |
| `saveChallengeResponse` | `attemptId: number,   questionId: number,   selectedOptionId: number \| null,   timeSpentSeconds: number` | `Promise<void>` |
| `submitChallengeAttempt` | `attemptId: number` | `Promise<SubmitChallengeAttemptResponse>` |
| `formatChallengeExpiry` | `expiresAt?: string \| null` | `string \| null` |
| `isChallengeExpired` | `expiresAt?: string \| null` | `boolean` |
| `fetchSubjectNames` | `None` | `Promise<string[]>` |
| `lookupUserByEmail` | `email: string` | `Promise<UserLookupResult \| null>` |

#### Service: `examService.ts` (32 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `uploadExamPaper` | `{   examName,   year,   paperType,   set_code = 'SET_A',   exam_type,   exam_type_id,   conflict_resolution,   file, }: UploadExamPayload & { set_code?: string }` | `Promise<UploadExamResponse>` |
| `uploadAnswerKey` | `{   examName,   year,   set_code,   file, }: {   examName: string;   year: string;   set_code: string;   file: File;   conflict_resolution?: string; }` | `Promise<UploadExamResponse>` |
| `startExamAttempt` | `payload: StartExamRequest` | `Promise<StartExamResponse>` |
| `getQuestionByNumber` | `attemptId: number \| string,   questionNumber: number,   language: string = 'ENGLISH'` | `Promise<QuestionNavResponse>` |
| `saveQuestionResponse` | `attemptId: number \| string,   payload: SaveResponseRequest` | `Promise<SaveResponseResponse>` |
| `revealQuestionAnswer` | `attemptId: number \| string,   questionId: number \| string` | `Promise<RevealAnswerResponse>` |
| `sendExamHeartbeat` | `attemptId: number \| string,   payload: HeartbeatRequest` | `Promise<HeartbeatResponse>` |
| `getExamAttemptStatus` | `attemptId: number \| string` | `Promise<ExamStatusResponse>` |
| `submitExamAttempt` | `attemptId: number \| string,   payload: SubmitExamRequest = { submission_reason: 'USER_CLICKED_SUBMIT' }` | `Promise<SubmitExamResponse>` |
| `getAttemptResult` | `attemptId: number \| string` | `Promise<SubmitExamResponse>` |
| `getPsychometricReportJson` | `attemptId: number \| string` | `Promise<PsychometricReport>` |
| `listExams` | `status?: string, includeInactive: boolean = false, customToken?: string` | `Promise<ExamItem[]>` |
| `formatCanonicalExamTitle` | `exam: ExamItem` | `string` |
| `listCandidateAttempts` | `options?: { page?: number; limit?: number; status?: string; customToken?: string } \| string` | `Promise<AttemptHistoryItem[]>` |
| `getAttemptStatusByExam` | `customToken?: string` | `Promise<Record<string, ExamAttemptStatusEntry>>` |
| `getAllAttemptQuestionsBulk` | `attemptId: number \| string,   language: string = 'ENGLISH',   presignedUrl?: string \| null` | `Promise<any>` |
| `prefetchQuestion` | `attemptId: number \| string, qNum: number, lang: string = 'ENGLISH'` | `Promise<void>` |
| `saveQuestionResponsesBatch` | `attemptId: number \| string, payload: any` | `Promise<any>` |
| `getResponseBatchStatus` | `attemptId: number \| string, batchId: string` | `Promise<any>` |
| `getAttemptEvaluationStatus` | `attemptId: number \| string` | `Promise<any>` |
| `retryAttemptEvaluation` | `attemptId: number \| string` | `Promise<any>` |
| `pollAttemptReportUntilReady` | `attemptId: number \| string,   onUpdate: (status: any` | `void` |
| `getAttemptQuestionReport` | `attemptId: number \| string` | `Promise<any>` |
| `getAttemptUserProgressionReport` | `attemptId: number \| string` | `Promise<any>` |
| `getUserCumulativeAggregateReport` | `userId?: number \| string` | `Promise<any>` |
| `fetchMasterSyllabus` | `examId?: number \| string` | `Promise<any>` |
| `fetchExamsByYear` | `None` | `Promise<any>` |
| `verifySyllabusNode` | `payload: { subject?: string; topic?: string; subtopic?: string }` | `Promise<any>` |
| `fetchExamSyllabusTree` | `examId: number \| string` | `Promise<any>` |
| `fetchExamIntegrityQuestions` | `examId: string, status?: string` | `Promise<any>` |
| `bulkAddStudyTasksFromReport` | `payload: {   attempt_id: string;   tasks: any[]; }` | `Promise<any>` |
| `getAttemptScheduledTasksStatus` | `attemptId: string` | `Promise<` |

#### Service: `examTypeService.ts` (5 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchActiveExamTypes` | `None` | `Promise<ExamType[]>` |
| `adminFetchExamTypes` | `includeInactive: boolean = true` | `Promise<ExamType[]>` |
| `adminCreateExamType` | `payload: ExamTypeCreatePayload` | `Promise<ExamType>` |
| `adminUpdateExamType` | `id: number,   payload: ExamTypeUpdatePayload` | `Promise<ExamType>` |
| `adminDeleteExamType` | `id: number` | `Promise<` |

#### Service: `notificationService.ts` (9 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `adminListNotifications` | `params: {   page?: number;   limit?: number;   status?: string; }` | `Promise<NotificationListResponse>` |
| `adminGetNotification` | `id: number` | `Promise<BroadcastNotification>` |
| `adminCreateNotification` | `payload: CreateNotificationPayload,` | `Promise<BroadcastNotification>` |
| `adminUpdateNotification` | `id: number,   payload: UpdateNotificationPayload,` | `Promise<BroadcastNotification>` |
| `adminPublishNotification` | `id: number` | `Promise<BroadcastNotification>` |
| `adminRejectNotification` | `id: number` | `Promise<BroadcastNotification>` |
| `adminDeleteNotification` | `id: number` | `Promise<` |
| `fetchPublishedNotifications` | `params: {   page?: number;   limit?: number;   contentType?: string;   date?: string; }` | `Promise<NotificationListResponse &` |
| `fetchNotificationDetail` | `id: number` | `Promise<BroadcastNotification>` |

#### Service: `rolesService.ts` (6 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchPermissions` | `None` | `Promise<Permission[]>` |
| `fetchRoles` | `None` | `Promise<Role[]>` |
| `createRole` | `payload: {   name: string;   base_role_type: string;   description?: string;   permission_keys: string[]; }` | `Promise<Role>` |
| `updateRole` | `roleId: number,   payload: { name?: string; description?: string; permission_keys?: string[] }` | `Promise<Role>` |
| `deleteRole` | `roleId: number` | `Promise<void>` |
| `updateUserRoleAssignment` | `userId: number \| string, roleId: number` | `Promise<User>` |

#### Service: `siteSettingsService.ts` (2 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchActiveTheme` | `None` | `Promise<ThemeSettings>` |
| `updateActiveTheme` | `themeName: string` | `Promise<ThemeSettings>` |

#### Service: `studyPlannerService.ts` (15 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchWeeklySchedule` | `startDate?: string` | `Promise<WeeklyScheduleResponse>` |
| `fetchStudyTasks` | `None` | `Promise<StudyTaskItem[]>` |
| `createStudyTask` | `payload: CreateTaskPayload` | `Promise<any>` |
| `updateStudyTask` | `taskId: string, payload: Partial<CreateTaskPayload>` | `Promise<any>` |
| `deleteStudyTask` | `taskId: string` | `Promise<any>` |
| `completeStudyTask` | `taskId: string` | `Promise<any>` |
| `bulkAddTasksFromReport` | `attemptId: string, tasks: any[]` | `Promise<any>` |
| `logStudyActivity` | `payload: LogActivityPayload` | `Promise<any>` |
| `fetchStudyActivities` | `None` | `Promise<StudyActivityItem[]>` |
| `deleteStudyActivity` | `activityId: string` | `Promise<any>` |
| `fetchStudyActivitiesSummary` | `None` | `Promise<StudySummaryResponse>` |
| `generateWeeklyStudyPlan` | `startDate?: string, overwriteExisting: boolean = false` | `Promise<any>` |
| `sendPendingTasksEmail` | `None` | `Promise<any>` |
| `fetchWeeklyInsights` | `startDate?: string,   options?: { signal?: AbortSignal; forceRefresh?: boolean }` | `Promise<WeeklyInsightsResponse>` |
| `invalidateWeeklyInsightsCache` | `startDate?: string` | `void` |

#### Service: `teacherService.ts` (9 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchReviewTasks` | `onlyFlagged = false` | `Promise<HumanReviewTaskSummary[]>` |
| `fetchReviewTaskDetail` | `questionId: number \| string` | `Promise<any>` |
| `approveReviewTask` | `questionId: number \| string,   payload: { reviewer_notes?: string; correct_option_label?: string } = {}` | `Promise<any>` |
| `rejectReviewTask` | `questionId: number \| string,   rejectionReason: string,   reviewerNotes?: string` | `Promise<any>` |
| `fetchMyPoints` | `None` | `Promise<TeacherPointsSummary>` |
| `fetchMyRewards` | `None` | `Promise<TeacherReward[]>` |
| `fetchTeacherLeaderboard` | `None` | `Promise<TeacherLeaderboardEntry[]>` |
| `fetchTeacherRewardHistory` | `teacherId: number \| string` | `Promise<TeacherReward[]>` |
| `grantTeacherReward` | `teacherId: number \| string,   payload: { title: string; description?: string; points_value?: number }` | `Promise<TeacherReward>` |

#### Service: `testimonialService.ts` (6 functions)

| Function / Method Name | Parameters | Return Type |
|------------------------|------------|-------------|
| `fetchApprovedTestimonials` | `None` | `Promise<TestimonialItem[]>` |
| `submitTestimonial` | `payload: {   quote: string;   user_exam: string;   rating?: number; }` | `Promise<TestimonialItem>` |
| `fetchAllTestimonialsForAdmin` | `None` | `Promise<TestimonialItem[]>` |
| `approveTestimonial` | `id: number \| string` | `Promise<TestimonialItem>` |
| `rejectTestimonial` | `id: number \| string, reason?: string` | `Promise<TestimonialItem>` |
| `deleteTestimonial` | `id: number \| string` | `Promise<` |


---

# PART C: CONVENTIONS, ARCHITECTURAL PATTERNS & GUARDRAILS

To ensure that any subsequent frontend code modification or feature addition adheres strictly to established architectural standards, the following 8 patterns MUST be followed:

### 1. Dual Authentication Synchronization Pattern (`syncGuestSessionsOnAuth`)
- **Location:** `src/services/authService.ts`
- **Pattern:** Any authentication trigger (login, signup, password reset completion) MUST invoke `syncGuestSessionsOnAuth(token)`.
- **Mechanism:** Reads unauthenticated attempts from `localStorage: rankedge_guest_attempts`, transmits them via `POST /api/v1/attempts/sync-guest-sessions`, purges the local storage key on success, and stores `sessionStorage: latest_synced_attempt_id` to allow immediate redirection to the candidate's newly reassigned scorecard.

### 2. Central In-Flight Request Deduplication & Serialization Pattern (`guardedFetch`)
- **Location:** `src/utils/apiGuard.ts`
- **Pattern:** High-frequency, poll-heavy, or mutation-critical service methods MUST call `guardedFetch(url, init)` rather than raw browser `fetch()`.
- **Guardrail:**
  - GET requests share active promises using `inFlightGetRequests` and return cloned responses (`res.clone()`), eliminating duplicate network calls caused by React StrictMode or concurrent child component mounts.
  - Mutating calls (POST, PUT, PATCH, DELETE) to the same resource are serialized via `endpointLocks`, preventing race conditions during rapid option switching or telemetry auto-saving.

### 3. Non-Linear Adaptive Polling Curve Pattern (`createAdaptivePoller`)
- **Location:** `src/utils/adaptivePolling.ts`
- **Pattern:** Long-running background jobs (PDF extraction progress, psychometric AI report compilation) must not use rigid `setInterval()` loops. Instead, use `createAdaptivePoller`:
  - **Phase 1 (Warm-Up):** 8000ms delay to allow server worker queues to initialize.
  - **Phase 2 (Active Ramp-Up):** Decreases (8s -> 6s -> 4s -> 3s) for responsive progress visualization.
  - **Phase 3 (Mid-Run Backoff):** Increases (3s -> 4.2s -> 6s -> 12s -> 30s) if the task runs long, sparing backend resources.
  - **Phase 4 (Near-Completion):** If progress reaches >=80%, interval drops back down to <=3500ms to immediately detect job completion.

### 4. Anti-Flicker Minimum Loading Duration Pattern (`useMinimumLoadingTime`)
- **Location:** `src/hooks/useMinimumLoadingTime.ts`
- **Pattern:** Any skeleton loader or loading spinner tied to network fetching should be wrapped with `useMinimumLoadingTime(isFetching, 400)`.
- **Guardrail:** When API responses resolve in <50ms (e.g. from fast Redis caches or local memory), un-debounced skeletons flash momentarily on screen, producing visual jitter. This hook guarantees a minimum 400ms display time for smooth visual transitions.

### 5. Dynamic Multi-Theme Switching Pattern (`data-theme` & CSS Custom Properties)
- **Location:** `src/contexts/ThemeContext.tsx`, `src/styles/themes.css`
- **Pattern:** Components MUST NOT hardcode color values. All colors must reference CSS variables (`var(--primary-red)`, `var(--navy)`, `var(--slate)`) or JavaScript constant `C` from `src/constants/theme.ts`.
- **Guardrail:** The active theme is controlled via `document.documentElement.setAttribute('data-theme', themeName)`. Theme modifications must be persisted to `localStorage: site_theme` and synchronized with `/api/v1/site-settings/theme/active`.

### 6. Responsive Breakpoint Synchronizer (`useBreakpoint`)
- **Location:** `src/hooks/useBreakpoint.ts`
- **Pattern:** Responsive component branching (e.g. collapsing sidebars into bottom sheets on mobile) must use `useBreakpoint()` instead of ad-hoc `window.innerWidth` resize event listeners.
- **Guardrail:** Implements React 18's `useSyncExternalStore` with cached `window.matchMedia()` queries matching exact CSS media query boundaries (xs: 0, sm: 391, md: 768, lg: 1024, xl: 1280, 2xl: 1536), eliminating hydration mismatches and layout thrashing.

### 7. Optimistic UI Updates & Cross-Component Event Bus
- **Location:** `src/services/authService.ts`
- **Pattern:** When a shared entity (such as user profile or theme) is modified inside a deep child modal or settings tab without a global Redux/Zustand store, the modifying service dispatches a custom browser event:
  ```typescript
  window.dispatchEvent(new Event('user_profile_updated'));
  ```
- **Guardrail:** Top-level headers (`StudentTopHeader`, `Navbar`, `StudentSidebar`) attach event listeners to `window` in `useEffect` and refresh their local state without triggering full-page reloads.

### 8. Real-Time Telemetry & Proctoring Heartbeat Pattern
- **Location:** `src/pages/ExamEnginePage.tsx`, `src/services/examService.ts`
- **Pattern:** During active exam attempts, the client maintains a 30-second interval sending `sendExamHeartbeat(attemptId, { remaining_time_seconds, active_question_id })`.
- **Guardrail:** If the backend returns `auto_submitted: true` or `status: 'TIMED_OUT'`, the exam engine immediately terminates client-side timers, locks all option selection inputs, and navigates to the submission scorecard.

---

# PART D: AMBIGUITIES, ARCHITECTURAL DEBT & ITEMS REQUIRING VERIFICATION

The following items represent architectural areas where frontend implementation details are in transition, dependent on external environment settings, or require verification before making modifications:

### 1. Monolithic State Architecture vs Global State Store
- **Code Reference:** `src/pages/DashboardPage.tsx`, `src/pages/ExamEnginePage.tsx`
- **Finding:** The application currently relies entirely on React local component state (`useState`), custom contexts (`ThemeContext`), and browser storage (`localStorage`, `sessionStorage`) rather than a centralized state container (such as Zustand or Redux Toolkit).
- **Status:** **Architectural Trade-Off.** While this keeps the bundle lightweight, deep component trees (e.g. `ExamEnginePage` passing props through `ExamQuestionCard`, `ExamQuestionPalette`, and `ExamSectionSidebar`) experience prop drilling and localized state lifting. Future complex offline sync capabilities would benefit from a lightweight Zustand store.

### 2. Silent Token Refresh for Custom Backend JWT
- **Code Reference:** `src/services/authService.ts`, `src/components/common/ProtectedRoute.tsx`
- **Finding:** While Clerk manages token refreshing automatically, the custom backend JWT implementation stores `access_token` in `localStorage` without a background timer or Axios/fetch interceptor to exchange refresh tokens prior to expiration.
- **Status:** **Security / UX Debt.** If an active candidate remains in an exam session beyond the token expiration window (e.g. 24 hours), subsequent telemetry calls may receive HTTP 401. A proactive refresh mechanism or 401 interceptor that clears credentials and redirects cleanly is recommended.

### 3. Subscription Checkout Webhook & Payment Gateway UI
- **Code Reference:** `src/pages/PricingPage.tsx`, `apps/backend/app/db/models/subscription.py`
- **Finding:** The `PricingPage` presents tier comparison cards (`Free`, `Pro`, `Annual`), but clicking "Upgrade" currently routes to signup/login or displays informational dialogs rather than opening a Razorpay or Stripe checkout modal.
- **Status:** **Pending Integration.** The backend database schemas (`subscription_plans`, `user_subscriptions`) are ready, but the payment gateway SDK (e.g. `RazorpayCheckout`) and webhook handling have not yet been wired into the frontend build.

### 4. Mathematical Equation & LaTeX Rendering in Questions
- **Code Reference:** `src/components/exam/ExamQuestionCard.tsx`, `src/components/exam/QuestionSolutionMarkdownCard.tsx`
- **Finding:** Exam questions and explanations are rendered using `react-markdown` with `remark-gfm`. However, advanced mathematical notations (LaTeX `$$...$$` and inline `$...$`) require a TeX engine (such as `rehype-katex` or `remark-math`) to render complex equations natively.
- **Status:** **Needs Verification.** Verify whether current civil services question papers rely strictly on pre-rendered SVG/PNG diagram crops or if native LaTeX parsing plugins need to be added to `react-markdown`.

### 5. Production Vendor Chunking & Bundle Size Optimization
- **Code Reference:** `apps/frontend/vite.config.ts`, `apps/frontend/package.json`
- **Finding:** `vite.config.ts` does not explicitly configure `build.rollupOptions.output.manualChunks`. Consequently, large vendor dependencies (`recharts`, `@clerk/clerk-react`, `lucide-react`) may be bundled into monolithic chunks.
- **Status:** **Performance Optimization.** In slower 3G mobile networks across regional India, splitting `recharts` and `@clerk/clerk-react` into dedicated vendor chunks will improve First Contentful Paint (FCP) and Time to Interactive (TTI).

---
*End of Frontend High-Level Design (HLD) & Low-Level Design (LLD) Document.*
