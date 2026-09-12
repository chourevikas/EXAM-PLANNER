# Full-Stack Cleanup Report
**Generated:** 2026-09-12  
**Scope:** `apps/backend/` · `apps/frontend/` · root-level scripts  
**Methodology:** Static import-graph traversal + grep-based cross-reference verification  
**Rule:** Nothing in "SAFE TO DELETE" sections was deleted — this is an analysis-only pass.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Backend — Safe to Delete](#2-backend--safe-to-delete)
3. [Backend — Flagged / Possibly Dead (Do Not Delete Yet)](#3-backend--flagged--possibly-dead-do-not-delete-yet)
4. [Frontend — Safe to Delete](#4-frontend--safe-to-delete)
5. [Frontend — Flagged / Possibly Dead (Do Not Delete Yet)](#5-frontend--flagged--possibly-dead-do-not-delete-yet)
6. [Dependency Audit — Backend pyproject.toml](#6-dependency-audit--backend-pyprojecttoml)
7. [Dependency Audit — Frontend package.json](#7-dependency-audit--frontend-packagejson)
8. [Root-Level Orphaned Scripts](#8-root-level-orphaned-scripts)
9. [The 410-GONE Stub Decision](#9-the-410-gone-stub-decision)
10. [Quantified Impact Summary](#10-quantified-impact-summary)

---

## 1. Executive Summary

| Category | Safe to Delete | Flagged / Unsure | Total Examined |
|---|---|---|---|
| Backend Python files | **3** | **2** | ~180 |
| Backend service functions | **1** | **3** | ~200 |
| Frontend component files | **3** | **2** | ~60 |
| Frontend service functions | **0** | **2** | ~152 |
| Backend PyPI packages | **0** | **2** | 42 |
| Frontend npm packages | **0** | **1** | 15 |
| Root-level scripts | **6** | **0** | 6 |

> **KEY FINDING:** The old non-deterministic LLM multi-agent pipeline has **already been fully replaced**. The current `app/pipeline/` contains only the live deterministic pipeline (`DoclingOcrExtractor` + `regex_question_parser` + `batch_processor` + `graph`). Nothing from the old pipeline remains in `app/pipeline/` — except `validator.py` and `taxonomy_resolver.py` below.

---

## 2. Backend — Safe to Delete

### 2.1 `app/pipeline/validator.py`

**File:** `apps/backend/app/pipeline/validator.py`  
**Size:** 1,327 bytes · 38 lines

**Evidence:** The sole exported function `ainvoke_mcq_validator_llm` has **zero callers** outside the file itself.

```
$ grep -rn "ainvoke_mcq_validator_llm" apps/backend/ --include="*.py"
apps/backend/app/pipeline/validator.py:7:async def ainvoke_mcq_validator_llm(
```

The LangGraph node `node_mcq_validator_and_hitl` in `graph.py` performs the validator logic directly via a SQLModel `update()` bulk query — it does **not** import or call this function. This is a dead LLM-based validator superseded when the pipeline switched to the deterministic regex approach.

**Action:** ✅ DELETE `apps/backend/app/pipeline/validator.py`

---

### 2.2 `app/pipeline/taxonomy_resolver.py`

**File:** `apps/backend/app/pipeline/taxonomy_resolver.py`  
**Size:** 54,372 bytes · ~1,500 lines

**Evidence:** Only imported by the test file `test_taxonomy_resolver.py`. Zero production-code imports.

```
$ grep -rn "from app.pipeline.taxonomy_resolver" apps/backend/ --include="*.py"
apps/backend/tests/test_taxonomy_resolver.py:16:from app.pipeline.taxonomy_resolver import (
```

Zero imports from any router, service, or other pipeline module. Part of the old multi-agent orchestration system that resolved taxonomy tags via LLM call chains. Current `batch_processor.py` does its own direct DB taxonomy lookups.

**Action:** ✅ DELETE `apps/backend/app/pipeline/taxonomy_resolver.py`  
Also delete companion test: `apps/backend/tests/test_taxonomy_resolver.py`

---

### 2.3 `app/services/s3_service.py`

**File:** `apps/backend/app/services/s3_service.py`  
**Size:** 3,244 bytes

**Evidence:** The `S3Service` class is re-exported from `app/services/__init__.py` but **never imported in any production code** (routers, services, tasks). The application uses `app.storage.s3` (`S3StorageProvider`) from the storage abstraction layer instead.

```
$ grep -rn "S3Service" apps/backend/ --include="*.py" | grep -v "__init__.py\|s3_service.py"
# → zero results
```

**Note:** `boto3` itself is still needed (SES email in `email_service.py`, AWS secret loader). Only the `S3Service` class wrapper is dead.

**Action:** ✅ DELETE `apps/backend/app/services/s3_service.py`  
Also remove 2-line re-export from `apps/backend/app/services/__init__.py` (lines 4 and 14).

---

## 3. Backend — Flagged / Possibly Dead (Do Not Delete Yet)

### 3.1 `app/formatters/json_exporter.py` — Zero Production Imports

**File:** `apps/backend/app/formatters/json_exporter.py` (14,240 bytes)  
**Evidence:** Zero production-code imports found.

```
$ grep -rn "from app.formatters.json_exporter\|json_exporter" apps/backend/ --include="*.py"
# → zero results
```

**Flag:** Possibly dead — may be used by external tooling not in the repo. Verify before deleting.

---

### 3.2 Legacy schema classes in `app/pipeline/state.py`

After deleting `validator.py`, these classes become test-only or fully orphaned:

| Class | Currently Used By | Verdict |
|---|---|---|
| `PageExtractionPayload` | `dsu_stitcher.py` (active), `batch_processor.py` (active) | KEEP |
| `SeamBlockTypeEnum` | `dsu_stitcher.py` (active) | KEEP |
| `MCQValidationResult` | `validator.py` (dead) + `tests/test_pipeline.py` | DELETE after validator.py |
| `ExtractedQuestionSchema` | Only `tests/test_pipeline.py` | Candidate for removal |
| `ContextMemoryItem` | Only `tests/test_pipeline.py` | Candidate for removal |
| `ContextMemoryTranslationSchema` | Only `tests/test_pipeline.py` | Candidate for removal |
| `LayoutTypeEnum` | Only `tests/test_pipeline.py` | Candidate for removal |
| `ParallelWorkerInput` | Only `tests/test_pipeline.py` | Candidate for removal |

**Flag:** Remove the 6 orphaned classes from `state.py` **after** deleting `validator.py` and confirming the test suite is green.

---

### 3.3 Commented-out S3 presigned URL block

**File:** `apps/backend/app/services/exam_json_builder.py` (~lines 399–412)  
**Evidence:** Comment explicitly states "S3 Presigned URL Fetch Commented Out (DB is single source of truth)."  
**Flag:** Safe inline prune in a future pass. The file itself is active — do not delete.

---

## 4. Frontend — Safe to Delete

### 4.1 `src/components/admin/AdminHeader.tsx`

**File:** `apps/frontend/src/components/admin/AdminHeader.tsx`

**Evidence:** Zero imports across all TSX/TS files. Superseded by `AdminTopNav.tsx`.

```
$ grep -rn "AdminHeader" apps/frontend/src/ | grep -v "AdminHeader.tsx:"
# → zero results
```

**Action:** ✅ DELETE `apps/frontend/src/components/admin/AdminHeader.tsx`

---

### 4.2 `src/components/admin/AdminOverview.tsx`

**File:** `apps/frontend/src/components/admin/AdminOverview.tsx`

**Evidence:** Zero imports. Contains hardcoded fake data ("24 Papers"). The live equivalent is `AdminOverviewView.tsx`.

```
$ grep -rn "AdminOverview\b" apps/frontend/src/
apps/frontend/src/components/admin/AdminOverview.tsx:3:export function AdminOverview() {
```

**Action:** ✅ DELETE `apps/frontend/src/components/admin/AdminOverview.tsx`

---

### 4.3 `src/components/admin/AdminTabNav.tsx`

**File:** `apps/frontend/src/components/admin/AdminTabNav.tsx`

**Evidence:** Zero imports outside the file itself. `AdminPage.tsx` uses `AdminTopNav.tsx` + `AdminSidebar.tsx`.

```
$ grep -rn "AdminTabNav\b" apps/frontend/src/ | grep -v "AdminTabNav.tsx:"
# → zero results
```

**Action:** ✅ DELETE `apps/frontend/src/components/admin/AdminTabNav.tsx`

---

### 4.4 `src/pages/UPDATE questions.sql`

**File:** `apps/frontend/src/pages/UPDATE questions.sql` (97 bytes)

**Evidence:** A stray SQL file inside the React pages directory. Zero references anywhere in the codebase. Development artifact.

**Action:** ✅ DELETE `apps/frontend/src/pages/UPDATE questions.sql`

---

## 5. Frontend — Flagged / Possibly Dead (Do Not Delete Yet)

### 5.1 `src/components/common/MarkdownPreviewer.tsx`

**File:** `apps/frontend/src/components/common/MarkdownPreviewer.tsx`  
**Evidence:** Zero imports in any other TSX/TS file.

```
$ grep -rn "MarkdownPreviewer" apps/frontend/src/
# Only self-references in MarkdownPreviewer.tsx
```

**Flag:** Likely dead — replaced by inline `<ReactMarkdown>` usage. Verify no dynamic import or lazy load before deleting.

---

### 5.2 `src/components/student/PerformanceAnalyticsCharts.tsx`

**File:** `apps/frontend/src/components/student/PerformanceAnalyticsCharts.tsx`  
**Evidence:** Zero imports in any other file. Not mounted anywhere in the component tree.

```
$ grep -rn "PerformanceAnalyticsCharts" apps/frontend/src/
# Only self-definition in PerformanceAnalyticsCharts.tsx
```

**Flag:** Likely dead — chart functionality integrated directly into `DashboardPage.tsx` and `AnalyticsPage.tsx`. Verify no side-effect exports before deleting.

---

## 6. Dependency Audit — Backend pyproject.toml

**File:** `apps/backend/pyproject.toml` (42 declared dependencies)

### All Verified Active (do not remove)

| Package | Primary Usage |
|---|---|
| `fastapi`, `uvicorn` | Server core |
| `sqlmodel`, `sqlalchemy`, `alembic` | ORM + migrations |
| `asyncpg` | PostgreSQL async driver |
| `aiosqlite` | SQLite in-memory test driver |
| `pydantic`, `pydantic-settings` | Schemas, settings |
| `redis` | Cache layer |
| `celery` | Task queue (worker.py + task_registry) |
| `httpx` | HTTP client |
| `bcrypt`, `passlib`, `pyjwt` | Auth |
| `python-multipart` | File upload |
| `fastapi-mail` | Email (SMTP) |
| `svix` | Clerk webhook signature verification |
| `google-cloud-translate`, `google-auth` | Translation service |
| `langchain-core`, `langchain-google-genai` | LLM pipeline + AI report synthesizer |
| `langgraph` | Pipeline graph orchestration |
| `docling` | OCR / document extraction |
| `opencv-python-headless`, `pillow`, `onnxruntime` | Image processing |
| `pypdf`, `pypdfium2` | PDF parsing / page rendering |
| `pdf2image` | Fallback page renderer in `docling_ocr_extractor.py` |
| `pyyaml` | YAML formatters |
| `rapidfuzz` | Fuzzy matching in search / taxonomy |
| `boto3`, `aioboto3` | SES email + S3 storage |
| `aiofiles` | Async file I/O in storage layer |
| `email-validator` | Pydantic email field validation |
| `python-dotenv` | `.env` loading |

### Flagged Packages

**`langchain-openai`** — Used only when `LLM_PROVIDER=openai` is configured (default is `gemini`/`vertexai`). Remove only if OpenAI support is permanently dropped.

**`pytest`** — Listed in production dependencies instead of a dev group. Safe structural fix: move to `[project.optional-dependencies]` or `[dependency-groups]`. No deletion needed.

---

## 7. Dependency Audit — Frontend package.json

**File:** `apps/frontend/package.json` (15 dependencies)

### All Verified Active (do not remove)

| Package | Usage |
|---|---|
| `@clerk/clerk-react` | Auth across 10+ pages |
| `lucide-react` | Icons throughout all components |
| `react`, `react-dom` | Core framework |
| `react-markdown` | 5 components use `<ReactMarkdown>` |
| `remark-gfm` | Companion to `react-markdown` |
| `react-router-dom` | All routing |
| `recharts` | DashboardPage, PsychometricReportView, PerformanceAnalyticsCharts |
| `@types/react`, `@types/react-dom` | TypeScript types |
| `@vitejs/plugin-react`, `vite`, `typescript` | Build tooling |
| `postcss` | Part of Vite CSS pipeline |

### Flagged Package

**`autoprefixer`** — No `postcss.config.js` or `postcss.config.ts` exists in `apps/frontend/`. Without a postcss configuration file to load autoprefixer, the package has no effect. Vite applies its own autoprefixing internally. Verify CSS cross-browser behavior before removing.

---

## 8. Root-Level Orphaned Scripts

These files at the monorepo root are not referenced by any application code. They are abandoned one-off development utility scripts.

| File | Evidence | Action |
|---|---|---|
| `extract_keys.py` | No references anywhere in app code | ✅ DELETE |
| `fix_theme.py` | No references anywhere in app code | ✅ DELETE |
| `fix_ts.py` | No references anywhere in app code | ✅ DELETE |
| `modify_hero.py` | No references anywhere in app code | ✅ DELETE |
| `remove_sparkles.py` | No references anywhere in app code | ✅ DELETE |
| `replace_colors.js` | No references anywhere in app code | ✅ DELETE |

---

## 9. The 410-GONE Stub Decision

**Location:** `apps/backend/app/fastapi_server.py` lines 176–189

The two deprecated pipeline endpoints `/api/v1/answer-keys` and `/api/v1/explanations` are served as HTTP 410 Gone stubs via an inline `deprecated_router`.

**Verification results:**

- ✅ Frontend does **not** call `/api/v1/answer-keys` or `/api/v1/explanations` — verified by full grep of all TSX/TS service files.
- ✅ `examService.ts` line 105 calls `/api/v1/pipeline/upload-answer-key` (the **live** active endpoint), not the deprecated ones.
- ✅ No backend code calls either deprecated path internally.
- ⚠️ `test_deterministic_pipeline.py` lines 246 and 250 explicitly test that both endpoints return 410.

**Decision: KEEP the stubs.** They are small (inline, no separate file), harmless, and serve as safety rails for any legacy mobile client or old cached references. Remove them only after access logs confirm zero traffic over an extended period.

---

## 10. Quantified Impact Summary

### Items Safe to Delete Now

| # | Item | Type | Est. Lines |
|---|---|---|---|
| B1 | `apps/backend/app/pipeline/validator.py` | Backend file | 38 |
| B2 | `apps/backend/app/pipeline/taxonomy_resolver.py` | Backend file | ~1,500 |
| B2-test | `apps/backend/tests/test_taxonomy_resolver.py` | Test file | ~200 |
| B3 | `apps/backend/app/services/s3_service.py` | Backend file | ~80 |
| B3-init | 2 lines in `app/services/__init__.py` | Config edit | 2 |
| F1 | `apps/frontend/src/components/admin/AdminHeader.tsx` | Frontend file | ~45 |
| F2 | `apps/frontend/src/components/admin/AdminOverview.tsx` | Frontend file | ~20 |
| F3 | `apps/frontend/src/components/admin/AdminTabNav.tsx` | Frontend file | ~35 |
| F4 | `apps/frontend/src/pages/UPDATE questions.sql` | Stray artifact | 3 |
| R1 | `extract_keys.py` | Root script | ~20 |
| R2 | `fix_theme.py` | Root script | ~60 |
| R3 | `fix_ts.py` | Root script | ~15 |
| R4 | `modify_hero.py` | Root script | ~250 |
| R5 | `remove_sparkles.py` | Root script | ~40 |
| R6 | `replace_colors.js` | Root script | ~60 |
| **TOTAL** | | | **≈ 2,370 lines** |

### Items Flagged (Do Not Delete Yet)

| # | Item | Blocking Reason |
|---|---|---|
| F-A | `src/components/common/MarkdownPreviewer.tsx` | Confirm no dynamic import |
| F-B | `src/components/student/PerformanceAnalyticsCharts.tsx` | Confirm no side-effect exports |
| B-A | `app/formatters/json_exporter.py` | Confirm no external tooling uses it |
| B-B | 6 legacy classes in `app/pipeline/state.py` | Remove after `validator.py` deletion + test suite green |
| D-A | `langchain-openai` PyPI package | Remove only if OpenAI LLM provider is permanently dropped |
| D-B | `autoprefixer` npm package | Remove only after CSS cross-browser verification |
| D-C | `pytest` in production deps | Structural fix: move to dev section |

### Dead Code (No File Deletion — Inline Prune Only)
- Commented-out S3 presigned URL block in `exam_json_builder.py`
- `ainvoke_mcq_validator_llm` function body (entire file `validator.py` being deleted)

---

*All grep evidence commands are reproducible from the repository root. No code was modified during this analysis pass.*
