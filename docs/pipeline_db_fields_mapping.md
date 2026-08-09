# Pipeline Database Fields Mapping Reference

> **Exam Platform & Vision AI PDF Processing Engine**
> Complete documentation of database schema fields managed, populated, and read across the 3 specialized LangGraph ingestion & enrichment pipelines.

---

## Executive Summary & Architecture Overview

The backend system uses 3 sequential, modular **LangGraph AI pipelines** to convert un-structured exam PDFs into a fully structured, indexed, and audited database and canonical knowledge base.

```
       [ Input PDF ]
             │
             ▼
┌───────────────────────────┐
│        PIPELINE 1         │ ──▶ Populates: Questions, Passages, Translations,
│ Question Extraction & DSU │                Assets, Initial Metadata, Audit Tasks
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│        PIPELINE 2         │ ──▶ Populates: AnswerKeyBatches, AnswerKeyMappings
│  Answer Key & Set Match   │     Updates:   QuestionOption.is_correct
└────────────┬──────────────┘
             │ (Auto-Trigger when both P1 & P2 Complete)
             ▼
┌───────────────────────────┐
│        PIPELINE 3         │ ──▶ Populates: QuestionExplanations, Subjects, Topics,
│ Explanation, Taxonomy &   │                Subtopics (pyq_frequency), QuestionHierarchyLinks,
│       IRT Metadata        │                JSON Export Artifacts (Q001.json)
└───────────────────────────┘     Updates:   OptionTranslation (Distractor Analysis),
                                             QuestionOption (closeness_score),
                                             QuestionMetadata, Question.status -> PUBLISHED
```

---

## 1. Pipeline 1: Question Extraction & Passage Stitching Pipeline
- **Entry point**: `app/pipeline/graph.py`
- **Modules**: `batch_processor.py`, `dsu_stitcher.py`, `vision_extractor.py`, `validator.py`
- **Description**: Parallel vision extraction across PDF pages, transitive passage resolution via Disjoint Set Union (DSU), asset cropping to `cropped_assets/{canonical_exam_code}/{set_code}/{sec_code}/`, and initial DB registration of questions, options, and translations.

---

## 2. Pipeline 2: Answer Key Extraction & Set Mapping Pipeline
- **Entry point**: `app/pipeline/answer_key_graph.py`
- **Modules**: `answer_key_extractor.py`
- **Description**: Parses answer key tables, detects paper set code (`SET_A`, `SET_B`, `SET_C`, `SET_D`), validates paper set matching against target exam, maps correct options in DB (`QuestionOption.is_correct = True`), and checks auto-orchestration readiness for Pipeline 3.

---

## 3. Pipeline 3: Explanation Generator, Multi-Concept Indexing & IRT Metadata Pipeline
- **Entry point**: `app/pipeline/explanation_graph.py`
- **Modules**: `explanation_generator.py`, `explanation_schema.py`, `json_exporter.py`, `pipeline_management_service.py`
- **Description**: Generates step-by-step reasoning solutions in English (retaining original non-English question statements), option distractor analyses, option `closeness_score` ($0.0 - 1.0$), 3PL IRT parameters ($a, b, c$), constructs syllabus hierarchy (`Subject` $\rightarrow$ `Topic` $\rightarrow$ `Subtopic`), increments concept `Subtopic.pyq_frequency`, normalizes question expected time to match total exam time budget, exports standalone JSON artifacts for frontend fast access, and transitions question status to `PUBLISHED`.

### Relocated Fields Specification
- **`historical_accuracy`**: Removed from static `question_metadata`. Placed on candidate test attempt responses (`exam_question_responses.candidate_accuracy_pct`) where student performance analytics actually occur.
- **`pyq_frequency`**: Relocated from `question_metadata` to syllabus taxonomy `subtopics.pyq_frequency` (and `topics`), representing the recurrence count of each core subtopic concept across past year papers.

---

## 4. Master Cross-Pipeline Database Matrix

| Database Table | Pipeline 1 (Question Extraction) | Pipeline 2 (Answer Key) | Pipeline 3 (Explanation & Indexing) |
| :--- | :---: | :---: | :---: |
| `exams` | Read / Create (`exam_type`, `total_duration_minutes`) | Read / Create (fallback) | Read |
| `passages` | **Create** | — | Read |
| `passage_translations` | **Create** | — | Read |
| `questions` | **Create** (`status: PENDING_HUMAN_REVIEW`) | Read | **Update** (`status: PUBLISHED`, `difficulty`, `expected_time_seconds`, `subtopic_id`) |
| `question_translations` | **Create** (Preserves original language) | — | Read |
| `question_options` | **Create** (`is_correct: False`) | **Update** (`is_correct: True/False`) | **Update** (`closeness_score: 0.0 - 1.0`) |
| `option_translations` | **Create** | — | **Update** (`distractor_analysis` in English) |
| `question_assets` | **Create** (`cropped_assets/{canonical}/{set}/`) | — | Read |
| `question_metadata` | **Create** (Defaults) | — | **Update** (`blooms_level`, `irt_a`, `irt_b`, `irt_c`, `concept_tag`) |
| `human_review_tasks` | **Create** (`PENDING_REVIEW`) | — | **Update** (Validation flags) |
| `answer_key_batches` | — | **Create** | — |
| `answer_key_mappings` | — | **Create** | — |
| `question_explanations` | — | — | **Create / Update** (English-only) |
| `syllabus_versions` | — | — | Read / Create |
| `subjects` | — | — | Read / Create |
| `topics` | — | — | Read / Create |
| `subtopics` | — | — | Read / Create (**Update** `pyq_frequency`) |
| `question_hierarchy_links` | — | — | **Create / Update** |
| `exam_question_responses` | — | — | Used in Student Attempt Analytics (`candidate_accuracy_pct`) |
| `pipeline_runs` | Create / Update | Create / Update | Create / Update (Triggers auto-dispatched Pipeline 3) |
