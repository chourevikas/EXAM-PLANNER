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
             │
             ▼
┌───────────────────────────┐
│        PIPELINE 3         │ ──▶ Populates: QuestionExplanations, Subjects, Topics,
│ Explanation, Taxonomy &   │                Subtopics, QuestionHierarchyLinks
│       IRT Metadata        │     Updates:   OptionTranslation (Distractor Analysis),
└───────────────────────────┘                QuestionMetadata, Question.status -> PUBLISHED
```

---

## 1. Pipeline 1: Question Extraction & Passage Stitching Pipeline
- **Entry point**: `app/pipeline/graph.py`
- **Modules**: `batch_processor.py`, `dsu_stitcher.py`, `vision_extractor.py`, `validator.py`
- **Description**: Parallel vision extraction across PDF pages, transitive passage resolution via Disjoint Set Union (DSU), asset cropping, and initial DB registration of questions and translations.

### Database Tables & Fields Affected

#### 1. `passages` Table
*Created during DSU passage stitching phase.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Unique primary key identifier for the passage group. |
| `exam_id` | `UUID` | **CREATED** | Foreign Key (`exams.id`) | Links passage to the target exam paper. |
| `section_code` | `VARCHAR(50)` | **CREATED** | `"DEFAULT"` | Section identifier (e.g. `SECTION_A`, `READING_COMP`). |
| `memory_type` | `VARCHAR(50)` | **CREATED** | `"PASSAGE"` | Categorization enum (`PASSAGE` vs `CASE_STUDY`). |
| `is_complete` | `BOOLEAN` | **CREATED** | `True` | Flags if passage spans across missing pages. |
| `page_numbers_json` | `JSON / JSONB` | **CREATED** | `[page_numbers]` | Array of page numbers containing this passage. |
| `question_ids_json` | `JSON / JSONB` | **CREATED** | `[]` | Array of linked question UUID strings. |
| `created_at` | `TIMESTAMP` | **CREATED** | `utcnow()` | Timestamp of record creation. |

#### 2. `passage_translations` Table
*Stores extracted passage text per language.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary key. |
| `passage_id` | `UUID` | **CREATED** | Foreign Key (`passages.id`) | Foreign key linking to parent passage record. |
| `language` | `VARCHAR(10)` | **CREATED** | Enum (`ENGLISH`, `HINDI`) | Language code of the translation. |
| `passage_text` | `TEXT` | **CREATED** | Raw extracted string | Canonical passage context text. |

#### 3. `questions` Table
*Initial question record registration.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key for question entity. |
| `exam_id` | `UUID` | **CREATED** | Foreign Key (`exams.id`) | Target Exam ID reference. |
| `canonical_question_id` | `UUID` | **CREATED** | `id` | Standardized ID link for cross-set mapping. |
| `section_code` | `VARCHAR(50)` | **CREATED** | `"DEFAULT"` | Paper section code. |
| `paper_set_code` | `VARCHAR(20)` | **CREATED** | From `exam.paper_set_code` | Paper set (e.g. `SET_A`). |
| `passage_id` | `UUID` | **CREATED** | FK (`passages.id`) or `NULL` | Foreign key reference if question belongs to a passage. |
| `question_number_in_paper` | `INTEGER` | **CREATED** | Extracted Question # | Printed question number in PDF paper. |
| `question_type` | `VARCHAR(50)` | **CREATED** | Extracted Type | MCQ type (`SINGLE_CHOICE`, `MATCH_PAIR`, etc.). |
| `difficulty` | `VARCHAR(20)` | **CREATED** | `MEDIUM` | Initial default difficulty level. |
| `marks` | `FLOAT` | **CREATED** | `2.00` | Question marks weight. |
| `negative_marks` | `FLOAT` | **CREATED** | Calculated (`marks * neg_rate`) | Negative marking penalty deduction. |
| `expected_time_seconds` | `INTEGER` | **CREATED** | Calculated (30s - 180s) | Baseline target solve time based on word count & assets. |
| `source_type` | `VARCHAR(20)` | **CREATED** | `PYQ` | Question provenance type (`PYQ` / `MOCK`). |
| `source_year` | `INTEGER` | **CREATED** | From `exam.source_year` | Exam year. |
| `status` | `VARCHAR(50)` | **CREATED** | `PENDING_HUMAN_REVIEW` | Initial review status. |
| `is_mcq` | `BOOLEAN` | **CREATED** | `True` | Flag denoting multiple-choice structure. |
| `is_complete` | `BOOLEAN` | **CREATED** | LLM Flag (`True`/`False`) | `False` if stem/options broken by page break seams. |
| `has_image` | `BOOLEAN` | **CREATED** | LLM Flag (`True`/`False`) | `True` if question contains diagrams, maps, or figures. |
| `page_numbers_json` | `JSON / JSONB` | **CREATED** | `[p_num]` | List of PDF page numbers containing question text. |
| `passage_page_numbers_json`| `JSON / JSONB` | **CREATED** | `[passage_pages]` | Page numbers where parent passage resides. |
| `created_at` / `updated_at` | `TIMESTAMP` | **CREATED** | `utcnow()` | Timestamps. |

#### 4. `question_translations` Table
*Stores localized question stem and parent context.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED** | FK (`questions.id`) | Parent question reference. |
| `language` | `VARCHAR(10)` | **CREATED** | Language Enum | Language code (`ENGLISH`, `HINDI`). |
| `question_text` | `TEXT` | **CREATED** | Extracted text | Primary question statement/stem text. |
| `parent_context_override` | `TEXT` | **CREATED** | Optional string | Multi-part preamble context string if applicable. |

#### 5. `question_options` Table
*Registers multiple-choice options.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED** | FK (`questions.id`) | Parent question reference. |
| `option_label` | `VARCHAR(10)` | **CREATED** | `'A'`, `'B'`, `'C'`, `'D'` | Clean option identifier string. |
| `display_order` | `INTEGER` | **CREATED** | `1`, `2`, `3`, `4` | Sequential presentation order on screen. |
| `is_correct` | `BOOLEAN` | **CREATED** | `False` | **Unset in Pipeline 1** (Populated in Pipeline 2). |
| `is_complete` | `BOOLEAN` | **CREATED** | `True` | Completeness flag for option text. |
| `closeness_score` | `FLOAT` | **CREATED** | `0.00` | Default score. |

#### 6. `option_translations` Table
*Stores choice option text in target language.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `option_id` | `UUID` | **CREATED** | FK (`question_options.id`)| Parent option reference. |
| `language` | `VARCHAR(10)` | **CREATED** | Language Enum | Language code. |
| `option_text` | `TEXT` | **CREATED** | Extracted string | Text representation of the choice option. |
| `distractor_analysis` | `TEXT` | **CREATED** | `NULL` | **Unset in Pipeline 1** (Populated in Pipeline 3). |

#### 7. `question_assets` Table
*Crops visual elements (diagrams, graphs, maps) and uploads to storage.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED** | FK (`questions.id`) | Target question reference. |
| `asset_path` | `VARCHAR` | **CREATED** | Storage relative path | Relative storage link (S3/local) to image file. |
| `asset_type` | `VARCHAR(50)` | **CREATED** | `DIAGRAM` | Asset type classification (`DIAGRAM`, `MAP`, `TABLE`). |
| `caption` | `TEXT` | **CREATED** | Extracted caption / `NULL` | Descriptive figure caption text. |
| `display_order` | `INTEGER` | **CREATED** | `1` | Order of asset display. |

#### 8. `question_metadata` Table
*Initializes baseline IRT and Bloom's record.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED** | FK (`questions.id`) | 1-to-1 unique question reference. |
| `blooms_level` | `VARCHAR(50)` | **CREATED** | `ANALYZE` | Initial baseline Bloom's Taxonomy level. |
| `cognitive_skill` | `VARCHAR` | **CREATED** | `"Extraction Stage..."` | Initial skill label. |
| `primary_concept_tag` | `VARCHAR` | **CREATED** | `"GENERAL"` | Default baseline concept tag. |
| `historical_accuracy` | `FLOAT` | **CREATED** | `50.00` | Baseline initial accuracy percentage. |
| `pyq_frequency` | `INTEGER` | **CREATED** | `1` | Frequency metric. |
| `irt_discrimination_a`| `FLOAT` | **CREATED** | `1.50` | Default IRT Discrimination coefficient $a$. |
| `irt_difficulty_b` | `FLOAT` | **CREATED** | `0.00` | Default IRT Difficulty parameter $b$. |
| `irt_pseudo_guessing_c`| `FLOAT` | **CREATED** | `0.25` | Default 4-option guessing parameter $c$. |

#### 9. `human_review_tasks` Table
*Generates audit verification tasks for admin review queue.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 1 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED** | FK (`questions.id`) | Target question reference. |
| `exam_id` | `UUID` | **CREATED** | FK (`exams.id`) | Target exam reference. |
| `review_status` | `VARCHAR(50)` | **CREATED** | `PENDING_REVIEW` | Review status. |
| `is_flagged_by_validator`| `BOOLEAN` | **CREATED** | `True` / `False` | `True` if `is_complete` is `False` or validation failed. |
| `failure_reasons_json` | `JSON / JSONB` | **CREATED** | `["Reason..."]` | JSON array of automated validator warning strings. |

---

## 2. Pipeline 2: Answer Key Extraction & Set Mapping Pipeline
- **Entry point**: `app/pipeline/answer_key_graph.py`
- **Modules**: `answer_key_extractor.py`
- **Description**: Parses answer key tables, detects paper set code (`SET_A`, `SET_B`, `SET_C`, `SET_D`), validates paper set matching against target exam, maps correct options in DB, and records audit batch details.

### Database Tables & Fields Affected

#### 1. `exams` Table
*Read for set verification and auto-registered if missing.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 2 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **READ / CREATED** | Exam UUID | Looked up to verify target exam existence. |
| `code` / `name` | `VARCHAR` | **READ / CREATED** | Generated string | Auto-created fallback if exam ID is missing. |
| `paper_set_code` | `VARCHAR(20)` | **READ** | `'SET_A'` | Target set code used in set validation checks. |

#### 2. `answer_key_batches` Table
*Stores Answer Key PDF ingestion session details.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 2 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key for answer key batch session. |
| `exam_id` | `UUID` | **CREATED** | FK (`exams.id`) | Exam reference. |
| `pdf_path` | `VARCHAR` | **CREATED** | File path string | Path to answer key source PDF/image. |
| `target_set_code` | `VARCHAR(20)` | **CREATED** | Expected set code | Expected set requested by system (`SET_A`). |
| `detected_set_code` | `VARCHAR(20)` | **CREATED** | LLM Detected set | Set code extracted by LLM from image page header. |
| `set_match_status` | `VARCHAR(50)` | **CREATED** | Status Enum | `MATCHED`, `MISMATCH_SKIPPED`, `MULTI_SET_MATRIX`. |
| `total_keys_extracted` | `INTEGER` | **CREATED / UPDATED** | Count integer | Total question-answer pairs parsed from document. |
| `total_keys_mapped` | `INTEGER` | **CREATED / UPDATED** | Count integer | Number of correct answers successfully mapped to DB. |

#### 3. `answer_key_mappings` Table
*Per-question audit mapping trail.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 2 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED** | `uuid4()` | Primary Key. |
| `batch_id` | `UUID` | **CREATED** | FK (`answer_key_batches.id`)| Parent batch session link. |
| `question_id` | `UUID` | **CREATED** | FK (`questions.id`) / `NULL` | Question ID matched; `NULL` if question not found. |
| `printed_question_number` | `INTEGER` | **CREATED** | Question # | Printed question number parsed from answer key table. |
| `detected_option_label` | `VARCHAR(10)` | **CREATED** | Normalized label | Standardized option letter (`'A'`, `'B'`, `'C'`, `'D'`). |
| `paper_set_code` | `VARCHAR(20)` | **CREATED** | `target_set_code` | Set code associated with mapping. |
| `mapping_status` | `VARCHAR(50)` | **CREATED** | Mapping Enum | `APPLIED`, `QUESTION_NOT_FOUND`, `CONFLICT_FLAGGED`, `SKIPPED_SET_MISMATCH`. |
| `notes` | `TEXT` | **CREATED** | Explanatory note | Audit note detailing mapping result or reason for failure. |

#### 4. `questions` Table
*Queried to locate target question record.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 2 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **READ** | Existing UUID | Looked up via `exam_id` + `question_number_in_paper`. |
| `question_number_in_paper` | `INTEGER` | **READ** | Question # | Match criterion. |

#### 5. `question_options` Table
*Updated with verified correct answer keys.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 2 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **READ** | Option UUID | Looked up by `question_id` and `option_label`. |
| `is_correct` | `BOOLEAN` | **UPDATED** | **`True` / `False`** | **Set to `True` for the matching option label; `False` for all other choice options.** |

---

## 3. Pipeline 3: Explanation Generator, Multi-Concept Indexing & IRT Metadata Pipeline
- **Entry point**: `app/pipeline/explanation_graph.py`
- **Modules**: `explanation_generator.py`, `explanation_schema.py`, `pipeline_management_service.py`
- **Description**: Generates step-by-step reasoning solutions, core concepts, distractor analyses per option, computes IRT & Bloom's metrics, constructs syllabus hierarchy (`Subject` $\rightarrow$ `Topic` $\rightarrow$ `Subtopic`), creates multi-concept links, and transitions question status to `PUBLISHED`.

### Database Tables & Fields Affected

#### 1. `question_explanations` Table
*Creates primary step-by-step solution records.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED / UPDATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED / UPDATED** | FK (`questions.id`) | Foreign Key linking to parent question. |
| `language` | `VARCHAR(10)` | **CREATED / UPDATED** | `LanguageCode.ENGLISH` | Target language code. |
| `core_concept` | `TEXT` | **CREATED / UPDATED** | LLM Generated | Single-sentence statement of primary formula/rule tested. |
| `detailed_solution` | `TEXT` | **CREATED / UPDATED** | LLM Generated | Complete step-by-step proof, calculation, or derivation. |
| `common_traps_json` | `JSON / JSONB` | **CREATED / UPDATED** | `["Trap 1", ...]` | Array of common calculation pitfalls / misconceptions. |
| `key_takeaways_json` | `JSON / JSONB` | **CREATED / UPDATED** | `["Point 1", ...]` | High-yield summary bullet points for student revision. |

#### 2. `option_translations` Table
*Populates distractor analysis per choice option.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- | :--- |
| `distractor_analysis` | `TEXT` | **UPDATED / CREATED** | LLM Generated string | **Detailed explanation explaining why this specific option choice is correct or incorrect (distractor breakdown).** |

#### 3. `questions` Table
*Enriches question metadata and publishes record.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- | :--- |
| `subtopic_id` | `UUID` | **UPDATED** | FK (`subtopics.id`) | Links question to primary subtopic in taxonomy. |
| `difficulty` | `VARCHAR(20)` | **UPDATED** | `EASY`, `MEDIUM`, `HARD` | Refined difficulty level based on LLM concept analysis. |
| `expected_time_seconds` | `INTEGER` | **UPDATED** | Calculated (30s - 180s) | Refined time budget based on Bloom's level + difficulty + assets. |
| `status` | `VARCHAR(50)` | **UPDATED** | **`PUBLISHED`** | **Transitions question status from `PENDING_HUMAN_REVIEW` to `PUBLISHED`.** |
| `updated_at` | `TIMESTAMP` | **UPDATED** | `utcnow()` | Timestamp of last modification. |

#### 4. `question_metadata` Table
*Computes Item Response Theory (IRT) and Bloom's parameters.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- | :--- |
| `blooms_level` | `VARCHAR(50)` | **UPDATED** | `REMEMBER`, `UNDERSTAND`, `APPLY`, `ANALYZE`, `EVALUATE` | Classified Bloom's Taxonomy cognitive depth level. |
| `cognitive_skill` | `VARCHAR` | **UPDATED** | LLM Skill Label | Specific mental process required (e.g. `Spatial Reasoning`). |
| `primary_concept_tag` | `VARCHAR` | **UPDATED** | Topic Tag String | Upper-case normalized primary concept label. |
| `historical_accuracy` | `FLOAT` | **UPDATED** | Calculated / Estimated % | Predicted historic student success rate. |
| `pyq_frequency` | `INTEGER` | **UPDATED** | Integer count | Recurrence rate of concept in historic exam trends. |
| `irt_discrimination_a`| `FLOAT` | **UPDATED** | `1.20` to `1.80` | Item Response Theory (IRT) Item Discrimination parameter $a$. |
| `irt_difficulty_b` | `FLOAT` | **UPDATED** | `-1.00`, `0.00`, `1.50` | Item Response Theory (IRT) Item Difficulty parameter $b$. |
| `irt_pseudo_guessing_c`| `FLOAT` | **UPDATED** | `0.25` | IRT Pseudo-guessing parameter $c$. |

#### 5. `syllabus_versions`, `subjects`, `topics`, `subtopics` Tables
*Dynamically builds/upserts subject-topic-subtopic taxonomy hierarchy.*

| Table Name | DB Field Name | Operation | Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- |
| `syllabus_versions` | `id`, `exam_id`, `version_code`, `title` | **READ / CREATED** | Resolves default syllabus version for target exam. |
| `subjects` | `id`, `syllabus_version_id`, `code`, `name` | **READ / CREATED** | Subject category (e.g. `POLITY`, `HISTORY`, `ECONOMY`). |
| `topics` | `id`, `subject_id`, `code`, `name` | **READ / CREATED** | Topic category (e.g. `Preamble`, `Judiciary`). |
| `subtopics` | `id`, `topic_id`, `code`, `name` | **READ / CREATED** | Specific granular subtopic (e.g. `Basic Structure`). |

#### 6. `question_hierarchy_links` Table
*Maps multi-concept relationships (1 question to $N$ concepts).*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | **CREATED / UPDATED** | `uuid4()` | Primary Key. |
| `question_id` | `UUID` | **CREATED / UPDATED** | FK (`questions.id`) | Target Question reference. |
| `subtopic_id` | `UUID` | **CREATED / UPDATED** | FK (`subtopics.id`) | Linked subtopic identifier. |
| `topic_id` | `UUID` | **CREATED / UPDATED** | FK (`topics.id`) | Linked topic identifier. |
| `subject_id` | `UUID` | **CREATED / UPDATED** | FK (`subjects.id`) | Linked subject identifier. |
| `is_primary` | `BOOLEAN` | **CREATED / UPDATED** | `True` / `False` | `True` for the primary domain concept. |
| `relevance_weight` | `FLOAT` | **CREATED / UPDATED** | `0.0` to `1.0` | Calculated relevance weight of concept in question. |
| `concept_name` | `VARCHAR(200)` | **CREATED / UPDATED** | Concept string | Descriptive concept tag label. |

#### 7. `human_review_tasks` Table
*Audit validation check for explanation completeness.*

| DB Field Name | Data Type | Operation | Default / Initial Value | Description & Purpose in Pipeline 3 |
| :--- | :--- | :---: | :--- | :--- |
| `is_flagged_by_validator`| `BOOLEAN` | **UPDATED** | `True` / `False` | Flagged `True` if explanation or distractor analysis is incomplete. |
| `failure_reasons_json` | `JSON / JSONB` | **UPDATED** | JSON array | Updated with explanation QA warning flags. |

#### 8. `pipeline_runs` Table
*Tracks pipeline state across all 3 phases.*

| DB Field Name | Data Type | Operation | Purpose Across All 3 Pipelines |
| :--- | :--- | :---: | :--- |
| `id` | `UUID` | **CREATED** | Unique pipeline execution log ID. |
| `exam_id` | `UUID` | **CREATED / READ** | Exam ID being processed. |
| `pipeline_type` | `VARCHAR(50)` | **CREATED / UPDATED** | `'QUESTION_EXTRACTION'`, `'ANSWER_KEY'`, `'EXPLANATION_INDEXING'`. |
| `status` | `VARCHAR(50)` | **UPDATED** | `'PENDING'`, `'RUNNING'`, `'COMPLETED'`, `'FAILED'`. |
| `current_step` | `VARCHAR(100)` | **UPDATED** | Current active execution step label. |
| `progress_percent` | `FLOAT` | **UPDATED** | Completion percentage ($0.0\%$ to $100.0\%$). |

---

## 4. Master Cross-Pipeline Database Matrix

The table below summarizes which pipeline **Creates (C)**, **Reads (R)**, or **Updates (U)** fields across every database entity:

| Database Table | Pipeline 1 (Question Extraction) | Pipeline 2 (Answer Key) | Pipeline 3 (Explanation & Indexing) |
| :--- | :---: | :---: | :---: |
| `exams` | Read | Read / Create (fallback) | Read |
| `passages` | **Create** | — | Read |
| `passage_translations` | **Create** | — | Read |
| `questions` | **Create** (`status: PENDING_HUMAN_REVIEW`) | Read | **Update** (`status: PUBLISHED`, `difficulty`, `time`, `subtopic_id`) |
| `question_translations` | **Create** | — | Read |
| `question_options` | **Create** (`is_correct: False`) | **Update** (`is_correct: True/False`) | Read |
| `option_translations` | **Create** | — | **Update** (`distractor_analysis`) |
| `question_assets` | **Create** | — | Read |
| `question_metadata` | **Create** (Defaults) | — | **Update** (`blooms_level`, `irt_a`, `irt_b`, `irt_c`, `concept_tag`) |
| `human_review_tasks` | **Create** (`PENDING_REVIEW`) | — | **Update** (Validation flags) |
| `answer_key_batches` | — | **Create** | — |
| `answer_key_mappings` | — | **Create** | — |
| `question_explanations` | — | — | **Create / Update** |
| `syllabus_versions` | — | — | Read / Create |
| `subjects` | — | — | Read / Create |
| `topics` | — | — | Read / Create |
| `subtopics` | — | — | Read / Create |
| `question_hierarchy_links` | — | — | **Create / Update** |
| `pipeline_runs` | Create / Update | Create / Update | Create / Update |
